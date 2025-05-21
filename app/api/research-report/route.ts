import { WorkflowMessage } from '@/lib/types/workflow'
import {
  executeResearchReportWorkflow,
  ResearchReportParams
} from '@/lib/workflow/research-report-workflow'
import { createDataStreamResponse } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = (await req.json()) as ResearchReportParams

    // 参数验证
    if (!params.stockCode) {
      return NextResponse.json({ error: '股票代码不能为空' }, { status: 400 })
    }

    if (!params.reportDate) {
      return NextResponse.json({ error: '报告日期不能为空' }, { status: 400 })
    }

    // 创建流式响应
    const streamResponse = createDataStreamResponse({
      execute: async dataStream => {
        // 创建工作流数据流适配器
        const workflowStream = {
          write: (message: WorkflowMessage) => {
            dataStream.write(message as any)
          }
        }

        await executeResearchReportWorkflow(params, workflowStream)
      },
      onError: error => {
        console.error('研报生成错误:', error)
        return error instanceof Error ? error.message : String(error)
      }
    })

    return streamResponse
  } catch (error) {
    console.error('研报生成API错误:', error)
    return NextResponse.json(
      { error: `研报生成失败: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
