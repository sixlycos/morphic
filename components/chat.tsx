'use client'

import { CHAT_ID } from '@/lib/constants'
import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { useChat, UseChatOptions } from '@ai-sdk/react'
import { ChatRequestOptions, JSONValue } from 'ai'
import { Message } from 'ai/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

// 扩展UseChatOptions类型以包含onData
type ExtendedUseChatOptions = UseChatOptions & {
  onData?: (streamData: JSONValue, currentMessage: Message) => void
}

// Define section structure
interface ChatSection {
  id: string // User message ID
  userMessage: Message
  assistantMessages: Message[]
}

export function Chat({
  id,
  savedMessages = [],
  query,
  models
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  models?: Model[]
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    stop,
    append,
    data,
    setData,
    addToolResult,
    reload
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id
    },
    onFinish: () => {
      window.history.replaceState({}, '', `/search/${id}`)
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    },
    onError: error => {
      console.error('聊天错误:', error)

      // 特别处理消息通道错误
      if (error.message && error.message.includes('message channel closed')) {
        console.log('检测到消息通道错误，尝试恢复...')

        // 尝试重新加载最后一条消息
        const lastUserMessage = messages.findLast(msg => msg.role === 'user')
        if (lastUserMessage) {
          console.log('尝试重新加载最后一条消息:', lastUserMessage.content)
          reload({
            body: {
              chatId: id,
              regenerate: true
            }
          }).catch(retryError => {
            console.error('重试失败:', retryError)
            toast.error('连接中断，请刷新页面重试')
          })
        } else {
          toast.error('连接中断，请刷新页面重试')
        }
      } else {
        toast.error(`Error in chat: ${error.message}`)
      }

      // 尝试恢复进行中的会话
      try {
        if (status === 'streaming') {
          stop()
        }
      } catch (e) {
        console.error('停止流失败:', e)
      }
    },
    onData: (streamData: JSONValue, currentMessage: Message) => {
      try {
        // 检查是否有消息和annotations
        if (currentMessage && !currentMessage.annotations) {
          currentMessage.annotations = []
        }

        // 检查是否为工作流或显示消息
        if (streamData && typeof streamData === 'object') {
          const type = (streamData as any).type
          if (
            type === 'workflow-start' ||
            type === 'workflow-progress' ||
            type === 'workflow-complete' ||
            type === 'workflow-error' ||
            type === 'display' ||
            type === 'research_report' ||
            type === 'tool_call'
          ) {
            // 记录消息
            console.log('接收到流式数据:', type, streamData)

            // 将其添加到当前消息的annotations
            if (currentMessage && currentMessage.annotations) {
              currentMessage.annotations.push(streamData)

              // 强制更新消息状态
              setMessages(prevMessages => {
                const newMessages = [...prevMessages]
                const index = newMessages.findIndex(msg => msg.id === currentMessage.id)
                if (index !== -1) {
                  newMessages[index] = {
                    ...newMessages[index],
                    annotations: [...(newMessages[index].annotations || []), streamData]
                  }
                }
                return newMessages
              })
            }
          }
        }
      } catch (error) {
        console.error('处理流数据时出错:', error)
      }
    },
    sendExtraMessageFields: false,
    experimental_throttle: 100,
    // 添加重试配置
    retry: {
      retries: 3,
      retryDelay: 1000,
      retryOn: (error: Error) => {
        return error.message.includes('message channel closed')
      }
    }
  } as ExtendedUseChatOptions)

  const isLoading = status === 'submitted' || status === 'streaming'

  // Convert messages array to sections array
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null

    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new section when a user message is found
        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
      } else if (currentSection && message.role === 'assistant') {
        // Add assistant message to the current section
        currentSection.assistantMessages.push(message)
      }
      // Ignore other role types like 'system' for now
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  // Detect if scroll container is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50 // threshold in pixels
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsAtBottom(true)
      } else {
        setIsAtBottom(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Set initial state

    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to the section when a new user message is sent
  useEffect(() => {
    if (sections.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        // If the last message is from user, find the corresponding section
        const sectionId = lastMessage.id
        requestAnimationFrame(() => {
          const sectionElement = document.getElementById(`section-${sectionId}`)
          sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [sections, messages])

  useEffect(() => {
    setMessages(savedMessages)
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [id])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
  }

  const handleUpdateAndReloadMessage = async (
    messageId: string,
    newContent: string
  ) => {
    setMessages(currentMessages =>
      currentMessages.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    )

    try {
      const messageIndex = messages.findIndex(msg => msg.id === messageId)
      if (messageIndex === -1) return

      const messagesUpToEdited = messages.slice(0, messageIndex + 1)

      setMessages(messagesUpToEdited)

      setData(undefined)

      await reload({
        body: {
          chatId: id,
          regenerate: true
        }
      })
    } catch (error) {
      console.error('Failed to reload after message update:', error)
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
  }

  const handleReloadFrom = async (
    messageId: string,
    options?: ChatRequestOptions
  ) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      const userMessageIndex = messages
        .slice(0, messageIndex)
        .findLastIndex(m => m.role === 'user')
      if (userMessageIndex !== -1) {
        const trimmedMessages = messages.slice(0, userMessageIndex + 1)
        setMessages(trimmedMessages)
        return await reload(options)
      }
    }
    return await reload(options)
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setData(undefined)
    handleSubmit(e)
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center' : ''
      )}
      data-testid="full-chat"
    >
      <ChatMessages
        sections={sections}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
        models={models}
        showScrollToBottomButton={!isAtBottom}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  )
}
