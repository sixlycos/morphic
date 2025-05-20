'use client'

import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, MessageCirclePlus, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { useArtifact } from './artifact/artifact-context'
import { EmptyScreen } from './empty-screen'
import { ModelSelector } from './model-selector'
import { SearchModeToggle } from './search-mode-toggle'
import { ToolsSelector } from './tools-selector'
import { Button } from './ui/button'

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
  models?: Model[]
  /** Whether to show the scroll to bottom button */
  showScrollToBottomButton: boolean
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append,
  models,
  showScrollToBottomButton,
  scrollContainerRef
}: ChatPanelProps) {
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const { close: closeArtifact } = useArtifact()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const faceRef = useRef<HTMLDivElement>(null)

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    closeArtifact()
    router.push('/')
  }

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      lastPart?.type === 'tool-invocation' &&
      lastPart?.toolInvocation?.state === 'call'
    )
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Scroll to the bottom of the container
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  // 眼球跟踪鼠标效果
  useEffect(() => {
    if (!faceRef.current) return

    const face = faceRef.current
    const leftEye = face.querySelector('.left-eye') as SVGEllipseElement
    const rightEye = face.querySelector('.right-eye') as SVGEllipseElement

    if (!leftEye || !rightEye) return

    let rafId: number
    let currentX = 0
    let currentY = 0
    let targetX = 0
    let targetY = 0

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor
    }

    const animate = () => {
      // 使用缓动函数使移动更加平滑
      currentX = lerp(currentX, targetX, 0.1)
      currentY = lerp(currentY, targetY, 0.1)

      // 基础位置
      const baseLeftX = 95
      const baseRightX = 142
      const baseY = 134

      // 应用位置
      leftEye.setAttribute('cx', `${baseLeftX + currentX}`)
      leftEye.setAttribute('cy', `${baseY + currentY}`)
      rightEye.setAttribute('cx', `${baseRightX + currentX}`)
      rightEye.setAttribute('cy', `${baseY + currentY}`)

      rafId = requestAnimationFrame(animate)
    }

    const handleMouseMove = (e: MouseEvent) => {
      // 获取视窗尺寸
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      // 计算鼠标位置相对于视窗的百分比 (-1 到 1 的范围)
      const mouseXPercent = (e.clientX / windowWidth) * 2 - 1
      const mouseYPercent = (e.clientY / windowHeight) * 2 - 1

      // 增加垂直方向的移动范围
      const maxMoveX = 45
      const maxMoveY = 45

      // 使用二次函数使移动更加夸张
      targetX = Math.sign(mouseXPercent) * maxMoveX * Math.pow(Math.abs(mouseXPercent), 1.5)
      targetY = Math.sign(mouseYPercent) * maxMoveY * Math.pow(Math.abs(mouseYPercent), 1.5)
    }

    // 开始动画循环
    animate()

    // 添加鼠标移动事件监听器
    window.addEventListener('mousemove', handleMouseMove)

    // 清理函数
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(rafId)
    }
  }, []) // 空依赖数组，只在组件挂载时运行一次

  return (
    <div
      className={cn(
        'w-full bg-background group/form-container shrink-0',
        messages.length > 0 ? 'sticky bottom-0 px-2 pb-4' : 'px-6'
      )}
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 mb-0 md:mb-4 space-y-6">
          <div className="relative max-w-md mx-auto mt-8">
            <div className="bg-background rounded-2xl px-4 py-2 border shadow-sm relative transition-all duration-500 ease-out transform opacity-100 translate-y-0 dialog-float">
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-background rotate-45 border-b border-r shadow-sm"></div>
              <label className="text-sm md:text-base text-muted-foreground text-center block">今天需要什么帮助？</label>
            </div>
          </div>
          <div ref={faceRef} className="relative w-12 h-12">
            <svg fill="currentColor" viewBox="0 0 256 256" role="img" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
              <circle cx="128" cy="128" r="128" fill="#222"></circle>
              <g className="eyes">
                <ellipse cx="95" cy="134" rx="18" ry="18" fill="white" className="left-eye"></ellipse>
                <ellipse cx="142" cy="134" rx="18" ry="18" fill="white" className="right-eye"></ellipse>
              </g>
            </svg>
          </div>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="max-w-[720px] w-full mx-auto relative"
      >
        {/* Scroll to bottom button - only shown when showScrollToBottomButton is true */}
        {showScrollToBottomButton && messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
            onClick={handleScrollToBottom}
            title="滚动到底部"
          >
            <ChevronDown size={16} />
          </Button>
        )}

        <div className="relative flex flex-col w-full gap-2 bg-[#F5F5F5] rounded-3xl border border-input p-2">
          <Textarea
            ref={inputRef}
            name="input"
            rows={1}
            maxRows={1}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="输入问题..."
            spellCheck={false}
            value={input}
            disabled={isLoading || isToolInvocationInProgress()}
            className="resize-none w-full min-h-16 bg-transparent border-0 px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 h-[44px]"
            onChange={e => {
              handleInputChange(e)
              setShowEmptyScreen(e.target.value.length === 0)
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (input.trim().length === 0) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
            onFocus={() => setShowEmptyScreen(true)}
            onBlur={() => setShowEmptyScreen(false)}
          />

          {/* 底部工具栏区域 */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-input/30">
            <div className="flex items-center gap-2">
              <ModelSelector models={models || []} />
              <SearchModeToggle />
              <ToolsSelector />
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNewChat}
                  className="shrink-0 rounded-full group"
                  type="button"
                  disabled={isLoading || isToolInvocationInProgress()}
                >
                  <MessageCirclePlus className="size-4 group-hover:rotate-12 transition-all" />
                </Button>
              )}
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'icon'}
                variant={'outline'}
                className={cn(isLoading && 'animate-pulse', 'rounded-full')}
                disabled={
                  (input.length === 0 && !isLoading) ||
                  isToolInvocationInProgress()
                }
                onClick={isLoading ? stop : undefined}
              >
                {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
              </Button>
            </div>
          </div>
        </div>

        {messages.length === 0 && (
          <EmptyScreen
            submitMessage={message => {
              handleInputChange({
                target: { value: message }
              } as React.ChangeEvent<HTMLTextAreaElement>)
            }}
            className={cn(showEmptyScreen ? 'visible' : 'invisible')}
          />
        )}
      </form>
    </div>
  )
}
