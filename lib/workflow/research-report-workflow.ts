import { streamingResearchReport } from '../agents/research-report-agent'
import {
  fetchDailyData,
  fetchFinancialData,
  fetchStockBasicInfo
} from '../services/tushare-service'
import { WorkflowDataStream } from '../types/workflow'

export interface ResearchReportParams {
  stockCode: string // 股票代码
  reportDate: string // 报告日期(YYYYMMDD)
  reportType?: string // 报告类型(年报/季报等)
  // 添加额外信息字段，用于存储研报搜索结果
  additionalInfo?: Array<{
    title: string
    content: string
    url: string
  }>
  // 添加当前用户选择的模型ID
  currentModel?: string
}

export interface ResearchReportData {
  basicInfo: any // 股票基本信息
  financialData: {
    // 财务数据
    income: any[] // 利润表
    balance: any[] // 资产负债表
    cashflow: any[] // 现金流量表
    indicators: any[] // 财务指标
  }
  marketData: any[] // 市场行情数据
  // 添加额外信息字段，用于存储研报搜索结果
  additionalInfo?: Array<{
    title: string
    content: string
    url: string
  }>
  // 添加当前用户选择的模型ID
  currentModel?: string
}

// 研报生成工作流执行函数
export async function executeResearchReportWorkflow(
  params: ResearchReportParams,
  dataStream: WorkflowDataStream
): Promise<string> {
  console.log('研报工作流开始执行，参数:', {
    stockCode: params.stockCode,
    reportDate: params.reportDate,
    hasAdditionalInfo: !!params.additionalInfo,
    model: params.currentModel
  })

  try {
    // 发送工作流开始事件
    dataStream.write({
      type: 'step-start',
      message: '研报生成开始',
      data: {
        stockCode: params.stockCode,
        reportDate: params.reportDate
      },
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 1. 获取股票基本信息 - 作为工具调用记录
    dataStream.write({
      type: 'step-start',
      message: '正在获取股票基本信息...',
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 记录工具调用开始
    const stockInfoToolCallId = generateToolCallId()
    const stockInfoToolInvocation = {
      toolName: 'fetchStockInfo',
      toolCallId: stockInfoToolCallId,
      args: { ts_code: params.stockCode },
      state: 'running' as const
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '正在获取股票基础信息',
      data: stockInfoToolInvocation,
      toolInvocations: [stockInfoToolInvocation] // 添加toolInvocations数组
    })

    const basicInfo = await fetchStockBasicInfo({
      ts_code: params.stockCode
    })

    if (!basicInfo || basicInfo.length === 0) {
      // 记录工具调用失败
      const errorToolInvocation = {
        toolName: 'fetchStockInfo',
        toolCallId: stockInfoToolCallId,
        state: 'error' as const,
        error: `未找到股票信息: ${params.stockCode}`
      }

      dataStream.write({
        type: 'tool-invocation',
        message: '获取股票信息失败',
        data: errorToolInvocation,
        toolInvocations: [errorToolInvocation] // 添加toolInvocations数组
      })
      throw new Error(`未找到股票信息: ${params.stockCode}`)
    }

    // 记录工具调用结果
    const stockInfoResultInvocation = {
      toolName: 'fetchStockInfo',
      toolCallId: stockInfoToolCallId,
      state: 'result' as const,
      result: {
        basicInfo: basicInfo[0]
      }
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '股票基础信息获取完成',
      data: stockInfoResultInvocation,
      toolInvocations: [stockInfoResultInvocation] // 添加toolInvocations数组
    })

    // 使用标准的display类型消息
    // 展示股票基本信息
    dataStream.write({
      type: 'workflow-progress',
      message: '获取股票基本信息完成',
      step: 1,
      percentage: 25,
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    dataStream.write({
      type: 'display',
      display: {
        kind: 'stock-info',
        title: `股票信息: ${basicInfo[0].name} (${params.stockCode})`,
        content: {
          name: basicInfo[0].name,
          code: params.stockCode,
          industry: basicInfo[0].industry,
          area: basicInfo[0].area,
          market: basicInfo[0].market,
          listDate: basicInfo[0].list_date
        }
      },
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 2. 获取财务数据 - 作为工具调用记录
    dataStream.write({
      type: 'step-start',
      message: '正在获取财务数据...',
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 记录工具调用开始
    const financialDataToolCallId = generateToolCallId()
    const financialDataInvocation = {
      toolName: 'fetchFinancialData',
      toolCallId: financialDataToolCallId,
      args: {
        ts_code: params.stockCode,
        report_date: params.reportDate
      },
      state: 'running' as const
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '正在获取财务数据',
      data: financialDataInvocation,
      toolInvocations: [financialDataInvocation] // 添加toolInvocations数组
    })

    const financialData = await fetchFinancialData(
      params.stockCode,
      params.reportDate
    )

    // 记录工具调用结果
    const financialDataResultInvocation = {
      toolName: 'fetchFinancialData',
      toolCallId: financialDataToolCallId,
      state: 'result' as const,
      result: {
        incomeCount: financialData.income.length,
        balanceCount: financialData.balance.length,
        cashflowCount: financialData.cashflow.length,
        indicatorsCount: financialData.indicators.length
      }
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '财务数据获取完成',
      data: financialDataResultInvocation,
      toolInvocations: [financialDataResultInvocation] // 添加toolInvocations数组
    })

    dataStream.write({
      type: 'workflow-progress',
      message: '获取财务数据完成',
      step: 2,
      percentage: 40,
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 展示获取到的财务数据数量
    dataStream.write({
      type: 'display',
      display: {
        kind: 'financial-info',
        title: '财务数据概览',
        content: {
          income: financialData.income.length + '条记录',
          balance: financialData.balance.length + '条记录',
          cashflow: financialData.cashflow.length + '条记录',
          indicators: financialData.indicators.length + '条记录'
        }
      },
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 3. 获取市场行情数据 - 作为工具调用记录
    dataStream.write({
      type: 'step-start',
      message: '正在获取市场行情数据...',
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 获取近3个月的行情数据
    const endDate = params.reportDate
    const startDate = calculateStartDate(endDate, 90) // 获取90天前的日期

    // 记录工具调用开始
    const marketDataToolCallId = generateToolCallId()
    const marketDataInvocation = {
      toolName: 'fetchMarketData',
      toolCallId: marketDataToolCallId,
      args: {
        ts_code: params.stockCode,
        start_date: startDate,
        end_date: endDate
      },
      state: 'running' as const
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '正在获取市场行情数据',
      data: marketDataInvocation,
      toolInvocations: [marketDataInvocation] // 添加toolInvocations数组
    })

    const marketData = await fetchDailyData(
      params.stockCode,
      startDate,
      endDate
    )

    // 计算价格变动百分比
    const priceChangePercent =
      marketData.length > 0
        ? ((marketData[marketData.length - 1].close - marketData[0].close) /
            marketData[0].close) *
          100
        : 0

    // 记录工具调用结果
    const marketDataResultInvocation = {
      toolName: 'fetchMarketData',
      toolCallId: marketDataToolCallId,
      state: 'result' as const,
      result: {
        daysCount: marketData.length,
        startDate,
        endDate,
        startPrice: marketData[0]?.close,
        endPrice: marketData[marketData.length - 1]?.close,
        priceChange: priceChangePercent.toFixed(2) + '%'
      }
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '市场行情数据获取完成',
      data: marketDataResultInvocation,
      toolInvocations: [marketDataResultInvocation] // 添加toolInvocations数组
    })

    dataStream.write({
      type: 'workflow-progress',
      message: '获取市场数据完成',
      step: 3,
      percentage: 60,
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 展示市场数据概览
    dataStream.write({
      type: 'display',
      display: {
        kind: 'market-info',
        title: '市场行情概览',
        content: {
          dataPoints: marketData.length + '个交易日',
          startDate: startDate,
          endDate: endDate,
          startPrice: marketData[0]?.close,
          endPrice: marketData[marketData.length - 1]?.close,
          priceChange:
            marketData.length > 0
              ? (
                  ((marketData[marketData.length - 1].close -
                    marketData[0].close) /
                    marketData[0].close) *
                  100
                ).toFixed(2) + '%'
              : 'N/A'
        }
      },
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 4. 整合数据
    const reportData: ResearchReportData = {
      basicInfo: basicInfo[0], // 取第一条记录
      financialData,
      marketData,
      // 包含额外的研报信息
      additionalInfo: params.additionalInfo,
      // 添加当前用户选择的模型ID
      currentModel: params.currentModel
    }

    // 5. 使用流式生成研报内容
    dataStream.write({
      type: 'step-start',
      message: '正在生成研报内容...',
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    dataStream.write({
      type: 'workflow-progress',
      message: '正在生成研报内容...',
      step: 4,
      percentage: 70,
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 记录模型调用开始
    const reportGenerationToolCallId = generateToolCallId()
    const reportGenerationInvocation = {
      toolName: 'generateResearchReport',
      toolCallId: reportGenerationToolCallId,
      args: {
        stockName: basicInfo[0].name,
        stockCode: params.stockCode,
        industry: basicInfo[0].industry,
        modelId: params.currentModel || '默认模型'
      },
      state: 'running' as const
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '正在生成投资研报',
      data: reportGenerationInvocation,
      toolInvocations: [reportGenerationInvocation] // 添加toolInvocations数组
    })

    // 添加一个固定的进度更新
    dataStream.write({
      type: 'workflow-progress',
      message: '正在生成研报内容...',
      step: 4,
      percentage: 85,
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 使用新的流式生成方法
    const reportResult = await streamingResearchReport(reportData, {
      // 只处理错误，不再使用部分内容回调
      onError: error => {
        console.error('研报生成出错:', error)

        // 记录工具调用失败
        const errorInvocation = {
          toolName: 'generateResearchReport',
          toolCallId: reportGenerationToolCallId,
          state: 'error' as const,
          error: error.message
        }

        dataStream.write({
          type: 'tool-invocation',
          message: '研报生成失败',
          data: errorInvocation,
          toolInvocations: [errorInvocation] // 添加toolInvocations数组
        })

        dataStream.write({
          type: 'error',
          message: `研报生成出错: ${error.message}`,
          error: error.message,
          toolInvocations: [errorInvocation] // 添加toolInvocations数组
        })
      }
    })

    // 记录模型调用完成
    const reportResultInvocation = {
      toolName: 'generateResearchReport',
      toolCallId: reportGenerationToolCallId,
      state: 'result' as const,
      result: {
        reportLength: reportResult.content?.length || 0
      }
    }

    dataStream.write({
      type: 'tool-invocation',
      message: '投资研报生成完成',
      data: reportResultInvocation,
      toolInvocations: [reportResultInvocation] // 添加toolInvocations数组
    })

    // 6. 处理完成
    dataStream.write({
      type: 'step-start',
      message: '研报生成完成，正在优化展示...',
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    dataStream.write({
      type: 'workflow-progress',
      message: '研报生成完成，正在优化展示...',
      step: 5,
      percentage: 95,
      toolInvocations: [] // 添加空的toolInvocations字段
    })

    // 清理研报内容，去除Markdown标记
    const cleanReport = reportResult.content
      ? reportResult.content.replace(/```markdown\n|\n```/g, '')
      : ''

    // 最终结果工具调用
    const finalReportInvocation = {
      toolName: 'finalizeResearchReport',
      toolCallId: generateToolCallId(),
      state: 'result' as const,
      result: {
        reportLength: cleanReport.length
      }
    }

    // 直接在workflow-complete中发送研报内容，不再使用text类型消息
    dataStream.write({
      type: 'workflow-complete',
      data: {
        completed: true,
        length: cleanReport.length,
        content: cleanReport // 在这里传递研报内容
      },
      message: '研报生成完成，请查看详细内容',
      toolInvocations: [finalReportInvocation] // 添加toolInvocations数组
    })

    // 添加简洁日志和完成标记
    console.log('========== 研报工作流执行完成 ==========')
    console.log('研报数据长度:', reportResult.content?.length || 0)
    console.log('===========================================')

    // 确保有有效数据但不再返回文本内容
    if (
      !reportResult.content ||
      typeof reportResult.content !== 'string' ||
      reportResult.content.trim().length === 0
    ) {
      console.error('警告：研报内容为空或无效！')
      throw new Error('研报生成失败：内容为空或无效')
    }

    // 返回完整的研报内容
    return cleanReport
  } catch (error) {
    console.error('研报工作流执行失败:', error)

    const errorInvocation = {
      toolName: 'researchReportWorkflow',
      toolCallId: generateToolCallId(),
      state: 'error' as const,
      error: (error as Error).message
    }

    dataStream.write({
      type: 'workflow-error',
      error: `研报生成失败: ${(error as Error).message}`,
      details: '处理过程中遇到了问题，请稍后再试',
      suggestion: '您可以尝试使用不同的股票名称或股票代码',
      toolInvocations: [errorInvocation] // 添加toolInvocations数组
    })
    throw error
  }
}

// 生成唯一工具调用ID
function generateToolCallId(): string {
  return `call_${Math.random().toString(36).substring(2, 15)}`
}

// 计算起始日期
function calculateStartDate(endDate: string, days: number): string {
  const date = new Date(
    parseInt(endDate.slice(0, 4)),
    parseInt(endDate.slice(4, 6)) - 1,
    parseInt(endDate.slice(6, 8))
  )
  date.setDate(date.getDate() - days)

  return (
    date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0')
  )
}
