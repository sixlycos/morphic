import axios from 'axios'

// Tushare API响应接口
export interface TushareResponse {
  code: number
  msg: string
  data?: {
    fields: string[]
    items: any[][]
  }
}

// Tushare请求配置
interface TushareRequestConfig {
  cacheTime?: number // 缓存时间(毫秒)
  retries?: number // 重试次数
}

// 结果缓存
const apiCache = new Map<string, { data: any; timestamp: number }>()

// 调用Tushare API的核心函数
export async function callTushareApi(
  apiName: string,
  params: Record<string, any> = {},
  config: TushareRequestConfig = {}
): Promise<any> {
  try {
    // 生成缓存键
    const cacheKey = `${apiName}:${JSON.stringify(params)}`

    // 检查缓存
    if (config.cacheTime) {
      const cached = apiCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < config.cacheTime) {
        return cached.data
      }
    }

    // 获取当前页面URL基础部分
    let baseUrl = ''
    if (typeof window !== 'undefined') {
      // 客户端环境
      const url = new URL(window.location.href)
      baseUrl = `${url.protocol}//${url.host}`
    } else {
      // 服务端环境，使用环境变量或默认值
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    }

    // 通过服务端API代理调用Tushare
    const response = await axios.post(`${baseUrl}/api/tushare`, {
      api_name: apiName,
      params
    })

    const result = response.data

    // 检查Tushare API返回的错误
    if (result.code !== 0) {
      throw new Error(`Tushare错误: ${result.msg}`)
    }

    // 格式化返回结果为更易用的结构
    const formattedResult = formatTushareResult(result)

    // 更新缓存
    if (config.cacheTime) {
      apiCache.set(cacheKey, {
        data: formattedResult,
        timestamp: Date.now()
      })
    }

    return formattedResult
  } catch (error) {
    // 处理错误重试逻辑
    if (config.retries && config.retries > 0) {
      console.warn(`Tushare API调用失败，重试中... (${config.retries}次剩余)`)
      return callTushareApi(apiName, params, {
        ...config,
        retries: config.retries - 1
      })
    }

    console.error(`Tushare API Error (${apiName}):`, error)
    throw new Error(`调用Tushare API失败: ${(error as Error).message}`)
  }
}

// 格式化Tushare返回结果为更易用的对象数组
function formatTushareResult(result: TushareResponse) {
  if (!result.data || !result.data.items) {
    return []
  }

  const { fields, items } = result.data
  return items.map(row => {
    const obj: Record<string, any> = {}
    fields.forEach((field, index) => {
      obj[field] = row[index]
    })
    return obj
  })
}

// 研报生成相关的数据获取函数
export async function fetchStockBasicInfo(params = {}) {
  return callTushareApi('stock_basic', params, {
    cacheTime: 24 * 60 * 60 * 1000, // 24小时缓存
    retries: 3
  })
}

export async function fetchFinancialData(tsCode: string, period: string) {
  const [income, balance, cashflow, indicators] = await Promise.all([
    callTushareApi('income', { ts_code: tsCode, period }, { retries: 3 }),
    callTushareApi('balancesheet', { ts_code: tsCode, period }, { retries: 3 }),
    callTushareApi('cashflow', { ts_code: tsCode, period }, { retries: 3 }),
    callTushareApi(
      'fina_indicator',
      { ts_code: tsCode, period },
      { retries: 3 }
    )
  ])

  return {
    income,
    balance,
    cashflow,
    indicators
  }
}

export async function fetchDailyData(
  tsCode: string,
  startDate: string,
  endDate: string
) {
  return callTushareApi(
    'daily',
    {
      ts_code: tsCode,
      start_date: startDate,
      end_date: endDate
    },
    {
      cacheTime: 60 * 60 * 1000, // 1小时缓存
      retries: 3
    }
  )
}
