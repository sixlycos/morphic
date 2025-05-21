import { DataStreamWriter } from 'ai'
import { z } from 'zod'
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

// 研报生成工具执行函数
export async function executeResearchReportTool(
  params: ResearchReportToolParams,
  dataStream: DataStreamWriter
): Promise<string> {
  console.log('执行研报生成工具,原始参数:', params)

  try {
    // 1. 搜索股票基本信息
    const basicQuery = `${params.stockName} 股票 公司简介 行业分析`
    console.log('搜索股票基本信息:', basicQuery)

    const basicSearchResults = await search(basicQuery, 5, 'advanced')

    // 展示基本信息搜索结果
    dataStream.writeData({
      type: 'display',
      display: {
        kind: 'search_results',
        title: '股票基本信息',
        query: basicQuery,
        results: basicSearchResults.results.map(r => ({
          title: r.title,
          content: r.content,
          url: r.url
        }))
      }
    })

    // 2. 搜索最新研报信息
    const reportQuery = `${params.stockName} 最新研报 投资分析 财务数据`
    console.log('搜索研报信息:', reportQuery)

    const reportSearchResults = await search(reportQuery, 5, 'advanced')

    // 展示研报搜索结果
    dataStream.writeData({
      type: 'display',
      display: {
        kind: 'search_results',
        title: '最新研报信息',
        query: reportQuery,
        results: reportSearchResults.results.map(r => ({
          title: r.title,
          content: r.content,
          url: r.url
        }))
      }
    })

    // 创建适配器将DataStreamWriter转换为WorkflowDataStream
    const workflowStream: WorkflowDataStream = {
      write: message => {
        console.log('工作流消息:', message)
        dataStream.writeData(toJSONSafeMessage(message))

        // 如果是完成消息且有数据，添加注释
        if (message.type === 'workflow-complete' && message.data) {
          console.log('工作流完成，添加研报数据注释')
          dataStream.writeMessageAnnotation({
            type: 'research_report',
            data: message.data
          })
        }
      }
    }

    try {
      // 1. 发送开始工作流的消息
      workflowStream.write({
        type: 'workflow-start',
        message: `开始生成${params.stockName}的研究报告`,
        display: {
          kind: 'workflow',
          status: 'start',
          title: `${params.stockName} 投资研究报告生成`,
          steps: [
            '股票信息查询',
            '财务数据分析',
            '市场数据分析',
            '行业对比分析',
            '研报内容生成'
          ]
        },
        step: 0,
        percentage: 0
      })

      // 2. 查询股票基本信息
      workflowStream.write({
        type: 'workflow-progress',
        message: `正在查询${params.stockName}的股票信息...`,
        step: 1,
        percentage: 20
      })

      // 3. 提取股票代码
      const stockInfo = await extractStockCode(params.stockName)
      if (!stockInfo) {
        throw new Error(
          `无法找到${params.stockName}的股票代码,请提供准确的股票名称`
        )
      }

      // 4. 更新进度
      workflowStream.write({
        type: 'workflow-progress',
        message: `已确认股票代码: ${stockInfo.stockCode}, 正在获取财务数据...`,
        step: 2,
        percentage: 50
      })

      // 5. 确定报告日期
      const reportDate = params.reportDate || getDefaultReportDate()

      // 6. 构建完整的研报参数
      const reportParams = {
        stockCode: stockInfo.stockCode,
        reportDate: reportDate,
        reportType: params.reportType,
        // 添加额外的参数，包括研报搜索结果和当前用户模型
        additionalInfo: reportSearchResults.results.slice(0, 3).map(r => ({
          title: r.title,
          content: r.content,
          url: r.url
        })),
        currentModel: params.currentModel
      }

      console.log('执行研报生成工具,处理后参数:', reportParams)

      // 7. 执行研报生成工作流
      const result = await executeResearchReportWorkflow(
        reportParams,
        workflowStream
      )
      console.log('研报生成完成，结果长度:', result.length)
      return result
    } catch (error) {
      console.error('研报生成工具执行错误:', error)
      workflowStream.write({
        type: 'workflow-error',
        error: `研报生成失败: ${(error as Error).message}`,
        details: '在处理股票数据时遇到了问题',
        suggestion: '请尝试使用完整的股票名称或股票代码'
      })
      throw error
    }
  } catch (error) {
    console.error('研报生成工具执行错误:', error)
    throw error
  }
}
