'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { CHAT_ID } from '@/lib/constants'
import type { SearchResults as TypeSearchResults } from '@/lib/types'
import { useChat } from '@ai-sdk/react'
import { ToolInvocation } from 'ai'
import { useEffect, useState } from 'react'
import { CollapsibleMessage } from './collapsible-message'
import { SearchSkeleton } from './default-skeleton'
import { SearchResults } from './search-results'
import { SearchResultsImageSection } from './search-results-image'
import { Section, ToolArgsSection } from './section'

interface SearchSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchSection({
  tool,
  isOpen,
  onOpenChange
}: SearchSectionProps) {
  const { status } = useChat({
    id: CHAT_ID
  })
  const [isError, setIsError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const isLoading = status === 'submitted' || status === 'streaming'

  const isToolLoading = tool.state === 'call'
  const searchResults: TypeSearchResults =
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args?.query as string | undefined
  const includeDomains = tool.args?.includeDomains as string[] | undefined
  const includeDomainsString = includeDomains
    ? ` [${includeDomains.join(', ')}]`
    : ''

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    setIsError(false)
    if (onOpenChange) {
      onOpenChange(false)
      setTimeout(() => onOpenChange(true), 100)
    }
  }

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      if (error.message.includes('message channel closed before a response was received')) {
        console.error('捕获到消息通道错误:', error)
        setIsError(true)

        if (retryCount < 3) {
          console.log(`自动重试 (${retryCount + 1}/3)...`)
          handleRetry()
        }
      }
    }

    window.addEventListener('error', handleError)
    return () => {
      window.removeEventListener('error', handleError)
    }
  }, [retryCount, onOpenChange])

  useEffect(() => {
    if (tool.state === 'result' && searchResults) {
      setIsError(false)
      setRetryCount(0)
    }
  }, [tool.state, searchResults])

  console.log('SearchSection render:', {
    toolState: tool.state,
    hasResults: !!searchResults,
    resultsLength: searchResults?.results?.length,
    query,
    isLoading,
    isToolLoading,
    isError,
    retryCount
  })

  useEffect(() => {
    console.log('SearchSection state changed:', {
      toolState: tool.state,
      hasResults: !!searchResults,
      resultsLength: searchResults?.results?.length,
      isLoading,
      isToolLoading
    })
  }, [tool.state, searchResults, isLoading, isToolLoading])

  const { open } = useArtifact()
  const header = (
    <button
      type="button"
      onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection
        tool="search"
        number={searchResults?.results?.length}
      >{`${query}${includeDomainsString}`}</ToolArgsSection>
    </button>
  )

  if (isError) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="p-4 text-center">
          <p className="text-red-500 mb-2">
            搜索结果加载失败
            {retryCount > 0 && ` (已重试 ${retryCount} 次)`}
          </p>
          <div className="space-x-2">
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
      </CollapsibleMessage>
    )
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {searchResults &&
        searchResults.images &&
        searchResults.images.length > 0 && (
          <Section>
            <SearchResultsImageSection
              images={searchResults.images}
              query={query}
            />
          </Section>
        )}
      {isToolLoading ? (
        <SearchSkeleton />
      ) : searchResults?.results && searchResults.results.length > 0 ? (
        <Section title="Sources">
          <SearchResults results={searchResults.results} />
        </Section>
      ) : !isToolLoading && !searchResults?.results ? (
        <div className="p-4 text-center text-muted-foreground">
          未找到相关搜索结果
        </div>
      ) : null}
    </CollapsibleMessage>
  )
}
