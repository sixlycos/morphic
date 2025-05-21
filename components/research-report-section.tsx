'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { ToolInvocation } from 'ai'
import ReactMarkdown from 'react-markdown'
import { CollapsibleMessage } from './collapsible-message'
import { Section, ToolArgsSection } from './section'

interface ResearchReportSectionProps {
    tool: ToolInvocation
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function ResearchReportSection({
    tool,
    isOpen,
    onOpenChange
}: ResearchReportSectionProps) {
    console.log('ResearchReportSection render:', {
        toolState: tool.state,
        hasResult: tool.state === 'result',
        resultType: tool.state === 'result' ? typeof (tool as any).result : 'undefined',
        resultContent: tool.state === 'result' ? (tool as any).result : null
    })

    const { open } = useArtifact()

    // 获取股票名称参数
    const stockName = tool.args?.stockName as string | undefined

    // 提取Markdown内容
    const markdownContent = tool.state === 'result' ?
        ((tool as any).result || '').replace(/^```markdown\n/, '').replace(/\n```$/, '') :
        ''

    const header = (
        <button
            type="button"
            onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
            className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
            title="Open details"
        >
            <ToolArgsSection tool="research_report" number={1}>
                {`生成 ${stockName || ''} 的研究报告`}
            </ToolArgsSection>
        </button>
    )

    return (
        <CollapsibleMessage
            role="assistant"
            isCollapsible={true}
            header={header}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            showIcon={false}
        >
            {/* 显示搜索结果 */}
            {tool.state === 'call' && (
                <Section title="搜索进度">
                    <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </Section>
            )}

            {/* 显示研报内容 */}
            {tool.state === 'result' && markdownContent && (
                <Section>
                    <div className="prose dark:prose-invert max-w-none">
                        <ReactMarkdown>{markdownContent}</ReactMarkdown>
                    </div>
                </Section>
            )}
        </CollapsibleMessage>
    )
} 