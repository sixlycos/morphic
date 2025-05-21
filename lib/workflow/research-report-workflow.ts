import { generateResearchReport } from '../agents/research-report-agent'
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
    // 1. 获取股票基本信息
    dataStream.write({
      type: 'workflow-progress',
      message: '正在获取股票基本信息...',
      step: 1,
      percentage: 20
    })

    const basicInfo = await fetchStockBasicInfo({
      ts_code: params.stockCode
    })

    if (!basicInfo || basicInfo.length === 0) {
      throw new Error(`未找到股票信息: ${params.stockCode}`)
    }

    // 展示股票基本信息
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
      }
    })

    // 2. 获取财务数据
    dataStream.write({
      type: 'workflow-progress',
      message: '正在获取财务数据...',
      step: 2,
      percentage: 40
    })

    const financialData = await fetchFinancialData(
      params.stockCode,
      params.reportDate
    )

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
      }
    })

    // 3. 获取市场行情数据
    dataStream.write({
      type: 'workflow-progress',
      message: '正在获取市场行情数据...',
      step: 3,
      percentage: 60
    })

    // 获取近3个月的行情数据
    const endDate = params.reportDate
    const startDate = calculateStartDate(endDate, 90) // 获取90天前的日期

    const marketData = await fetchDailyData(
      params.stockCode,
      startDate,
      endDate
    )

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
      }
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

    // 5. 生成研报内容
    dataStream.write({
      type: 'workflow-progress',
      message: '正在生成研报内容...',
      step: 4,
      percentage: 80
    })

    const reportContent = await generateResearchReport(reportData)

    // 6. 处理完成
    dataStream.write({
      type: 'workflow-progress',
      message: '研报生成完成，正在优化展示...',
      step: 5,
      percentage: 100
    })

    // 在返回结果前记录日志
    console.log('研报工作流执行完成，准备返回数据')

    // 添加完成消息
    dataStream.write({
      type: 'workflow-complete',
      data: reportContent,
      message: '研报生成完成，请查看详细内容'
    })

    return reportContent
  } catch (error) {
    console.error('研报工作流执行失败:', error)
    dataStream.write({
      type: 'workflow-error',
      error: `研报生成失败: ${(error as Error).message}`,
      details: '处理过程中遇到了问题，请稍后再试',
      suggestion: '您可以尝试使用不同的股票名称或股票代码'
    })
    throw error
  }
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
