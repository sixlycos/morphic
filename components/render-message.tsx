import { ChatRequestOptions, JSONValue, Message, ToolInvocation } from 'ai'
import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { WorkflowMessage } from '../lib/types/workflow'
import { AnswerSection } from './answer-section'
import { ReasoningSection } from './reasoning-section'
import RelatedQuestions from './related-questions'
import { ToolSection } from './tool-section'
import { UserMessage } from './user-message'

interface RenderMessageProps {
  message: Message
  messageId: string
  getIsOpen: (id: string) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

// 重命名接口以避免与导入的Message冲突
interface CustomMessagePart {
  type: string;
  text: string;  // 移除可选标记
  toolInvocation?: any;
  reasoning?: string;
}

interface CustomMessage {
  role: string;
  content: string;
  parts?: CustomMessagePart[];
  annotations?: Array<{
    type: string;
    message?: string;
    data?: string;  // 明确指定为string类型
    display?: any;
    text?: string; // 添加text字段
    toolInvocations?: any[]; // 添加toolInvocations字段
  }>;
  toolInvocations?: any[];
  id?: string;
}

// 重命名本地接口以避免命名冲突
interface LocalMessage extends Message {
  // 添加任何本地特定的属性
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  chatId,
  addToolResult,
  onUpdateMessage,
  reload
}: RenderMessageProps) {
  console.log('RenderMessage:', {
    messageId,
    messageRole: message.role,
    hasAnnotations: !!message.annotations,
    annotationsCount: message.annotations?.length,
    hasParts: !!message.parts,
    partsCount: message.parts?.length
  })

  // 添加强制渲染的调试组件
  if (message.role === 'assistant' && typeof document !== 'undefined') {
    // 在DOM上全局添加，确保在控制台可见
    console.log('添加全局调试变量 window.debugMessage')
      ; (window as any).debugMessage = message;
  }

  // 强制显示调试信息，无论消息内容如何
  const ForceRender = () => {
    if (message.role !== 'assistant') return null;

    // 只有在客户端渲染时才显示
    if (typeof window === 'undefined') return null;

    // 检查是否有display类型的annotations
    const displayAnnotations = message.annotations?.filter(
      annotation => (annotation as any)?.type === 'display'
    );

    return (
      <>
        <div className="p-2 bg-rose-100 dark:bg-rose-900 rounded-md mb-4 text-xs">
          <div><strong>调试信息</strong> (可删除)</div>
          <div>消息ID: {messageId}</div>
          <div>角色: {message.role}</div>
          <div>注解: {message.annotations?.length || 0}个</div>
          <div>部分: {message.parts?.length || 0}个</div>
          <div>工具调用: {message.toolInvocations?.length || 0}个</div>
          <div>展示消息: {displayAnnotations?.length || 0}个</div>
          <div className="mt-2">
            <button
              className="px-2 py-1 bg-rose-500 text-white rounded-md text-xs"
              onClick={() => {
                console.log('完整消息内容:', message);
                alert('消息内容已打印到控制台');
              }}
            >
              打印完整消息
            </button>
          </div>
        </div>

        {displayAnnotations?.map((annotation, index) => {
          const display = (annotation as any).display;
          if (display?.kind === 'text' && display?.content) {
            return (
              <div key={`display-${messageId}-${index}`}>
                {handleTextDisplay(display)}
              </div>
            );
          }
          return null;
        })}
      </>
    );
  };

  const relatedQuestions = useMemo(
    () =>
      message.annotations?.filter(
        annotation => (annotation as any)?.type === 'related-questions'
      ),
    [message.annotations]
  )

  // Collect all other annotations as intermediate data
  const allIntermediateData = useMemo(() => {
    return message.annotations?.filter(annotation => {
      const type = (annotation as any)?.type
      return type !== 'related-questions' &&
        type !== 'tool_call' &&
        type !== 'reasoning' &&
        (type === 'workflow-start' ||
          type === 'workflow-progress' ||
          type === 'workflow-complete' ||
          type === 'workflow-error' ||
          type === 'display' ||
          type === 'search_results' ||
          type === 'research_report' ||
          type === 'research_report_result' ||
          type === 'workflow_message')
    }) as WorkflowMessage[] | undefined
  }, [message.annotations])

  // Render for manual tool call
  const toolData = useMemo(() => {
    const toolAnnotations =
      (message.annotations?.filter(
        annotation =>
          (annotation as unknown as { type: string }).type === 'tool_call'
      ) as unknown as Array<{
        data: {
          args: string
          toolCallId: string
          toolName: string
          result?: string
          state: 'call' | 'result'
        }
      }>) || []

    const toolDataMap = toolAnnotations.reduce((acc, annotation) => {
      const existing = acc.get(annotation.data.toolCallId)
      if (!existing || annotation.data.state === 'result') {
        acc.set(annotation.data.toolCallId, {
          ...annotation.data,
          args: annotation.data.args ? JSON.parse(annotation.data.args) : {},
          result:
            annotation.data.result && annotation.data.result !== 'undefined'
              ? JSON.parse(annotation.data.result)
              : undefined
        } as ToolInvocation)
      }
      return acc
    }, new Map<string, ToolInvocation>())

    return Array.from(toolDataMap.values())
  }, [message.annotations])

  // Extract the unified reasoning annotation directly.
  const reasoningAnnotation = useMemo(() => {
    const annotations = message.annotations as any[] | undefined
    if (!annotations) return null
    return (
      annotations.find(a => a.type === 'reasoning' && a.data !== undefined) ||
      null
    )
  }, [message.annotations])

  // Extract the reasoning time and reasoning content from the annotation.
  // If annotation.data is an object, use its fields. Otherwise, default to a time of 0.
  const reasoningTime = useMemo(() => {
    if (!reasoningAnnotation) return 0
    if (
      typeof reasoningAnnotation.data === 'object' &&
      reasoningAnnotation.data !== null
    ) {
      return reasoningAnnotation.data.time ?? 0
    }
    return 0
  }, [reasoningAnnotation])

  const handleTextDisplay = (display: any) => {
    if (display.kind === 'text' && display.content) {
      return (
        <div className="mt-2">
          <h3 className="font-semibold text-lg mb-2">{display.title || '文本内容'}</h3>
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>
              {display.content}
            </ReactMarkdown>
          </div>
        </div>
      );
    }
    return null;
  };

  // 在消息处理部分添加规范化处理
  const normalizeMessage = (message: CustomMessage): CustomMessage => {
    // 确保message.content不为undefined
    if (message.content === undefined) {
      message.content = '';
    }

    // 如果是研报模式(通过检查annotations中是否有workflow-progress来判断)
    if (message.annotations?.some(a => a.type === 'workflow-progress')) {
      // 尝试从多个来源获取研报文本
      let reportText = '';
      let source = '未知';

      // 1. 首先尝试从research_report_result类型的注解中获取
      const reportResultAnnotation = message.annotations.find(a => a.type === 'research_report_result');
      if (reportResultAnnotation) {
        // 尝试从text或data字段获取内容
        if (reportResultAnnotation.text) {
          reportText = reportResultAnnotation.text;
          source = 'research_report_result.text';
        } else if (reportResultAnnotation.data) {
          reportText = typeof reportResultAnnotation.data === 'string'
            ? reportResultAnnotation.data
            : JSON.stringify(reportResultAnnotation.data);
          source = 'research_report_result.data';
        }
      }

      // 2. 如果research_report_result没有内容，尝试从workflow-complete中获取
      if (!reportText) {
        const workflowComplete = message.annotations.find(a => a.type === 'workflow-complete');
        if (workflowComplete?.toolInvocations) {
          try {
            const toolInvocations = typeof workflowComplete.toolInvocations === 'string'
              ? JSON.parse(workflowComplete.toolInvocations)
              : workflowComplete.toolInvocations;

            const finalReport = toolInvocations.find((t: { toolName: string }) => t.toolName === 'finalizeResearchReport');
            if (finalReport?.result?.content) {
              reportText = finalReport.result.content;
              source = 'workflow-complete.toolInvocations';
            }
          } catch (e) {
            console.error('解析workflow-complete的toolInvocations失败:', e);
          }
        }
      }

      // 3. 尝试从display类型的注解中获取
      if (!reportText) {
        const displayAnnotation = message.annotations.find(
          a => a.type === 'display' && a.display?.kind === 'text' && a.display?.content
        );
        if (displayAnnotation?.display?.content) {
          reportText = displayAnnotation.display.content;
          source = 'display.content';
        }
      }

      // 4. 尝试从finalizeResearchReport工具调用中获取
      if (!reportText) {
        const finalReportAnnotation = message.annotations.find(
          a => Array.isArray(a.toolInvocations) && a.toolInvocations.some(t => t.toolName === 'finalizeResearchReport')
        );
        if (finalReportAnnotation?.text) {
          reportText = finalReportAnnotation.text;
          source = 'finalizeResearchReport';
        }
      }

      // 5. 如果上述方法都失败，使用现有的content
      if (!reportText && message.content) {
        reportText = message.content;
        source = 'content';
      }

      // 打印详细的调试信息
      console.log('研报内容获取详情:', {
        获取来源: source,
        内容长度: reportText.length,
        内容预览: reportText.substring(0, 200),
        注解数量: message.annotations.length,
        注解类型列表: message.annotations.map(a => a.type),
        研报结果注解: reportResultAnnotation,
        完整注解列表: message.annotations
      });

      // 设置消息内容为研报内容
      if (reportText) {
        message.content = reportText;

        // 构建规范化的parts数组
        const parts: CustomMessagePart[] = [];

        // 添加工作流步骤部分
        message.annotations
          .filter(a => a.type === 'step-start' || a.type === 'workflow-progress')
          .forEach(step => {
            const stepText = typeof step.message === 'string'
              ? step.message
              : step.message ? String(step.message) : '';

            parts.push({
              type: 'step-start',
              text: stepText || ''
            });
          });

        // 添加研报内容作为最后一个part
        parts.push({
          type: 'text',
          text: reportText
        });

        // 更新message对象
        message.parts = parts;
      }

      // 保存所有工具调用记录
      const toolInvocations = message.annotations
        .filter(a => Array.isArray(a.toolInvocations) && a.toolInvocations.length > 0)
        .flatMap(a => a.toolInvocations || []);
      message.toolInvocations = toolInvocations;
    }

    // 确保content字段有值
    if (message.content === undefined) {
      message.content = ''; // 使用空字符串代替undefined
    }

    return message;
  };

  // 在组件中使用
  const normalizedMessage = normalizeMessage(message as CustomMessage);

  if (normalizedMessage.role === 'user') {
    return (
      <UserMessage
        message={normalizedMessage.content}
        messageId={messageId}
        onUpdateMessage={onUpdateMessage}
      />
    )
  }

  // New way: Use parts instead of toolInvocations
  return (
    <>
      {toolData.map(tool => (
        <ToolSection
          key={tool.toolCallId}
          tool={tool}
          isOpen={getIsOpen(tool.toolCallId)}
          onOpenChange={open => onOpenChange(tool.toolCallId, open)}
          addToolResult={addToolResult}
          intermediateData={allIntermediateData}
        />
      ))}
      {normalizedMessage.parts?.map((part, index) => {
        // Check if this is the last part in the array
        const isLastPart = index === (normalizedMessage.parts?.length ?? 0) - 1

        switch (part.type) {
          case 'tool-invocation':
            return (
              <ToolSection
                key={`${messageId}-tool-${index}`}
                tool={part.toolInvocation}
                isOpen={getIsOpen(part.toolInvocation.toolCallId)}
                onOpenChange={open =>
                  onOpenChange(part.toolInvocation.toolCallId, open)
                }
                addToolResult={addToolResult}
                intermediateData={allIntermediateData}
              />
            )
          case 'text':
            // Only show actions if this is the last part and it's a text part
            return (
              <AnswerSection
                key={`${messageId}-text-${index}`}
                content={part.text}
                isOpen={getIsOpen(messageId)}
                onOpenChange={open => onOpenChange(messageId, open)}
                chatId={chatId}
                showActions={isLastPart}
                messageId={messageId}
                reload={reload}
              />
            )
          case 'reasoning':
            return (
              <ReasoningSection
                key={`${messageId}-reasoning-${index}`}
                content={{
                  reasoning: part.reasoning || '', // 添加空字符串作为默认值，修复类型错误
                  time: reasoningTime
                }}
                isOpen={getIsOpen(messageId)}
                onOpenChange={open => onOpenChange(messageId, open)}
              />
            )
          // Add other part types as needed
          default:
            return null
        }
      })}
      {relatedQuestions && relatedQuestions.length > 0 && (
        <RelatedQuestions
          annotations={relatedQuestions as JSONValue[]}
          onQuerySelect={onQuerySelect}
          isOpen={getIsOpen(`${messageId}-related`)}
          onOpenChange={open => onOpenChange(`${messageId}-related`, open)}
        />
      )}
      <ForceRender />
    </>
  )
}
