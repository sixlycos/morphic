'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { ToolInvocation } from 'ai'
import { useEffect, useState } from 'react'
import { SearchResultItem } from '../lib/types/index'
import { WorkflowMessage } from '../lib/types/workflow'
import { CollapsibleMessage } from './collapsible-message'
import { BotMessage } from './message'
import { SearchResults } from './search-results'
import { Section, ToolArgsSection } from './section'
import AIWorkflow from './workflow/AIWorkflow'

interface ResearchReportSectionProps {
    tool: ToolInvocation
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    intermediateData?: WorkflowMessage[]
}

export function ResearchReportSection({
    tool,
    isOpen,
    onOpenChange,
    intermediateData
}: ResearchReportSectionProps) {
    const [retryCount, setRetryCount] = useState(0)
    const [isError, setIsError] = useState(false)
    // 添加研报内容状态，以便在需要时直接渲染
    const [reportContent, setReportContent] = useState<string | null>(null)

    // 添加工具加载状态判断
    const isToolLoading = tool.state === 'call';

    // 直接从工具结果中获取搜索结果
    const toolResults = tool.state === 'result' ? (tool as any).result : undefined;
    const searchResultItems = toolResults?.results || [];

    // 在全局窗口对象上添加调试信息，便于控制台检查
    if (typeof window !== 'undefined') {
        (window as any).debugResearchReport = {
            tool,
            intermediateData,
            isOpen,
            time: new Date().toISOString()
        };
        console.log('全局调试对象已添加到 window.debugResearchReport');
    }

    // 添加初始化时打印详细信息
    useEffect(() => {
        console.log('==== ResearchReportSection 组件初始化 ====')
        console.log('工具状态:', tool?.state)
        console.log('工具参数:', tool?.args)
        console.log('中间数据长度:', intermediateData?.length)
        console.log('中间数据类型:', intermediateData?.map(item => item.type))
        console.log('是否打开:', isOpen)

        // 从工具结果中获取报告内容
        if (tool?.state === 'result') {
            const result = (tool as any).result;
            console.log('工具状态变为result，检查结果:', {
                resultType: typeof result,
                resultKeys: result ? Object.keys(result) : [],
                hasResults: result?.results?.length > 0,
                hasMarkdownContent: !!result?.markdownContent,
                markdownContentLength: result?.markdownContent?.length || 0,
                markdownContentPreview: result?.markdownContent ? result.markdownContent.substring(0, 100) : null
            });

            if (result?.markdownContent) {
                console.log(`从工具结果获取到研报内容，长度: ${result.markdownContent.length}`);
                setReportContent(result.markdownContent);
            } else if (typeof result === 'string' && result.length > 0) {
                console.log(`从工具结果获取到字符串研报内容，长度: ${result.length}`);
                // 移除Markdown代码块格式（如果有）
                const cleanContent = result.replace(/^```markdown\n/, '').replace(/\n```$/, '');
                setReportContent(cleanContent);
            }
        }
    }, [tool?.state, (tool as any)?.result]);

    // 添加额外的分析工作流数据的逻辑
    useEffect(() => {
        if (!intermediateData || intermediateData.length === 0) return;

        // 寻找研报数据
        const reportData = intermediateData.find(item =>
            item.type === 'research_report' ||
            item.type === 'research_report_result' ||
            (item.type === 'workflow_message' &&
                item.data?.type === 'workflow-complete' &&
                typeof item.data.data === 'string')
        );

        if (reportData) {
            console.log('找到研报数据:', reportData.type);
            let content = '';

            if (reportData.type === 'research_report' && reportData.data) {
                content = typeof reportData.data === 'string'
                    ? reportData.data
                    : JSON.stringify(reportData.data);
            } else if (reportData.type === 'workflow_message' && reportData.data?.type === 'workflow-complete') {
                content = typeof reportData.data.data === 'string'
                    ? reportData.data.data
                    : JSON.stringify(reportData.data.data);
            }

            if (content && content.length > 0) {
                console.log(`从中间数据获取到研报内容，长度: ${content.length}`);
                setReportContent(content);
            }
        }
    }, [intermediateData]);

    useEffect(() => {
        // 重置错误状态
        if (intermediateData && intermediateData.length > 0) {
            setIsError(false)
            setRetryCount(0)
        }
    }, [intermediateData])

    const handleRetry = () => {
        if (retryCount >= 3) {
            console.log('已达到最大重试次数')
            return
        }
        setRetryCount(prev => prev + 1)
        setIsError(false)
        // 触发重新加载
        if (onOpenChange) {
            onOpenChange(false)
            setTimeout(() => onOpenChange(true), 100)
        }
    }

    console.log('ResearchReportSection 详细渲染状态:', {
        toolState: tool.state,
        toolName: tool.toolName,
        hasResult: tool.state === 'result',
        resultType: tool.state === 'result' ? typeof (tool as any).result : 'undefined',
        resultLength: tool.state === 'result' ? (typeof (tool as any).result === 'string' ? (tool as any).result.length : 0) : 0,
        resultPreview: tool.state === 'result' ? (typeof (tool as any).result === 'string' ? (tool as any).result.substring(0, 100) : null) : null,
        hasIntermediateData: !!intermediateData,
        intermediateDataCount: intermediateData?.length || 0,
        intermediateDataTypes: intermediateData?.map(item => item.type) || [],
        hasReportContent: !!reportContent,
        reportContentLength: reportContent?.length || 0
    })

    const { open } = useArtifact()

    // 获取股票名称参数
    const stockName = tool.args?.stockName as string | undefined

    // 更全面的解决方案
    // 修改safelyParseJSON函数，确保总是返回非null值
    const safelyParseJSON = (value: any): any => {
        if (value === null || value === undefined) return {};
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    };

    // Extract workflow data and search results from intermediate data
    const workflowUpdates = intermediateData?.filter(
        (item): item is WorkflowMessage =>
            item.type === 'workflow-progress' ||
            item.type === 'workflow-start' ||
            item.type === 'workflow-complete' ||
            item.type === 'workflow-error' ||
            (item.type === 'workflow_message' && item.data?.type === 'workflow-progress') ||
            (item.type === 'workflow_message' && item.data?.type === 'workflow-start') ||
            (item.type === 'workflow_message' && item.data?.type === 'workflow-complete') ||
            (item.type === 'workflow_message' && item.data?.type === 'workflow-error')
    ) || []

    // 处理workflow_message类型的消息
    const processedWorkflowUpdates = workflowUpdates.map(msg => {
        if (msg.type === 'workflow_message' && msg.data) {
            // 尝试解析可能被序列化的数据
            const parsedData = safelyParseJSON(msg.data);
            return parsedData as WorkflowMessage
        }
        return msg
    })

    // 收集所有搜索结果相关的消息，包括由workflowStream和直接消息产生的情况
    const searchResultMessages = intermediateData?.filter(
        (item): item is WorkflowMessage =>
            (item.type === 'display' && item.display?.kind === 'search_results') ||
            (item.type === 'workflow_message' && item.data?.display?.kind === 'search_results') ||
            item.type === 'search_results'
    ) || []

    // 重新实现搜索结果处理, 确保类型安全
    const processedSearchResultMessages = searchResultMessages
        .filter(Boolean)  // 先过滤掉null
        .map(msg => {
            // 如果是直接的search_results类型
            if (msg.type === 'search_results' && msg.data) {
                try {
                    const data = safelyParseJSON(msg.data);
                    return {
                        type: 'display',
                        display: {
                            kind: 'search_results',
                            title: data.title || '搜索结果',
                            results: data.results || []
                        }
                    } as WorkflowMessage;
                } catch (e) {
                    console.error('解析search_results类型消息错误:', e);
                    return null;
                }
            }

            // 如果是workflow_message类型，需要解析data字段
            if (msg.type === 'workflow_message' && msg.data) {
                try {
                    const parsedData = safelyParseJSON(msg.data);
                    // 确保display和results存在
                    if (parsedData?.display?.results) {
                        // 尝试解析results如果是字符串
                        const results = safelyParseJSON(parsedData.display.results);

                        return {
                            type: 'display',
                            display: {
                                kind: 'search_results',
                                title: parsedData.display.title || '搜索结果',
                                results: results || []
                            }
                        } as WorkflowMessage;
                    }
                } catch (e) {
                    console.error('解析搜索结果错误:', e);
                    return null;
                }
            }

            // 如果是display类型但results是字符串，需要解析
            if (msg.type === 'display' && msg.display?.kind === 'search_results') {
                try {
                    const results = safelyParseJSON(msg.display.results);

                    return {
                        ...msg,
                        display: {
                            ...msg.display,
                            results: results || []
                        }
                    } as WorkflowMessage;
                } catch (e) {
                    console.error('解析display搜索结果错误:', e);
                    return null;
                }
            }

            return msg;
        })
        .filter(Boolean); // 最后再次过滤掉无效项

    // 收集研报数据
    const researchReportData = intermediateData?.filter(
        (item): item is WorkflowMessage =>
            item.type === 'research_report' ||
            item.type === 'research_report_result' ||
            (item.type === 'workflow_message' && item.data?.type === 'workflow-complete')
    ) || []

    // 添加关于收集到的研报数据的详细日志
    console.log('收集到研报数据数量:', researchReportData.length)
    researchReportData.forEach((item, index) => {
        console.log(`研报数据[${index}]:`, {
            type: item.type,
            dataType: item.data ? typeof item.data : 'undefined',
            dataLength: item.data && typeof item.data === 'string' ? item.data.length : 'N/A',
            preview: item.data && typeof item.data === 'string' ? item.data.substring(0, 50) : 'N/A'
        })
    })

    // 重新实现研报数据处理，确保类型安全
    const processedResearchReportData = researchReportData
        .filter(Boolean)  // 先过滤掉null
        .map(msg => {
            try {
                console.log('处理研报数据消息:', JSON.stringify(msg, null, 2).substring(0, 500));

                if (msg.type === 'workflow_message' && msg.data?.type === 'workflow-complete') {
                    // 确保data是对象
                    const data = safelyParseJSON(msg.data);
                    const reportData = data?.data;
                    console.log('从workflow-complete获取到研报数据类型:', typeof reportData,
                        '长度:', typeof reportData === 'string' ? reportData.length : '未知');

                    return {
                        type: 'research_report',
                        data: typeof reportData === 'string' ? reportData : JSON.stringify(reportData || {})
                    } as WorkflowMessage;
                }

                if (msg.type === 'research_report') {
                    console.log('直接获取到research_report数据类型:', typeof msg.data,
                        '长度:', typeof msg.data === 'string' ? msg.data.length : '未知');

                    return {
                        type: 'research_report',
                        data: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data || {})
                    } as WorkflowMessage;
                }

                return msg;
            } catch (e) {
                console.error('处理研报数据错误:', e);
                return null;
            }
        })
        .filter(Boolean); // 过滤掉undefined和null

    // 收集其他数据展示消息（股票信息、财务数据等）
    const otherDataDisplayMessages = intermediateData?.filter(
        (item): item is WorkflowMessage =>
            (item.type === 'display' && item.display?.kind !== 'search_results') ||
            (item.type === 'workflow_message' && item.data?.display?.kind && item.data?.display?.kind !== 'search_results')
    ) || []

    // 处理这些数据显示消息
    const processedDataDisplayMessages = otherDataDisplayMessages.map(msg => {
        // 处理workflow_message类型的消息
        if (msg.type === 'workflow_message' && msg.data) {
            try {
                const parsedData = safelyParseJSON(msg.data);
                if (parsedData.display) {
                    const content = safelyParseJSON(parsedData.display.content);

                    return {
                        type: 'display',
                        display: {
                            kind: parsedData.display.kind,
                            title: parsedData.display.title,
                            content: content
                        }
                    } as WorkflowMessage
                }
            } catch (e) {
                console.error('解析数据显示消息错误:', e)
            }
        }

        // 如果是display类型但content是字符串，需要解析
        if (msg.type === 'display' && msg.display?.content && typeof msg.display.content === 'string') {
            try {
                const content = safelyParseJSON(msg.display.content);
                return {
                    ...msg,
                    display: {
                        ...msg.display,
                        content
                    }
                } as WorkflowMessage
            } catch (e) {
                // 如果解析失败，保持原样
            }
        }

        return msg
    }).filter(Boolean) // 过滤掉无效项

    console.log('处理的数据展示消息数量:', processedDataDisplayMessages.length)

    // 添加错误处理和日志
    console.log('处理后的数据:', {
        workflowUpdates: processedWorkflowUpdates.map(msg => ({
            type: msg?.type || 'unknown',
            message: msg?.message || '',
            step: msg?.step || 0,
            hasData: !!msg?.data
        })),
        researchReport: processedResearchReportData
            .filter(Boolean)
            .map(msg => ({
                type: msg?.type || 'unknown',
                dataType: typeof msg?.data || 'undefined',
                dataPreview: typeof msg?.data === 'string' ? msg?.data.substring(0, 100) : null
            }))
    })

    // Get the latest workflow step
    const latestWorkflowUpdate =
        processedWorkflowUpdates.length > 0 ? processedWorkflowUpdates[processedWorkflowUpdates.length - 1] : null

    // Use the display property from WorkflowMessage type
    const workflowDisplay =
        latestWorkflowUpdate?.display?.kind === 'workflow' ? latestWorkflowUpdate.display : undefined

    // 研究报告内容的处理逻辑
    const toolMarkdownContent = toolResults?.markdownContent || '';

    console.log('研报内容来源检查:', {
        hasToolMarkdownContent: !!toolMarkdownContent,
        toolMarkdownContentLength: toolMarkdownContent?.length || 0,
        hasReportContentState: !!reportContent,
        reportContentLength: reportContent?.length || 0,
        processedResearchReportDataCount: processedResearchReportData?.length || 0
    });

    // 优先使用工具结果中的markdownContent
    const finalReportContent = toolMarkdownContent || reportContent ||
        (processedResearchReportData.length > 0 && processedResearchReportData[0]?.data) || '';

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

    useEffect(() => {
        if (toolResults?.results) {
            console.log('从工具结果中获取到搜索结果:', toolResults.results.length);
        }
    }, [toolResults]);

    return (
        <CollapsibleMessage
            role="assistant"
            isCollapsible={true}
            header={header}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            showIcon={false}
        >
            {/* 简化的调试信息 - 仅在开发环境显示 */}
            {process.env.NODE_ENV === 'development' && (
                <div className="text-xs border p-2 bg-gray-100 dark:bg-gray-800 rounded mb-2">
                    <p>工具状态: {tool?.state || 'undefined'} | 结果: {searchResultItems.length}项 | 研报: {finalReportContent?.length || 0}字符</p>
                </div>
            )}

            {/* 搜索结果部分 */}
            <Section title="搜索过程">
                {isToolLoading ? (
                    <div className="p-4 space-y-4 animate-pulse">
                        <div className="h-5 bg-muted rounded w-1/3"></div>
                        <div className="h-20 bg-muted rounded"></div>
                        <div className="h-20 bg-muted rounded"></div>
                    </div>
                ) : searchResultItems.length > 0 ? (
                    // 优先使用从工具结果中获取的搜索结果
                    <div className="mb-4">
                        <SearchResults results={searchResultItems} />
                    </div>
                ) : processedSearchResultMessages.length > 0 ? (
                    // 备用：使用从中间数据中解析的搜索结果
                    <>
                        {processedSearchResultMessages.map((msg, index) => (
                            msg && msg.display?.results && (
                                <div key={`search-result-${index}`} className="mb-4 border-b pb-4 last:border-b-0 last:pb-0">
                                    <h3 className="font-semibold text-sm mb-2">{msg.display.title || '搜索结果'}</h3>
                                    <SearchResults results={msg.display.results as SearchResultItem[]} />
                                </div>
                            )
                        ))}
                    </>
                ) : (
                    <div className="p-4 text-center text-muted-foreground">暂无搜索结果</div>
                )}
            </Section>

            {/* 研究报告部分 - 使用BotMessage组件正确渲染Markdown */}
            <Section title="研究报告">
                {isToolLoading ? (
                    <div className="p-4 space-y-4 animate-pulse">
                        <div className="h-5 bg-muted rounded w-1/2"></div>
                        <div className="h-20 bg-muted rounded"></div>
                        <div className="h-5 bg-muted rounded w-1/3 mt-4"></div>
                        <div className="h-20 bg-muted rounded"></div>
                    </div>
                ) : (
                    <div className="prose dark:prose-invert max-w-none">
                        {finalReportContent ? (
                            <div className="markdown-content">
                                {/* 使用与聊天回复相同的BotMessage组件，确保正确渲染Markdown */}
                                <BotMessage message={finalReportContent} />
                            </div>
                        ) : (
                            <div className="p-4 text-center text-yellow-500">
                                研报数据未能正确加载，请尝试重新生成。
                                <div className="mt-2">
                                    <button
                                        onClick={handleRetry}
                                        className="px-3 py-1 bg-muted hover:bg-muted/80 rounded-md text-sm"
                                        disabled={retryCount >= 3}
                                    >
                                        重试生成
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Section>

            {/* 只在开发环境显示工作流和数据分析部分 */}
            {process.env.NODE_ENV === 'development' && (
                <>
                    {/* 数据分析部分 */}
                    <Section title="数据分析">
                        {processedDataDisplayMessages.length > 0 ? (
                            processedDataDisplayMessages.map((msg, index) => (
                                msg.display && (
                                    <div key={`data-display-${index}`} className="mb-4">
                                        <h3 className="font-semibold text-sm mb-1">{msg.display.title || '数据'}</h3>
                                        <div className="bg-muted p-2 rounded-md">
                                            {msg.display.kind === 'stock-info' && msg.display.content && (
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div><span className="font-semibold">公司名称:</span> {msg.display.content.name}</div>
                                                    <div><span className="font-semibold">股票代码:</span> {msg.display.content.code}</div>
                                                    <div><span className="font-semibold">所属行业:</span> {msg.display.content.industry}</div>
                                                    <div><span className="font-semibold">所在地区:</span> {msg.display.content.area}</div>
                                                    <div><span className="font-semibold">交易市场:</span> {msg.display.content.market}</div>
                                                    <div><span className="font-semibold">上市日期:</span> {msg.display.content.listDate}</div>
                                                </div>
                                            )}
                                            {msg.display.kind === 'financial-info' && msg.display.content && (
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div><span className="font-semibold">利润表:</span> {msg.display.content.income}</div>
                                                    <div><span className="font-semibold">资产负债表:</span> {msg.display.content.balance}</div>
                                                    <div><span className="font-semibold">现金流量表:</span> {msg.display.content.cashflow}</div>
                                                    <div><span className="font-semibold">财务指标:</span> {msg.display.content.indicators}</div>
                                                </div>
                                            )}
                                            {msg.display.kind === 'market-info' && msg.display.content && (
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div><span className="font-semibold">数据点数:</span> {msg.display.content.dataPoints}</div>
                                                    <div><span className="font-semibold">开始日期:</span> {msg.display.content.startDate}</div>
                                                    <div><span className="font-semibold">结束日期:</span> {msg.display.content.endDate}</div>
                                                    <div><span className="font-semibold">开始价格:</span> {msg.display.content.startPrice}</div>
                                                    <div><span className="font-semibold">结束价格:</span> {msg.display.content.endPrice}</div>
                                                    <div><span className="font-semibold">价格变化:</span> {msg.display.content.priceChange}</div>
                                                </div>
                                            )}
                                            {(msg.display.kind !== 'stock-info' && msg.display.kind !== 'financial-info' && msg.display.kind !== 'market-info') && (
                                                <pre className="text-xs overflow-auto">{JSON.stringify(msg.display.content, null, 2)}</pre>
                                            )}
                                        </div>
                                    </div>
                                )
                            ))
                        ) : (
                            <div className="p-2 text-orange-500">暂无数据分析结果</div>
                        )}
                    </Section>

                    {/* 工作流进度 */}
                    <Section title="研报生成进度">
                        {workflowDisplay ? (
                            <AIWorkflow
                                trigger={latestWorkflowUpdate?.message || workflowDisplay.title || '启动中...'}
                                displayMode="inline"
                                onComplete={() => {
                                    console.log('工作流完成')
                                }}
                            />
                        ) : (
                            <div className="p-2 text-orange-500">暂无工作流数据</div>
                        )}
                    </Section>
                </>
            )}

            {/* Display Error if any */}
            {latestWorkflowUpdate?.type === 'workflow-error' && (
                <Section title="错误">
                    <div className="space-y-2">
                        <p className="text-red-500">
                            {latestWorkflowUpdate.error}
                            {retryCount > 0 && ` (已重试 ${retryCount} 次)`}
                        </p>
                        {latestWorkflowUpdate.details && (
                            <p className="text-sm text-gray-500">{latestWorkflowUpdate.details}</p>
                        )}
                        {latestWorkflowUpdate.suggestion && (
                            <p className="text-sm text-yellow-500">建议: {latestWorkflowUpdate.suggestion}</p>
                        )}
                        <div className="space-x-2 mt-2">
                            <button
                                onClick={handleRetry}
                                className="px-3 py-1 bg-muted hover:bg-muted/80 rounded-md text-sm"
                                disabled={retryCount >= 3}
                            >
                                重试
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-3 py-1 bg-muted hover:bg-muted/80 rounded-md text-sm"
                            >
                                刷新页面
                            </button>
                        </div>
                    </div>
                </Section>
            )}
        </CollapsibleMessage>
    )
} 