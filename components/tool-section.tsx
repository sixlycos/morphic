'use client'

import { ToolInvocation } from 'ai'
import { QuestionConfirmation } from './question-confirmation'
import { ResearchReportSection } from './research-report-section'
import RetrieveSection from './retrieve-section'
import { SearchSection } from './search-section'
import { VideoSearchSection } from './video-search-section'

interface ToolSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  addToolResult?: (params: { toolCallId: string; result: any }) => void
}

export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  addToolResult
}: ToolSectionProps) {
  console.log('ToolSection render:', {
    toolName: tool.toolName,
    toolState: tool.state,
    hasResult: tool.state === 'result',
    resultType: tool.state === 'result' ? typeof (tool as any).result : 'undefined',
    resultKeys: tool.state === 'result' ? Object.keys((tool as any).result || {}) : [],
    isOpen
  })

  // Special handling for ask_question tool
  if (tool.toolName === 'ask_question') {
    // When waiting for user input
    if (tool.state === 'call' && addToolResult) {
      return (
        <QuestionConfirmation
          toolInvocation={tool}
          onConfirm={(toolCallId, approved, response) => {
            addToolResult({
              toolCallId,
              result: approved
                ? response
                : {
                  declined: true,
                  skipped: response?.skipped,
                  message: 'User declined this question'
                }
            })
          }}
        />
      )
    }

    // When result is available, display the result
    if (tool.state === 'result') {
      return (
        <QuestionConfirmation
          toolInvocation={tool}
          isCompleted={true}
          onConfirm={() => { }} // Not used in result display mode
        />
      )
    }
  }

  // 根据工具类型选择对应的组件
  const Component = (() => {
    switch (tool.toolName) {
      case 'search':
        return SearchSection
      case 'videoSearch':
        return VideoSearchSection
      case 'retrieve':
        return RetrieveSection
      case 'research_report':
        return ResearchReportSection
      default:
        return null
    }
  })()

  if (!Component) {
    return null
  }

  return (
    <Component
      tool={tool}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  )
}
