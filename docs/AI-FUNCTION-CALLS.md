# AI Function Calls 配置与调用文档

## 概述

本文档详细说明了项目中AI function calls的配置方式和调用流程。系统采用了基于工具调用(Tool Calling)的架构，允许AI助手通过预定义的函数与系统进行交互。

## 核心组件

### 1. 工具注册表 (Tool Registry)

工具注册表定义在 `lib/utils/registry.ts` 中，负责管理所有可用的AI模型和它们的工具调用能力：

```typescript
export function isToolCallSupported(model?: string) {
  const [provider, ...modelNameParts] = model?.split(':') ?? []
  const modelName = modelNameParts.join(':')

  // 特定模型的工具调用支持判断
  if (provider === 'ollama') {
    return false
  }
  if (provider === 'google') {
    return false
  }
  return !modelName?.includes('deepseek')
}
```

### 2. 工具执行器 (Tool Executor)

工具执行器位于 `lib/streaming/tool-execution.ts`，负责解析和执行工具调用：

```typescript
export async function executeToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  searchMode: boolean
): Promise<ToolExecutionResult>
```

主要功能：
- 解析AI助手的工具调用请求
- 执行相应的工具函数
- 返回执行结果
- 处理错误情况

### 3. 工具调用流程

1. **初始化请求**
   - 系统接收用户输入
   - 创建消息上下文
   - 选择合适的AI模型

2. **生成工具调用**
   - AI模型分析用户需求
   - 选择合适的工具
   - 生成工具调用XML

3. **执行工具调用**
   - 解析工具调用XML
   - 验证参数
   - 执行工具函数
   - 返回结果

4. **结果处理**
   - 格式化工具执行结果
   - 更新UI状态
   - 触发回调函数

## 工具类型

系统支持以下几种主要的工具类型：

1. **搜索工具 (Search)**
```typescript
interface SearchParameters {
  query: string;
  max_results?: number;
  search_depth?: 'basic' | 'advanced';
  include_domains?: string[];
  exclude_domains?: string[];
}
```

2. **视频搜索 (VideoSearch)**
```typescript
interface VideoSearchParameters {
  query: string;
  max_results?: number;
}
```

3. **数据检索 (Retrieve)**
```typescript
interface RetrieveParameters {
  id: string;
  type: string;
}
```

## 配置示例

### 1. 模型配置

在 `public/config/models.json` 中配置模型的工具调用能力：

```json
{
  "id": "gemini-2.0-flash",
  "name": "Gemini 2.0 Flash",
  "provider": "Google Generative AI",
  "providerId": "google",
  "enabled": true,
  "toolCallType": "manual"
}
```

### 2. 工具调用配置

在组件中使用工具调用：

```typescript
const { state, dispatch } = useWorkflow();

// 触发工具调用
const handleToolCall = async () => {
  try {
    dispatch({ type: 'START_WORKFLOW' });
    const result = await executeToolCall(messages, dataStream, model, true);
    dispatch({ type: 'SET_RESULT', payload: result });
  } catch (error) {
    dispatch({ type: 'SET_ERROR', payload: error.message });
  }
};
```

## 错误处理

系统实现了完整的错误处理机制：

1. **工具调用错误**
   - 参数验证失败
   - 执行超时
   - 资源不可用

2. **模型错误**
   - 模型不支持工具调用
   - 响应格式错误
   - API限制

## 最佳实践

1. **工具调用设计**
   - 保持工具功能单一
   - 提供清晰的参数说明
   - 实现适当的错误处理

2. **性能优化**
   - 使用流式响应
   - 实现结果缓存
   - 控制并发请求

3. **用户体验**
   - 提供清晰的进度反馈
   - 实现优雅的错误提示
   - 支持取消操作

## 调试与监控

1. **日志记录**
   - 工具调用请求
   - 执行结果
   - 错误信息

2. **性能指标**
   - 响应时间
   - 成功率
   - 资源使用

## 安全考虑

1. **访问控制**
   - API密钥管理
   - 用户权限验证
   - 请求限制

2. **数据安全**
   - 敏感信息处理
   - 数据加密
   - 安全传输

## 多工具工作流升级方案

本章节介绍如何扩展现有的单工具调用架构，支持多工具顺序执行的工作流。

### 1. 工具注册与管理升级

为支持多工具调用，需要创建统一的工具注册中心：

```typescript
// lib/tools/registry.ts
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<any>;
  execute: (params: any) => Promise<any>;
}

// 工具注册表
const toolRegistry: Record<string, ToolDefinition> = {};

// 注册工具
export function registerTool(toolId: string, toolDef: ToolDefinition) {
  toolRegistry[toolId] = toolDef;
}

// 获取工具
export function getTool(toolId: string): ToolDefinition | undefined {
  return toolRegistry[toolId];
}

// 获取所有工具
export function getAllTools(): Record<string, ToolDefinition> {
  return { ...toolRegistry };
}
```

### 2. 工作流定义和执行

工作流由多个工具调用步骤组成，支持参数传递：

```typescript
// lib/workflow/index.ts
export interface WorkflowStep {
  toolId: string;
  params: Record<string, any> | ((prevResults: any[]) => Record<string, any>);
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

// 预定义工作流示例
export const predefinedWorkflows: Record<string, Workflow> = {
  'financial_alert': {
    id: 'financial_alert',
    name: '财务异常预警器',
    description: '监控关键指标异动',
    steps: [
      { 
        toolId: 'search', 
        params: { 
          query: '财务异常指标识别方法',
          search_depth: 'advanced'
        } 
      },
      { 
        toolId: 'retrieve', 
        params: (prevResults) => {
          // 使用前一步骤的结果动态生成参数
          const searchResults = prevResults[0];
          return { 
            id: searchResults[0]?.id,
            type: 'article'
          };
        } 
      }
    ]
  }
};
```

### 3. 工作流执行引擎

新增工作流执行引擎，支持多步骤执行和结果传递：

```typescript
// lib/workflow/execute-workflow.ts
export async function executeWorkflow(
  workflowId: string,
  dataStream: DataStreamWriter,
  coreMessages: CoreMessage[],
  model: string
): Promise<any[]> {
  const workflow = predefinedWorkflows[workflowId];
  if (!workflow) {
    throw new Error(`未找到工作流: ${workflowId}`);
  }
  
  // 执行工作流步骤
  const results = [];
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    
    // 更新UI进度
    dataStream.writeData({
      type: 'workflow_progress',
      data: {
        currentStep: i,
        totalSteps: workflow.steps.length,
        stepName: `执行${step.toolId}工具`
      }
    });
    
    // 解析参数 - 静态或动态
    const params = typeof step.params === 'function' 
      ? step.params(results) 
      : step.params;
    
    // 执行工具调用
    const result = await executeTool(step.toolId, params, dataStream, coreMessages, model);
    results.push(result);
    
    // 添加结果到消息历史
    coreMessages.push({
      role: 'assistant',
      content: `Tool ${step.toolId} result: ${JSON.stringify(result)}`
    });
  }
  
  return results;
}
```

### 4. 扩展工具执行器

修改工具执行逻辑，支持动态工具选择：

```typescript
// lib/streaming/execute-tool.ts
export async function executeTool(
  toolId: string,
  params: Record<string, any>,
  dataStream: DataStreamWriter,
  coreMessages: CoreMessage[],
  model: string
): Promise<any> {
  const tool = getTool(toolId);
  if (!tool) {
    throw new Error(`未找到工具: ${toolId}`);
  }
  
  // 验证参数
  const validatedParams = tool.schema.parse(params);
  
  // 执行工具调用
  return await tool.execute(validatedParams);
}
```

### 5. 改进系统提示

优化AI对工具选择的能力，使用更清晰的指令：

```typescript
const systemPrompt = `You are an intelligent assistant analyzing this conversation to determine the most appropriate tool to use.

You excel at understanding complex requests and selecting the appropriate tool.
Current date: ${new Date().toISOString().split('T')[0]}

Available tools:
${Object.entries(getAllTools()).map(([id, tool]) => 
  `- ${id}: ${tool.description}`
).join('\n')}

For each tool, provide parameters in this format:
${Object.entries(getAllTools()).map(([id, tool]) => {
  const schemaString = Object.entries(tool.schema.shape)
    .map(([key, value]) => {
      const description = value.description;
      const isOptional = value instanceof z.ZodOptional;
      return `  - ${key}${isOptional ? ' (optional)' : ''}: ${description}`;
    })
    .join('\n');
  return `Tool: ${id}\n${schemaString}`;
}).join('\n\n')}

Respond in XML format with your selected tool and parameters.`;
```

### 6. 用户体验增强

扩展工作流UI组件，显示多步骤执行状态：

```typescript
const WorkflowProgressDisplay = ({ 
  currentStep, 
  totalSteps, 
  stepInfo,
  results 
}) => {
  return (
    <div className="workflow-progress">
      <h3>工作流执行进度: {currentStep}/{totalSteps}</h3>
      <div className="steps-container">
        {[...Array(totalSteps)].map((_, index) => (
          <div 
            key={index} 
            className={`step ${
              index < currentStep ? 'completed' : 
              index === currentStep ? 'active' : 'pending'
            }`}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-info">
              {index < currentStep && results[index] && (
                <div className="step-result">
                  {/* 显示结果摘要 */}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 7. 实现计划

工作流系统实现分为四个阶段：

1. **阶段一：基础设施**
   - 实现工具注册表 (`lib/tools/registry.ts`)
   - 标准化工具接口定义
   - 转换现有工具到新接口

2. **阶段二：工作流结构**
   - 实现工作流定义 (`lib/workflow/index.ts`)
   - 开发工作流执行引擎 (`lib/workflow/execute-workflow.ts`)
   - 支持步骤间结果传递

3. **阶段三：UI组件**
   - 实现工作流进度组件
   - 开发工作流选择器
   - 集成到现有对话界面

4. **阶段四：完善和优化**
   - 增强错误处理
   - 改进系统提示
   - 添加更多预定义工作流

### 8. 注意事项与最佳实践

1. **兼容性考虑**
   - 保持向后兼容，现有功能不受影响
   - 渐进式启用新功能，避免破坏性变更

2. **错误处理增强**
   - 工作流级别的错误恢复
   - 步骤失败后的回退策略
   - 清晰的错误提示与建议

3. **性能优化**
   - 缓存频繁使用的工具结果
   - 优化消息历史大小，避免上下文爆炸
   - 支持长时间运行的工作流暂停和恢复

## 扩展开发

要添加新的工具类型，需要：

1. 定义工具接口
2. 实现工具函数
3. 注册工具
4. 更新类型定义
5. 添加相应的UI组件

## 常见问题

1. **工具调用失败**
   - 检查模型支持
   - 验证参数格式
   - 查看错误日志

2. **性能问题**
   - 优化请求频率
   - 实现缓存机制
   - 控制并发数量

3. **集成问题**
   - 检查API配置
   - 验证权限设置
   - 更新依赖版本 