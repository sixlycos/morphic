import { researcher } from '@/lib/agents/researcher'
import {
  convertToCoreMessages,
  CoreMessage,
  createDataStreamResponse,
  DataStreamWriter,
  streamText
} from 'ai'
import { getMaxAllowedTokens, truncateMessages } from '../utils/context-window'
import { isReasoningModel } from '../utils/registry'
import { handleStreamFinish } from './handle-stream-finish'
import { BaseStreamConfig } from './types'

// Function to check if a message contains ask_question tool invocation
function containsAskQuestionTool(message: CoreMessage) {
  // For CoreMessage format, we check the content array
  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return false
  }

  // Check if any content item is a tool-call with ask_question tool
  return message.content.some(
    item => item.type === 'tool-call' && item.toolName === 'ask_question'
  )
}

// 检查是否是研报生成模式
function isResearchReportMode(messages: CoreMessage[]): boolean {
  // 检查最后一条用户消息是否包含研报相关指令
  if (messages.length === 0) return false

  const lastUserMessageIndex = messages.findIndex(
    (msg, idx) => msg.role === 'user' && idx === messages.length - 1
  )

  if (lastUserMessageIndex === -1) return false

  const lastUserMessage = messages[lastUserMessageIndex]
  const content =
    typeof lastUserMessage.content === 'string'
      ? lastUserMessage.content
      : Array.isArray(lastUserMessage.content)
      ? lastUserMessage.content
          .map(item => (typeof item === 'string' ? item : ''))
          .join(' ')
      : ''

  // 简单检查消息内容是否包含研报关键词
  return (
    content.includes('研报') ||
    content.includes('研究报告') ||
    content.includes('research report') ||
    content.includes('投资建议')
  )
}

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { messages, model, chatId, searchMode, userId } = config
      const modelId = `${model.providerId}:${model.id}`

      try {
        const coreMessages = convertToCoreMessages(messages)
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(model)
        )

        // 检查是否是研报模式
        const isReportMode = isResearchReportMode(truncatedMessages)

        let researcherConfig = await researcher({
          messages: truncatedMessages,
          model: modelId,
          searchMode,
          isReportMode // 传递研报模式标志
        })

        const result = streamText({
          ...researcherConfig,
          onFinish: async result => {
            // Check if the last message contains an ask_question tool invocation
            const shouldSkipRelatedQuestions =
              isReasoningModel(modelId) ||
              isReportMode || // 研报模式下跳过相关问题生成
              (result.response.messages.length > 0 &&
                containsAskQuestionTool(
                  result.response.messages[
                    result.response.messages.length - 1
                  ] as CoreMessage
                ))

            await handleStreamFinish({
              responseMessages: result.response.messages,
              originalMessages: messages,
              model: modelId,
              chatId,
              dataStream,
              userId,
              skipRelatedQuestions: shouldSkipRelatedQuestions,
              isReportMode // 传递研报模式标志
            })
          }
        })

        result.mergeIntoDataStream(dataStream)
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error
      }
    },
    onError: error => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })
}
