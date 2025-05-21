import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
import { executeResearchReportTool } from '@/lib/tools/research-report-tool'
import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'
import { createDataStreamResponse } from 'ai'
import { cookies } from 'next/headers'

export const maxDuration = 30

const DEFAULT_MODEL: Model = {
  id: 'openai:gpt-4',
  name: 'GPT-4',
  provider: 'OpenAI',
  providerId: 'openai',
  enabled: true,
  toolCallType: 'native'
}

// 检查是否为股票名称的函数
function isStockNameRequest(message: string): boolean {
  // 去除空格
  const trimmedMessage = message.trim()

  // 如果是数字（可能是股票代码），长度为6位，则认为是股票代码
  if (/^\d{6}$/.test(trimmedMessage)) {
    console.log('检测到股票代码:', trimmedMessage)
    return true
  }

  // 常见股票名称的关键词
  const stockKeywords = [
    '股份',
    '证券',
    '银行',
    '保险',
    '科技',
    '集团',
    '医药',
    '能源',
    '电子',
    '汽车',
    '食品'
  ]
  for (const keyword of stockKeywords) {
    if (trimmedMessage.includes(keyword)) {
      console.log('检测到包含股票相关关键词:', keyword)
      return true
    }
  }

  // 常见股票名称
  const commonStocks = [
    '茅台',
    '腾讯',
    '阿里',
    '京东',
    '比亚迪',
    '宁德时代',
    '中国平安',
    '招商银行',
    '贵州茅台'
  ]
  for (const stock of commonStocks) {
    if (trimmedMessage === stock) {
      console.log('检测到常见股票名称:', stock)
      return true
    }
  }

  // 只有单个短文本且不包含特殊指令的情况下才视为股票名称
  if (trimmedMessage.length > 20) {
    return false
  }

  // 排除常见的命令和问题格式
  if (
    trimmedMessage.includes('?') ||
    trimmedMessage.includes('？') ||
    trimmedMessage.includes('什么') ||
    trimmedMessage.includes('如何') ||
    trimmedMessage.includes('怎么') ||
    trimmedMessage.includes('是否') ||
    trimmedMessage.includes('请问')
  ) {
    return false
  }

  // 如果是较短的词语（2-4个字符），可能是股票名称
  if (trimmedMessage.length >= 2 && trimmedMessage.length <= 6) {
    console.log('检测到可能的股票名称:', trimmedMessage)
    return true
  }

  return false
}

export async function POST(req: Request) {
  try {
    const { messages, id: chatId } = await req.json()
    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')
    const userId = await getCurrentUserId()

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    // 检查是否是一键研报请求
    const cookieStore = await cookies()
    const selectedToolsJson = cookieStore.get('selectedTools')?.value
    let selectedTools: string[] = []

    if (selectedToolsJson) {
      try {
        selectedTools = JSON.parse(selectedToolsJson)
      } catch (e) {
        console.error('Failed to parse selected tools:', e)
      }
    }

    // 获取搜索模式状态
    const searchModeValue = cookieStore.get('search-mode')?.value
    // 默认开启搜索模式
    const searchMode =
      searchModeValue === undefined ? true : searchModeValue === 'true'

    console.log('工具状态:', {
      selectedTools,
      searchMode,
      lastMessage: messages[messages.length - 1]?.content
    })

    // 如果启用了研报工具并且输入是可能的股票名称
    const lastMessage = messages[messages.length - 1]?.content || ''
    const isResearchToolEnabled = selectedTools.includes('research_report')

    if (isResearchToolEnabled && isStockNameRequest(lastMessage)) {
      console.log('检测到股票查询请求:', lastMessage)

      // 常规聊天处理 - 移到此处以便能获取用户模型
      const modelJson = cookieStore.get('selectedModel')?.value
      let selectedModel = DEFAULT_MODEL

      if (modelJson) {
        try {
          selectedModel = JSON.parse(modelJson) as Model
        } catch (e) {
          console.error('Failed to parse selected model:', e)
        }
      }

      // 确保模型ID符合格式要求
      if (selectedModel.id && !selectedModel.id.includes(':')) {
        selectedModel.id = `${selectedModel.providerId}:${selectedModel.id}`
      }

      console.log('研报生成使用模型:', selectedModel.id)

      return createDataStreamResponse({
        execute: async dataStream => {
          try {
            await executeResearchReportTool(
              {
                stockName: lastMessage,
                // 添加模型信息
                currentModel: selectedModel.id
              },
              dataStream
            )
          } catch (error) {
            console.error('研报生成失败:', error)
            // 使用writeData方法写入错误信息，该方法接受JSON值
            dataStream.writeData({
              type: 'workflow-error',
              error: `无法生成研报: ${(error as Error).message}`,
              details: '处理研报数据时出现问题',
              suggestion: '请检查您的网络连接或稍后再试'
            })
          }
        }
      })
    }

    // 常规聊天处理
    const modelJson = cookieStore.get('selectedModel')?.value

    let selectedModel = DEFAULT_MODEL

    if (modelJson) {
      try {
        selectedModel = JSON.parse(modelJson) as Model
      } catch (e) {
        console.error('Failed to parse selected model:', e)
      }
    }

    if (
      !isProviderEnabled(selectedModel.providerId) ||
      selectedModel.enabled === false
    ) {
      return new Response(
        `Selected provider is not enabled ${selectedModel.providerId}`,
        {
          status: 404,
          statusText: 'Not Found'
        }
      )
    }

    const supportsToolCalling = selectedModel.toolCallType === 'native'

    // 打印模型和工具状态调试信息
    console.log('模型和工具状态:', {
      model: selectedModel.id,
      supportsToolCalling,
      searchMode
    })

    return supportsToolCalling
      ? createToolCallingStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId
        })
      : createManualToolStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId
        })
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
