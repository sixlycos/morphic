'use client'

import { ToolInvocation } from 'ai'
import { WorkflowMessage } from '../lib/types/workflow'
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
  intermediateData?: WorkflowMessage[]
}

export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  addToolResult,
  intermediateData
}: ToolSectionProps) {
  console.log('ToolSection render:', {
    toolName: tool?.toolName,
    toolState: tool?.state,
    hasResult: tool?.state === 'result',
    resultType: tool?.state === 'result' ? typeof (tool as any).result : 'undefined',
    resultKeys: tool?.state === 'result' ? Object.keys((tool as any).result || {}) : [],
    isOpen,
    intermediateDataCount: intermediateData?.length
  })

  // 全局添加调试变量
  if (typeof window !== 'undefined') {
    (window as any).debugToolSection = {
      tool,
      intermediateData,
      isOpen,
      time: new Date().toISOString()
    };
    console.log('全局调试对象已添加到 window.debugToolSection');
  }

  // 强制显示一个调试UI，这应该在任何情况下都能渲染
  const ForceDebugRender = () => {
    if (typeof window === 'undefined') return null;

    return (
      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-md mb-4 text-xs">
        <div><strong>工具调试信息</strong> (可删除)</div>
        <div>工具类型: {tool?.toolName || '未知'}</div>
        <div>工具状态: {tool?.state || '未知'}</div>
        <div>是否已打开: {isOpen ? '是' : '否'}</div>
        <div>工具参数: {JSON.stringify(tool?.args || {}).substring(0, 50)}...</div>
        <div>中间数据项: {intermediateData?.length || 0}个</div>
        <div className="mt-2">
          <button
            className="px-2 py-1 bg-blue-500 text-white rounded-md text-xs mr-2"
            onClick={() => {
              console.log('完整工具信息:', tool);
              alert('工具信息已打印到控制台');
            }}
          >
            打印工具信息
          </button>
          <button
            className="px-2 py-1 bg-blue-500 text-white rounded-md text-xs"
            onClick={() => {
              console.log('中间数据:', intermediateData);
              alert('中间数据已打印到控制台');
            }}
          >
            打印中间数据
          </button>
        </div>
      </div>
    );
  };

  // 直接检查是否有工具名，如果没有返回调试UI
  if (!tool?.toolName) {
    return <ForceDebugRender />;
  }

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

  // 研报工具始终渲染，无论状态如何
  if (tool.toolName === 'research_report') {
    return (
      <>
        <ForceDebugRender />
        <ResearchReportSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          intermediateData={intermediateData}
        />
      </>
    );
  }

  // 处理其他工具类型
  let Component;

  switch (tool.toolName) {
    case 'search':
      Component = SearchSection;
      break;
    case 'videoSearch':
      Component = VideoSearchSection;
      break;
    case 'retrieve':
      Component = RetrieveSection;
      break;
    default:
      return null;
  }

  return (
    <Component
      tool={tool}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  )
}
