import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { api_name, params } = await req.json()

    // 安全检查 - 防止未授权访问
    // TODO: 后续添加认证和授权检查

    const response = await fetch(
      // 使用官方API地址: http://api.tushare.pro
      process.env.TUSHARE_API_URL || 'http://api.tushare.pro',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_name,
          token: process.env.TUSHARE_TOKEN,
          params,
          fields: '' // 默认获取所有字段
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Tushare API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // 检查 Tushare API 返回的错误码
    if (data.code !== 0) {
      throw new Error(`Tushare API error: ${data.msg}`)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Tushare API error:', error)
    return NextResponse.json(
      { error: `调用Tushare API失败: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
