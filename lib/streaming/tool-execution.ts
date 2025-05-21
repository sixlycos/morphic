import {
  CoreMessage,
  DataStreamWriter,
  generateId,
  generateText,
  JSONValue
} from 'ai'
import { z } from 'zod'
import { searchSchema } from '../schema/search'
import {
  executeResearchReportTool,
  researchReportSchema,
  ResearchReportToolParams
} from '../tools/research-report-tool'
import { search } from '../tools/search'
import { ExtendedCoreMessage, SearchResults } from '../types'
import { getModel } from '../utils/registry'
import { parseToolCallXml } from './parse-tool-call'

interface ToolExecutionResult {
  toolCallDataAnnotation: ExtendedCoreMessage | null
  toolCallMessages: CoreMessage[]
}

export async function executeToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  searchMode: boolean
): Promise<ToolExecutionResult> {
  // 输出工具调用状态
  console.log('开始工具调用流程, 搜索模式:', searchMode, '模型:', model)
  console.log('消息数量:', coreMessages.length)

  // If search mode is disabled, return empty tool call
  if (!searchMode) {
    console.log('搜索模式已禁用，跳过工具调用')
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  // 获取最后一条用户消息
  const lastUserMessage = [...coreMessages]
    .reverse()
    .find(m => m.role === 'user')

  if (!lastUserMessage) {
    console.log('未找到用户消息，跳过工具调用')
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  console.log(
    '最后一条用户消息:',
    typeof lastUserMessage.content === 'string'
      ? lastUserMessage.content
      : JSON.stringify(lastUserMessage.content)
  )

  // 如果是纯文本查询，直接使用搜索工具
  const isSimpleQuery =
    typeof lastUserMessage.content === 'string' &&
    !lastUserMessage.content.includes('研报') &&
    !lastUserMessage.content.includes('财务') &&
    !lastUserMessage.content.includes('股票') &&
    !lastUserMessage.content.includes('公司') &&
    !lastUserMessage.content.includes('行情')

  // 对于非研报类请求，搜索模式下始终使用搜索工具
  if (searchMode && isSimpleQuery) {
    console.log('搜索模式下，直接使用搜索工具处理查询')
    const query =
      typeof lastUserMessage.content === 'string' ? lastUserMessage.content : ''

    // 为搜索查询创建工具调用
    const searchToolCallId = `call_${generateId()}`
    const searchToolCallAnnotation = {
      type: 'tool_call',
      data: {
        state: 'call',
        toolCallId: searchToolCallId,
        toolName: 'search',
        args: JSON.stringify({
          query,
          max_results: 20,
          search_depth: 'advanced'
        })
      }
    }

    dataStream.writeData(searchToolCallAnnotation)

    console.log('执行搜索工具:', query)
    // 执行搜索
    const searchResult = await search(query, 20, 'advanced', [], [])

    const updatedSearchToolCallAnnotation = {
      ...searchToolCallAnnotation,
      data: {
        ...searchToolCallAnnotation.data,
        result: JSON.stringify(searchResult),
        state: 'result'
      }
    }

    dataStream.writeMessageAnnotation(updatedSearchToolCallAnnotation)

    const toolCallDataAnnotation: ExtendedCoreMessage = {
      role: 'data',
      content: {
        type: 'tool_call',
        data: updatedSearchToolCallAnnotation.data
      } as JSONValue
    }

    const toolCallMessages: CoreMessage[] = [
      {
        role: 'assistant',
        content: `Tool call result: ${JSON.stringify(searchResult)}`
      },
      {
        role: 'user',
        content: 'Now answer the user question.'
      }
    ]

    return { toolCallDataAnnotation, toolCallMessages }
  }

  // 转换所有工具的Zod模式为字符串表示
  // 搜索工具模式
  const searchSchemaString = Object.entries(searchSchema.shape)
    .map(([key, value]) => {
      const description = value.description
      const isOptional = value instanceof z.ZodOptional
      return `- ${key}${isOptional ? ' (optional)' : ''}: ${description}`
    })
    .join('\n')

  // 研报生成工具模式
  const researchReportSchemaString = Object.entries(researchReportSchema.shape)
    .map(([key, value]) => {
      const description = value.description
      const isOptional = value instanceof z.ZodOptional
      return `- ${key}${isOptional ? ' (optional)' : ''}: ${description}`
    })
    .join('\n')

  const defaultMaxResults = model?.includes('ollama') ? 5 : 20

  // Generate tool selection using XML format
  console.log('正在生成工具选择...')
  const toolSelectionResponse = await generateText({
    model: getModel(model),
    system: `You are an intelligent assistant that analyzes conversations to select the most appropriate tools and their parameters.
            You excel at understanding context to determine when and how to use available tools, including crafting effective search queries.
            Current date: ${new Date().toISOString().split('T')[0]}

            Do not include any other text in your response.
            Respond in XML format with the following structure:
            <tool_call>
              <tool>tool_name</tool>
              <parameters>
                <!-- Parameters specific to the selected tool -->
              </parameters>
            </tool_call>

            Available tools: 
            1. search - For general web search
            2. research_report - For generating financial research reports on stocks

            Search parameters:
            ${searchSchemaString}
            
            Research Report parameters:
            ${researchReportSchemaString}

            Tool selection guidance:
            - ALWAYS use 'search' for any general information queries, factual questions, or current events
            - STRONGLY PREFER the search tool for most queries as it provides up-to-date information
            - Use 'research_report' ONLY when the user EXPLICITLY asks for financial analysis or reports on a specific stock
              Example: "给我一份比亚迪的研报" should use the research_report tool with stockName="比亚迪"
              
            When selecting the research_report tool:
            1. You MUST provide the stockName parameter (like "比亚迪", "茅台", "腾讯")
            2. The reportDate parameter is optional (format: YYYYMMDD) - if not provided, the most recent quarter end will be used
            3. The stockCode will be automatically determined through web search
            
            Research report questions are typically like:
            - "生成一份比亚迪的研报"
            - "我想看看茅台的财务分析"
            - "给我一份腾讯的投资报告"
            - "帮我做个中国平安的研报分析"
            - "600519" (股票代码)
            - "茅台" (仅股票名称)
            
            If the request clearly matches these patterns, you MUST use the research_report tool.
            If the user input is just a stock name or stock code, you MUST use the research_report tool.

            IMPORTANT: 
            - For ANY general knowledge questions or factual queries, ALWAYS choose the search tool
            - NEVER return <tool></tool> for information-seeking questions - ALWAYS use search
            - If unsure, DEFAULT TO USING THE SEARCH TOOL rather than no tool

            If you don't need a tool, respond with <tool_call><tool></tool></tool_call>`,
    messages: coreMessages
  })

  // Parse the tool selection XML
  const toolCallXml = toolSelectionResponse.text
  console.log('工具选择结果:', toolCallXml)

  // 根据选择的工具类型确定使用哪个解析模式
  const isResearchReport = toolCallXml.includes('<tool>research_report</tool>')

  // 输出工具选择结果
  console.log(
    '工具选择类型:',
    isResearchReport
      ? 'research_report'
      : toolCallXml.includes('<tool>search</tool>')
      ? 'search'
      : 'none'
  )

  // 解析工具调用
  if (!toolCallXml) {
    // 搜索模式下，如果没有选择任何工具，强制使用搜索工具
    if (searchMode) {
      console.log('搜索模式下，模型未选择工具，强制使用搜索工具')
      const query =
        typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : ''

      // 执行默认搜索
      return await executeDefaultSearch(query, dataStream)
    }
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  // 检测空工具调用情况 <tool_call><tool></tool></tool_call>
  if (toolCallXml.includes('<tool></tool>') && searchMode) {
    console.log('搜索模式下，模型选择了空工具，强制使用搜索工具')
    const query =
      typeof lastUserMessage.content === 'string' ? lastUserMessage.content : ''

    // 执行默认搜索
    return await executeDefaultSearch(query, dataStream)
  }

  let toolCall
  let toolResult: string | SearchResults

  // 添加默认搜索执行函数
  async function executeDefaultSearch(
    query: string,
    dataStream: DataStreamWriter
  ): Promise<ToolExecutionResult> {
    const searchToolCallId = `call_${generateId()}`
    const searchToolCallAnnotation = {
      type: 'tool_call',
      data: {
        state: 'call',
        toolCallId: searchToolCallId,
        toolName: 'search',
        args: JSON.stringify({
          query,
          max_results: 20,
          search_depth: 'advanced'
        })
      }
    }

    dataStream.writeData(searchToolCallAnnotation)

    console.log('执行默认搜索工具:', query)
    const searchResult = await search(query, 20, 'advanced', [], [])

    const updatedSearchToolCallAnnotation = {
      ...searchToolCallAnnotation,
      data: {
        ...searchToolCallAnnotation.data,
        result: JSON.stringify(searchResult),
        state: 'result'
      }
    }

    dataStream.writeMessageAnnotation(updatedSearchToolCallAnnotation)

    const toolCallDataAnnotation: ExtendedCoreMessage = {
      role: 'data',
      content: {
        type: 'tool_call',
        data: updatedSearchToolCallAnnotation.data
      } as JSONValue
    }

    const toolCallMessages: CoreMessage[] = [
      {
        role: 'assistant',
        content: `Tool call result: ${JSON.stringify(searchResult)}`
      },
      {
        role: 'user',
        content: 'Now answer the user question.'
      }
    ]

    return { toolCallDataAnnotation, toolCallMessages }
  }

  if (isResearchReport) {
    // 处理研报生成工具
    toolCall = parseToolCallXml(toolCallXml, researchReportSchema)

    if (!toolCall || !toolCall.tool || toolCall.tool !== 'research_report') {
      return { toolCallDataAnnotation: null, toolCallMessages: [] }
    }

    const toolCallId = `call_${generateId()}`

    // 1. 发送工具调用开始状态
    const toolCallAnnotation = {
      type: 'tool_call',
      data: {
        state: 'call',
        toolCallId,
        toolName: toolCall.tool,
        args: JSON.stringify(toolCall.parameters)
      }
    }
    dataStream.writeData(toolCallAnnotation)

    console.log('执行研报生成工具:', toolCall.parameters)
    const reportParams = toolCall.parameters as ResearchReportToolParams
    toolResult = await executeResearchReportTool(reportParams, dataStream)

    // 2. 发送工具调用结果状态
    const resultAnnotation = {
      type: 'tool_call',
      data: {
        state: 'result',
        toolCallId,
        toolName: toolCall.tool,
        args: JSON.stringify(toolCall.parameters),
        result: toolResult
      }
    }
    dataStream.writeData(resultAnnotation)

    // 3. 添加消息注释
    const toolCallDataAnnotation: ExtendedCoreMessage = {
      role: 'data',
      content: {
        type: 'tool_call',
        data: resultAnnotation.data
      } as JSONValue
    }

    // 4. 添加工具调用消息
    const toolCallMessages: CoreMessage[] = [
      {
        role: 'assistant',
        content: toolResult
      }
    ]

    return { toolCallDataAnnotation, toolCallMessages }
  } else {
    // 处理搜索工具
    toolCall = parseToolCallXml(toolCallXml, searchSchema)

    if (!toolCall || !toolCall.tool || toolCall.tool !== 'search') {
      return { toolCallDataAnnotation: null, toolCallMessages: [] }
    }

    const toolCallAnnotation = {
      type: 'tool_call',
      data: {
        state: 'call',
        toolCallId: `call_${generateId()}`,
        toolName: toolCall.tool,
        args: JSON.stringify(toolCall.parameters)
      }
    }
    dataStream.writeData(toolCallAnnotation)

    console.log('执行搜索工具:', toolCall.parameters)
    const searchParams = toolCall.parameters || { query: '' }

    toolResult = await search(
      searchParams.query ?? '',
      searchParams.max_results,
      searchParams.search_depth as 'basic' | 'advanced',
      searchParams.include_domains ?? [],
      searchParams.exclude_domains ?? []
    )

    const updatedToolCallAnnotation = {
      ...toolCallAnnotation,
      data: {
        ...toolCallAnnotation.data,
        result: JSON.stringify(toolResult),
        state: 'result'
      }
    }
    dataStream.writeMessageAnnotation(updatedToolCallAnnotation)

    const toolCallDataAnnotation: ExtendedCoreMessage = {
      role: 'data',
      content: {
        type: 'tool_call',
        data: updatedToolCallAnnotation.data
      } as JSONValue
    }

    const toolCallMessages: CoreMessage[] = [
      {
        role: 'assistant',
        content: `Tool call result: ${JSON.stringify(toolResult)}`
      },
      {
        role: 'user',
        content: 'Now answer the user question.'
      }
    ]

    return { toolCallDataAnnotation, toolCallMessages }
  }
}
