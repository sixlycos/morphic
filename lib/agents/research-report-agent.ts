import { generateText } from 'ai'
import { getModel } from '../utils/registry'
import { ResearchReportData } from '../workflow/research-report-workflow'

// 专业研报生成系统提示
const RESEARCH_REPORT_SYSTEM_PROMPT = `
# 金融投资研报专家
你是一位资深金融分析师,擅长撰写高质量的投资研究报告。你将基于提供的股票基本信息、财务数据和市场行情,生成一份专业、深度的投资研究报告。

## 研报撰写要求

### 总体风格
- 保持专业、客观的叙述风格
- 使用准确的金融术语
- 注重分析的深度和独特性
- 结合行业知识进行综合分析
- 注重数据之外的洞察

### 内容结构
1. **公司概况**
   - 公司基本情况及业务模式
   - 竞争优势及行业地位分析
   - 公司发展阶段判断
   - 核心产品/服务分析及市场份额

2. **财务分析**
   - **盈利能力分析**
     - 关键比率解读及同业对比
     - 收入与利润增长趋势及驱动因素
     - 毛利率变动原因分析
     - 利润结构及质量评估
   
   - **资产质量分析**
     - 资产结构及效率分析
     - 负债水平及风险评估
     - 现金流状况及可持续性
     - 财务健康度综合评价
   
   - **投资回报分析**
     - ROE分解分析(杜邦分析)
     - 资本配置效率评估
     - 股东回报趋势

3. **市场表现**
   - 股价走势关键拐点分析
   - 相对大盘/行业表现
   - 交易量及市场情绪解读
   - 估值水平分析及合理区间判断

4. **风险分析**
   - 行业系统性风险
   - 公司特有风险
   - 财务风险
   - 政策及监管风险
   - 市场风险

5. **投资建议**
   - 综合评级及理由
   - 投资逻辑及催化剂
   - 投资价值判断
   - 目标价及上升/下降空间
   - 关键风险提示

### 写作技巧
- 深入分析数据背后的业务含义
- 揭示非直观的关联与趋势
- 提供独到的行业见解
- 适当使用专业图表和可视化描述
- 以客观数据支持主观判断
- 关注异常数据及其可能含义
- 提出具有前瞻性的观点

## 注意事项
- 基于事实数据进行分析,避免无根据的猜测
- 既要挖掘亮点,也要指出隐患
- 投资建议必须有明确的依据和逻辑
- 语言保持专业简洁,避免过度营销式表述
- 分析要具有洞察力和实用价值
- 尤其注重发现数据中的异常、变化和趋势
- 默认为中国A股市场公司撰写研报

以Markdown格式输出整个研报内容。
`

export async function generateResearchReport(
  data: ResearchReportData
): Promise<string> {
  console.log('开始生成研报,数据概览:', {
    公司名称: data.basicInfo.name,
    行业: data.basicInfo.industry,
    财务数据条目数: {
      income: data.financialData.income.length,
      balance: data.financialData.balance.length,
      cashflow: data.financialData.cashflow.length,
      indicators: data.financialData.indicators.length
    },
    市场数据条目数: data.marketData.length
  })

  // 准备用于AI的输入数据
  const inputData = {
    basicInfo: data.basicInfo,
    // 选择关键财务指标
    financialData: {
      income: data.financialData.income.slice(0, 3), // 最近3期利润表
      balance: data.financialData.balance.slice(0, 3), // 最近3期资产负债表
      cashflow: data.financialData.cashflow.slice(0, 3), // 最近3期现金流量表
      indicators: data.financialData.indicators.slice(0, 3) // 最近3期财务指标
    },
    // 市场数据精简版
    marketData: {
      latest: data.marketData[data.marketData.length - 1],
      oldest: data.marketData[0],
      count: data.marketData.length,
      // 计算关键指标
      highestPrice: Math.max(...data.marketData.map(d => d.high)),
      lowestPrice: Math.min(...data.marketData.map(d => d.low)),
      averageVolume:
        data.marketData.reduce((sum, d) => sum + d.vol, 0) /
        data.marketData.length,
      priceChange: (
        ((data.marketData[data.marketData.length - 1].close -
          data.marketData[0].close) /
          data.marketData[0].close) *
        100
      ).toFixed(2)
    },
    // 添加额外研报信息，如果有的话
    additionalInfo: data.additionalInfo || []
  }

  try {
    // 直接使用传入的模型ID，如果没有则回退到环境变量配置的模型
    let modelId = data.currentModel // 优先使用传入的模型ID

    // 如果没有传入模型ID，尝试其他方式获取
    if (!modelId) {
      try {
        // 尝试通过全局变量获取当前上下文中已选择的模型
        if (
          typeof window !== 'undefined' &&
          window.__NEXT_DATA__?.props?.pageProps?.model
        ) {
          modelId = window.__NEXT_DATA__.props.pageProps.model
        } else if (typeof localStorage !== 'undefined') {
          const storedModel = localStorage.getItem('selectedModel')
          if (storedModel) {
            modelId = JSON.parse(storedModel).id
          }
        }
      } catch (e) {
        console.log('获取用户模型失败，使用默认模型:', e)
      }
    }

    // 如果仍无法获取用户模型，使用环境变量中配置的模型或默认模型
    if (!modelId) {
      modelId = process.env.REPORT_MODEL || 'openai:gpt-4' // 使用正确的模型ID格式
    }

    // 确保模型ID符合格式要求
    if (!modelId.includes(':')) {
      // 如果没有provider前缀，默认添加openai
      modelId = `openai:${modelId}`
    }

    console.log('使用模型生成研报:', modelId)

    // 调用AI生成研报
    const reportResponse = await generateText({
      model: getModel(modelId),
      system: RESEARCH_REPORT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `请基于以下数据生成一份专业的投资研究报告:\n\n${JSON.stringify(
            inputData,
            null,
            2
          )}`
        }
      ]
    })

    return reportResponse.text
  } catch (error) {
    console.error('AI生成研报失败:', error)
    // 如果AI生成失败,回退到模板方法
    return generateTemplateReport(data)
  }
}

// 模板方法作为备选(当AI生成失败时使用)
function generateTemplateReport(data: ResearchReportData): string {
  const { basicInfo } = data

  // 从财务数据中获取最新一期数据
  const income = data.financialData.income[0] || {}
  const balance = data.financialData.balance[0] || {}
  const cashflow = data.financialData.cashflow[0] || {}
  const indicators = data.financialData.indicators[0] || {}

  // 从市场数据中获取信息
  const latestPrice = data.marketData[data.marketData.length - 1] || {}
  const firstPrice = data.marketData[0] || {}
  const priceChange = firstPrice.close
    ? (
        ((latestPrice.close - firstPrice.close) / firstPrice.close) *
        100
      ).toFixed(2)
    : 'N/A'

  return `# ${basicInfo.name}(${basicInfo.ts_code}) 研究报告

## 公司概况

${basicInfo.name}是一家${basicInfo.industry}行业的上市公司,于${
    basicInfo.list_date || '未知日期'
  }在${basicInfo.exchange || '中国'}上市。公司位于${
    basicInfo.area || '中国'
  },是行业内的重要参与者。

## 财务分析

### 盈利能力
- 营业收入: ${formatNumber(income.total_revenue)} 元
- 净利润: ${formatNumber(income.n_income)} 元
- 每股收益: ${indicators.eps || 'N/A'} 元
- 毛利率: ${
    indicators.grossprofit_margin
      ? (indicators.grossprofit_margin * 100).toFixed(2)
      : 'N/A'
  }%

公司盈利能力指标表现${
    indicators.grossprofit_margin > 0.2 ? '较强' : '一般'
  },需持续关注收入增长的可持续性。

### 资产状况
- 总资产: ${formatNumber(balance.total_assets)} 元
- 总负债: ${formatNumber(balance.total_liab)} 元
- 所有者权益: ${formatNumber(balance.total_hldr_eqy_exc_min_int)} 元
- 资产负债率: ${
    balance.total_assets
      ? ((balance.total_liab / balance.total_assets) * 100).toFixed(2)
      : 'N/A'
  }%

资产结构${
    balance.total_assets && balance.total_liab / balance.total_assets < 0.5
      ? '较为稳健'
      : '存在一定风险'
  },负债水平${
    balance.total_assets && balance.total_liab / balance.total_assets < 0.5
      ? '可控'
      : '需关注'
  }。

### 现金流
- 经营活动现金流: ${formatNumber(cashflow.n_cashflow_act)} 元
- 投资活动现金流: ${formatNumber(cashflow.n_cashflow_inv_act)} 元
- 筹资活动现金流: ${formatNumber(cashflow.n_cash_flows_fnc_act)} 元

现金流状况${
    cashflow.n_cashflow_act > 0
      ? '良好,经营活动产生正向现金流'
      : '存在一定压力,需关注经营活动现金流改善'
  }。

## 市场表现

- 当前价格: ${latestPrice.close || 'N/A'} 元
- 期间涨跌幅: ${priceChange}%
- 最高价: ${Math.max(...data.marketData.map(d => d.high))} 元
- 最低价: ${Math.min(...data.marketData.map(d => d.low))} 元

股价表现${
    priceChange !== 'N/A' && Number(priceChange) > 0 ? '积极' : '低于预期'
  },市场情绪${
    priceChange !== 'N/A'
      ? Number(priceChange) > 10
        ? '乐观'
        : Number(priceChange) < -10
        ? '悲观'
        : '中性'
      : '不明确'
  }。

## 风险分析

1. 行业风险
   - ${basicInfo.industry}行业周期性波动风险
   - 行业政策变动风险
   - 市场竞争加剧风险

2. 公司风险
   - 经营风险: 业务模式可持续性
   - 财务风险: ${
     balance.total_assets && balance.total_liab / balance.total_assets > 0.6
       ? '负债率偏高'
       : '整体可控'
   }
   - 管理风险: 运营效率及治理结构

3. 市场风险
   - 宏观经济波动风险
   - 股市系统性风险
   - 流动性风险

## 投资建议

${generateInvestmentAdvice(data)}

*本研报仅供参考,不构成任何投资建议。投资者据此操作,风险自担。*`
}

// 生成投资建议
function generateInvestmentAdvice(data: ResearchReportData): string {
  const { financialData, marketData } = data
  const indicators = financialData.indicators[0] || {}
  const latestPrice = marketData[marketData.length - 1]?.close

  // 检查是否有足够的数据进行分析
  if (
    !latestPrice ||
    !indicators.eps ||
    typeof indicators.eps !== 'number' ||
    indicators.eps <= 0
  ) {
    return `基于当前可获取的数据,暂无法给出明确投资建议。建议投资者进一步关注公司后续经营数据及行业动态。`
  }

  // 计算PE值
  const pe = Number(latestPrice) / Number(indicators.eps)

  // 投资评级判断
  let advice = '谨慎推荐'
  let reason = '基于当前估值水平及行业地位'

  if (typeof pe === 'number' && !isNaN(pe)) {
    if (pe < 15) {
      advice = '推荐'
      reason = '当前估值处于合理区间,具有一定投资价值'
      if (pe < 10) {
        advice = '强烈推荐'
        reason = '当前估值偏低,具有较好的投资价值'
      }
    } else if (pe > 30) {
      advice = '中性'
      reason = '当前估值偏高,需关注盈利增长的持续性'
      if (pe > 50) {
        advice = '谨慎'
        reason = '当前估值显著偏高,建议等待更好的买入时机'
      }
    }
  }

  // 估值相对行业水平评价
  let peCompareText = '接近'
  if (typeof pe === 'number' && !isNaN(pe)) {
    if (pe < 20) {
      peCompareText = '低于'
    } else if (pe > 30) {
      peCompareText = '高于'
    }
  }

  // 财务状况评价
  let financialStatus = '一般,盈利能力有待提升'
  if (
    typeof indicators.grossprofit_margin === 'number' &&
    indicators.grossprofit_margin > 0.2
  ) {
    financialStatus = '良好,具有较强盈利能力'
  }

  // 成长性评价
  const yoy_sales_growth =
    typeof indicators.yoy_sales_growth === 'number'
      ? indicators.yoy_sales_growth
      : 0
  let growthComment = '收入增速放缓或下滑'
  if (yoy_sales_growth > 0.15) {
    growthComment = '强劲,收入保持高增长'
  } else if (yoy_sales_growth > 0) {
    growthComment = '稳定,收入保持增长'
  }

  // 构建投资建议文本
  return `投资评级: **${advice}**

投资逻辑:
1. 估值水平: PE ${
    typeof pe === 'number' && !isNaN(pe) ? pe.toFixed(2) : 'N/A'
  }倍,${peCompareText}行业平均水平
2. 行业地位: ${data.basicInfo.industry}行业内的重要企业
3. 财务状况: ${financialStatus}
4. 成长性: ${growthComment}

${reason}`
}

// 格式化数字为易读格式
function formatNumber(num: number): string {
  if (num === undefined || num === null) return 'N/A'

  // 处理大数值,使用万/亿为单位
  if (Math.abs(num) >= 1e8) {
    return (num / 1e8).toFixed(2) + '亿'
  } else if (Math.abs(num) >= 1e4) {
    return (num / 1e4).toFixed(2) + '万'
  } else {
    return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0'
  }
}
