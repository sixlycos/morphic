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