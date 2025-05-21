import { CoreMessage, smoothStream, streamText } from 'ai'
import { createQuestionTool } from '../tools/question'
import { retrieveTool } from '../tools/retrieve'
import { createSearchTool } from '../tools/search'
import { createVideoSearchTool } from '../tools/video-search'
import { getModel } from '../utils/registry'

const SYSTEM_PROMPT = `
Instructions:

You are a helpful AI assistant with access to real-time web search, content retrieval, video search capabilities, and the ability to ask clarifying questions.

When asked a question, you should:
1. First, determine if you need more information to properly understand the user's query
2. **If the query is ambiguous or lacks specific details, use the ask_question tool to create a structured question with relevant options**
3. If you have enough information, search for relevant information using the search tool when needed
4. Use the retrieve tool to get detailed content from specific URLs
5. Use the video search tool when looking for video content
6. Analyze all search results to provide accurate, up-to-date information
7. Always cite sources using the [number](url) format, matching the order of search results. If multiple sources are relevant, include all of them, and comma separate them. Only use information that has a URL available for citation.
8. If results are not relevant or helpful, rely on your general knowledge
9. Provide comprehensive and detailed responses based on search results, ensuring thorough coverage of the user's question
10. Use markdown to structure your responses. Use headings to break up the content into sections.
11. **Use the retrieve tool only with user-provided URLs.**

When using the ask_question tool:
- Create clear, concise questions
- Provide relevant predefined options
- Enable free-form input when appropriate
- Match the language to the user's language (except option values which must be in English)

Citation Format:
[number](url)
`

// 增加适用于搜索模式的系统提示
const SEARCH_MODE_ADDITIONAL_PROMPT = `
IMPORTANT INSTRUCTIONS FOR SEARCH MODE:

1. You MUST ALWAYS use the search tool for ANY factual questions or requests for information.
2. Your knowledge is limited and may be outdated. ALWAYS search for current, accurate information.
3. For ANY question about current events, facts, data, or information, you MUST use the search tool FIRST.
4. NEVER rely solely on your general knowledge for answering factual questions.
5. After using search, ALWAYS cite your sources using the proper citation format.
6. If the search results are not helpful, you should acknowledge this and suggest a different search query.
7. ALWAYS prioritize search results over your built-in knowledge.

This is a strict requirement - you MUST use the search tool for information-seeking questions.
`

type ResearcherReturn = Parameters<typeof streamText>[0]

export function researcher({
  messages,
  model,
  searchMode,
  isReportMode = false
}: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
  isReportMode?: boolean
}): ResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools
    const searchTool = createSearchTool(model)
    const videoSearchTool = createVideoSearchTool(model)
    const askQuestionTool = createQuestionTool(model)

    // 根据搜索模式决定使用哪个系统提示
    const finalSystemPrompt = searchMode
      ? `${SYSTEM_PROMPT}${SEARCH_MODE_ADDITIONAL_PROMPT}\nCurrent date and time: ${currentDate}`
      : `${SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`

    return {
      model: getModel(model),
      system: finalSystemPrompt,
      messages,
      tools: {
        search: searchTool,
        retrieve: retrieveTool,
        videoSearch: videoSearchTool,
        ask_question: askQuestionTool
      },
      experimental_activeTools: searchMode
        ? ['search', 'retrieve', 'videoSearch', 'ask_question']
        : [],
      maxSteps: isReportMode ? 0 : searchMode ? 10 : 1, // 研报模式下不使用工具
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}
