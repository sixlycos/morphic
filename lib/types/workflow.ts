// 工作流消息类型
export type WorkflowMessageType =
  | 'workflow-start'
  | 'workflow-progress'
  | 'workflow-complete'
  | 'workflow-error'
  | 'display'

// 工作流消息接口
export interface WorkflowMessage {
  type: WorkflowMessageType
  message?: string
  data?: any
  error?: string
  // 增强进度展示
  step?: number
  percentage?: number
  // 增强错误处理
  details?: string
  suggestion?: string
  // 展示字段
  display?: {
    kind: string
    status?: string
    step?: string
    title?: string
    steps?: string[]
    content?: any
    query?: string
    results?: any[]
  }
}

// 研报内容接口
export interface ResearchReportContent {
  title: string
  sections: {
    title: string
    content: string
  }[]
}

// 工作流数据流写入器
export interface WorkflowDataStream {
  write: (message: WorkflowMessage) => void
}

// JSONValue接口
export type JSONPrimitive = string | number | boolean | null
export type JSONValue = JSONPrimitive | JSONObject | JSONArray
export interface JSONObject {
  [key: string]: JSONValue
}
export interface JSONArray extends Array<JSONValue> {}

// 将工作流消息转换为JSON安全的消息
export function toJSONSafeMessage(message: WorkflowMessage): JSONObject {
  const result: JSONObject = { type: message.type }

  if (message.message !== undefined) result.message = message.message
  if (message.error !== undefined) result.error = message.error
  if (message.data !== undefined) result.data = JSON.stringify(message.data)
  if (message.step !== undefined) result.step = message.step
  if (message.percentage !== undefined) result.percentage = message.percentage
  if (message.details !== undefined) result.details = message.details
  if (message.suggestion !== undefined) result.suggestion = message.suggestion

  if (message.display) {
    result.display = {}
    if (message.display.kind) result.display.kind = message.display.kind
    if (message.display.status) result.display.status = message.display.status
    if (message.display.step) result.display.step = message.display.step
    if (message.display.title) result.display.title = message.display.title
    if (message.display.steps) result.display.steps = message.display.steps
    if (message.display.content)
      result.display.content = JSON.stringify(message.display.content)
    if (message.display.query) result.display.query = message.display.query
    if (message.display.results)
      result.display.results = JSON.stringify(message.display.results)
  }

  return result
}
