import { DataStreamWriter, JSONValue } from 'ai'
import { z } from 'zod'
import { SearchResults } from '../types'
import { WorkflowDataStream, toJSONSafeMessage } from '../types/workflow'
import { executeResearchReportWorkflow } from '../workflow/research-report-workflow'
import { search } from './search'

// 研报工具参数模式
export const researchReportSchema = z.object({
  stockName: z.string().describe('股票名称,例如: 比亚迪,华为,茅台等'),
  reportDate: z
    .string()
    .optional()
    .describe('报告日期(YYYYMMDD格式,可选),例如: 20230630,默认使用最近日期'),
  reportType: z
    .string()
    .optional()
    .describe('报告类型(可选): 年报, 半年报, 一季报, 三季报'),
  currentModel: z
    .string()
    .optional()
    .describe('当前用户选择的模型ID,用于生成研报')
})

export type ResearchReportToolParams = z.infer<typeof researchReportSchema>

// 股票代码正则表达式
const stockCodeRegex: Record<string, RegExp> = {
  // 上海证券交易所
  SH: /([0-9]{6})\.SH/i,
  // 深圳证券交易所
  SZ: /([0-9]{6})\.SZ/i,
  // 北京证券交易所
  BJ: /([894][0-9]{5})\.BJ/i,
  // 香港证券交易所
  HK: /([0-9]{5})\.HK/i
}

// 提取搜索结果中的股票代码
async function extractStockCode(
  stockName: string
): Promise<{ stockCode: string; exchange: string } | null> {
  try {
    // 构建搜索查询
    const query = `${stockName} 股票代码 交易所`
    console.log(`搜索股票信息: ${query}`)

    // 执行搜索
    const searchResults = await search(query, 5, 'advanced')
    const allContent = searchResults.results
      .map(r => r.title + ' ' + r.content)
      .join(' ')
    console.log('搜索结果摘要:', allContent.substring(0, 200) + '...')

    // 尝试匹配各种交易所的股票代码
    for (const [exchange, regex] of Object.entries(stockCodeRegex)) {
      const matches = allContent.match(regex)
      if (matches && matches[1]) {
        const stockCode = `${matches[1]}.${exchange}`
        console.log(`找到股票代码: ${stockCode}, 交易所: ${exchange}`)
        return { stockCode, exchange }
      }
    }

    // 尝试从结果中提取数字作为股票代码
    const numberMatches = allContent.match(/([0-9]{6})/g)
    if (numberMatches && numberMatches.length > 0) {
      // 根据股票代码前缀判断可能的交易所
      const codePrefix = numberMatches[0].charAt(0)
      let exchange = ''

      if (codePrefix === '6' || codePrefix === '3') {
        exchange = 'SH'
      } else if (codePrefix === '0' || codePrefix === '3') {
        exchange = 'SZ'
      } else if (
        codePrefix === '8' ||
        codePrefix === '4' ||
        codePrefix === '9'
      ) {
        exchange = 'BJ'
      } else {
        exchange = 'SZ' // 默认深交所
      }

      const stockCode = `${numberMatches[0]}.${exchange}`
      console.log(`通过数字匹配找到股票代码: ${stockCode}, 交易所: ${exchange}`)
      return { stockCode, exchange }
    }

    console.log('未找到股票代码')
    return null
  } catch (error) {
    console.error('提取股票代码错误:', error)
    return null
  }
}

// 获取默认报告日期(最近一个季度末)
function getDefaultReportDate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1

  // 确定最近的季度末
  let reportDate: string

  if (month <= 3) {
    // 上一年第四季度
    reportDate = `${year - 1}1231`
  } else if (month <= 6) {
    // 当年第一季度
    reportDate = `${year}0331`
  } else if (month <= 9) {
    // 当年第二季度
    reportDate = `${year}0630`
  } else {
    // 当年第三季度
    reportDate = `${year}0930`
  }

  return reportDate
}

// 统一使用项目标准的消息格式
export async function executeResearchReportTool(
  params: ResearchReportToolParams,
  dataStream: DataStreamWriter
): Promise<SearchResults> {
  console.log('执行研报生成工具,原始参数:', params)

  try {
    // 搜索股票基本信息
    const basicQuery = `${params.stockName} 股票 公司简介 行业分析`
    console.log('搜索股票基本信息:', basicQuery)

    const basicSearchResults = await search(basicQuery, 5, 'advanced')

    // 使用标准的搜索结果消息格式
    dataStream.writeMessageAnnotation({
      type: 'display',
      display: {
        kind: 'search_results',
        title: '股票基本信息',
        query: basicQuery,
        results: basicSearchResults.results
      }
    })

    // 搜索最新研报信息
    const reportQuery = `${params.stockName} 最新研报 投资分析 财务数据`
    console.log('搜索研报信息:', reportQuery)

    const reportSearchResults = await search(reportQuery, 5, 'advanced')

    // 使用标准的搜索结果消息格式
    dataStream.writeMessageAnnotation({
      type: 'display',
      display: {
        kind: 'search_results',
        title: '最新研报信息',
        query: reportQuery,
        results: reportSearchResults.results
      }
    })

    // 合并所有搜索结果，用于前端显示
    const allSearchResults = [
      ...basicSearchResults.results,
      ...reportSearchResults.results
    ]

    // 在开始生成研报前先返回搜索结果
    dataStream.writeMessageAnnotation({
      type: 'search_results',
      data: {
        results: allSearchResults,
        query: `${params.stockName} 研究报告`
      }
    })

    // 简化工作流消息处理
    const workflowStream: WorkflowDataStream = {
      write: message => {
        console.log('工作流消息:', message)

        // 处理所有消息类型，确保前端能接收到进度
        if (message.type === 'display') {
          // 使用toJSONSafeMessage确保消息安全序列化
          const safeMessage = toJSONSafeMessage(message)
          dataStream.writeMessageAnnotation(safeMessage as JSONValue)
        } else if (
          message.type === 'workflow-progress' ||
          message.type === 'workflow-start' ||
          message.type === 'workflow-complete'
        ) {
          // 传递工作流状态更新
          dataStream.writeMessageAnnotation(
            toJSONSafeMessage(message) as JSONValue
          )
        }
      }
    }

    try {
      // 执行研报生成工作流
      const result = await executeResearchReportWorkflow(
        {
          stockCode:
            (await extractStockCode(params.stockName))?.stockCode || '',
          reportDate: params.reportDate || getDefaultReportDate(),
          reportType: params.reportType,
          additionalInfo: [
            ...basicSearchResults.results,
            ...reportSearchResults.results
          ],
          currentModel: params.currentModel
        },
        workflowStream
      )

      console.log('研报生成完成，结果长度:', result.length)

      // 格式化研报标题和内容
      const reportTitle = `# ${params.stockName}研究报告`
      const fullReport = `${reportTitle}\n\n${result}`

      // 移除重复的display消息，只保留研报结果类型消息
      dataStream.writeMessageAnnotation({
        type: 'research_report_result',
        data: fullReport
      })

      // 返回结果，符合SearchResults格式
      return {
        images: [],
        results: [
          {
            title: `${params.stockName}研究报告`,
            url: '',
            content: fullReport
          },
          ...allSearchResults
        ],
        query: `${params.stockName} 研究报告`
      }
    } catch (error) {
      console.error('生成研报时发生错误:', error)
      return {
        images: [],
        results: allSearchResults,
        query: `${params.stockName} 研究报告`
      }
    }
  } catch (error) {
    console.error('执行研报工具时发生错误:', error)
    return {
      images: [],
      results: [],
      query: `${params.stockName} 研究报告`
    }
  }
}
