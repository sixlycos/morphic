# Tushare工具集成方案

## 需求概述

- 基于已有的工具选择器(tools-selector.tsx)集成Tushare数据获取功能
- 建立"工具流"概念，选择工具后按固定顺序执行一系列操作
- 实现对Tushare API的调用，获取金融数据
- 工具支持解耦，便于扩展不同Tushare接口

## 系统架构

当前系统使用基于工具调用(Tool Calling)的架构：
- `lib/streaming`目录处理AI响应流和工具调用
- `create-tool-calling-stream.ts`负责创建工具调用流
- `tool-execution.ts`负责解析和执行工具调用
- `tools-selector.tsx`提供工具选择UI

## Tushare API接入准备

### 1. 注册并获取Token
- 访问 [Tushare Pro](https://tushare.pro) 注册账号
- 完成实名认证后获取API Token
- 根据账号等级确认API调用权限和限制

### 2. 配置环境变量
在项目根目录创建或编辑 `.env.local` 文件：

```
TUSHARE_API_URL=http://api.waditu.com
TUSHARE_TOKEN=你的token值
```

确保在 `next.config.js` 中正确配置环境变量：

```javascript
module.exports = {
  env: {
    TUSHARE_API_URL: process.env.TUSHARE_API_URL,
    TUSHARE_TOKEN: process.env.TUSHARE_TOKEN,
  }
}
```

### 3. 安装依赖
```bash
npm install axios
```

## 实现方案

### 1. 定义Tushare工具接口

新建文件：`lib/tools/tushare-tools.ts`

```typescript
// 基础Tushare工具接口
export interface TushareToolBase {
  id: string;            // 工具唯一ID
  name: string;          // 工具名称
  description: string;   // 工具描述
  apiName: string;       // Tushare API名称
  requiredParams: string[]; // 必需参数
  optionalParams?: string[]; // 可选参数
}

// 特定Tushare工具实例
export const tushareTools: TushareToolBase[] = [
  {
    id: 'stock_basic',
    name: '股票列表',
    description: '获取基础股票列表数据',
    apiName: 'stock_basic',
    requiredParams: [],
    optionalParams: ['exchange', 'list_status'],
  },
  {
    id: 'daily',
    name: '日线行情',
    description: '获取股票日线数据',
    apiName: 'daily',
    requiredParams: ['ts_code'],
    optionalParams: ['trade_date', 'start_date', 'end_date'],
  },
  // 添加更多Tushare工具...
];
```

### 2. 创建API路由安全代理

新建文件：`app/api/tushare/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { api_name, params } = await req.json();
    
    // 安全检查 - 防止未授权访问
    // TODO: 根据项目需求添加认证和授权检查

    const response = await fetch(process.env.TUSHARE_API_URL || 'http://api.waditu.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_name,
        token: process.env.TUSHARE_TOKEN,
        params,
        fields: '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Tushare API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Tushare API error:', error);
    return NextResponse.json(
      { error: `调用Tushare API失败: ${(error as Error).message}` }, 
      { status: 500 }
    );
  }
}
```

### 3. 实现Tushare API调用服务

新建文件：`lib/services/tushare-service.ts`

```typescript
import axios from 'axios';

// Tushare API响应接口
export interface TushareResponse {
  code: number;
  msg: string;
  data?: {
    fields: string[];
    items: any[][];
  };
}

// Tushare请求配置
interface TushareRequestConfig {
  cacheTime?: number; // 缓存时间(毫秒)
  retries?: number;   // 重试次数
}

// 结果缓存
const apiCache = new Map<string, {data: any, timestamp: number}>();

// 调用Tushare API的核心函数
export async function callTushareApi(
  apiName: string,
  params: Record<string, any> = {},
  config: TushareRequestConfig = {}
): Promise<any> {
  try {
    // 生成缓存键
    const cacheKey = `${apiName}:${JSON.stringify(params)}`;
    
    // 检查缓存
    if (config.cacheTime) {
      const cached = apiCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < config.cacheTime)) {
        return cached.data;
      }
    }

    // 通过服务端API代理调用Tushare
    const response = await axios.post('/api/tushare', {
      api_name: apiName,
      params,
    });

    const result = response.data;

    // 检查Tushare API返回的错误
    if (result.code !== 0) {
      throw new Error(`Tushare错误: ${result.msg}`);
    }

    // 格式化返回结果为更易用的结构
    const formattedResult = formatTushareResult(result);
    
    // 更新缓存
    if (config.cacheTime) {
      apiCache.set(cacheKey, {
        data: formattedResult,
        timestamp: Date.now()
      });
    }

    return formattedResult;
  } catch (error) {
    // 处理错误重试逻辑
    if (config.retries && config.retries > 0) {
      console.warn(`Tushare API调用失败，重试中... (${config.retries}次剩余)`);
      return callTushareApi(apiName, params, {
        ...config,
        retries: config.retries - 1
      });
    }
    
    console.error(`Tushare API Error (${apiName}):`, error);
    throw new Error(`调用Tushare API失败: ${(error as Error).message}`);
  }
}

// 格式化Tushare返回结果为更易用的对象数组
function formatTushareResult(result: TushareResponse) {
  if (!result.data || !result.data.items) {
    return [];
  }

  const { fields, items } = result.data;
  return items.map(row => {
    const obj: Record<string, any> = {};
    fields.forEach((field, index) => {
      obj[field] = row[index];
    });
    return obj;
  });
}

// 使用SWR集成的Tushare数据钩子(可选)
// 需要安装SWR: npm install swr
/* 
import useSWR from 'swr';

export function useTushareData(apiName: string, params: Record<string, any>) {
  const fetcher = async () => callTushareApi(apiName, params, { cacheTime: 60 * 1000 });
  return useSWR(`tushare:${apiName}:${JSON.stringify(params)}`, fetcher);
}
*/
```

### 4. 创建Tushare工具执行器

新建文件：`lib/streaming/execute-tushare-tool.ts`

```typescript
import { DataStreamWriter } from 'ai';
import { callTushareApi } from '../services/tushare-service';
import { tushareTools } from '../tools/tushare-tools';

export interface TushareToolParams {
  toolId: string;
  params: Record<string, any>;
}

export async function executeTushareTool(
  toolParams: TushareToolParams,
  dataStream: DataStreamWriter
) {
  try {
    // 开始状态更新
    dataStream.write({
      type: 'tool-start',
      toolId: toolParams.toolId,
      params: toolParams.params
    });

    // 查找工具定义
    const toolDef = tushareTools.find(tool => tool.id === toolParams.toolId);
    if (!toolDef) {
      throw new Error(`未找到Tushare工具: ${toolParams.toolId}`);
    }

    // 验证必需参数
    const missingParams = toolDef.requiredParams.filter(
      param => !(param in toolParams.params)
    );
    if (missingParams.length > 0) {
      throw new Error(`缺少必需参数: ${missingParams.join(', ')}`);
    }

    // 进度更新
    dataStream.write({
      type: 'tool-progress',
      toolId: toolParams.toolId,
      message: '正在请求Tushare API...'
    });

    // 调用Tushare API (配置5秒缓存和3次重试)
    const result = await callTushareApi(toolDef.apiName, toolParams.params, {
      cacheTime: 5000,
      retries: 3
    });

    // 流式返回结果
    dataStream.write({
      type: 'tool-result',
      toolId: toolParams.toolId,
      result: result
    });

    return result;
  } catch (error) {
    console.error('Tushare工具执行错误:', error);
    dataStream.write({
      type: 'tool-error',
      toolId: toolParams.toolId,
      error: (error as Error).message
    });
    throw error;
  }
}
```

### 5. 修改工具执行器集成Tushare工具

修改文件：`lib/streaming/tool-execution.ts`

```typescript
// 现有代码中添加导入
import { executeTushareTool, TushareToolParams } from './execute-tushare-tool';

// 在executeToolCall函数中添加Tushare工具处理
export async function executeToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  searchMode: boolean
): Promise<ToolExecutionResult> {
  // 现有代码...
  
  // 解析工具调用
  const toolCall = parseToolCall(lastMessage);
  
  // 根据工具类型执行不同处理
  switch (toolCall.type) {
    // 现有工具类型处理...
    
    // 添加Tushare工具处理
    case 'tushare_api':
      const tushareParams = toolCall.parameters as TushareToolParams;
      await executeTushareTool(tushareParams, dataStream);
      break;
    
    default:
      throw new Error(`不支持的工具类型: ${toolCall.type}`);
  }
  
  // 现有代码...
}
```

### 6. 更新工具选择器组件添加Tushare工具

修改文件：`components/tools-selector.tsx`

```typescript
import { Database, LineChart } from 'lucide-react';

// 添加Tushare工具类别
const defaultTools: Tool[] = [
    // 现有工具...
    
    // 添加Tushare工具类别
    {
        id: 'stock_basic',
        name: '股票列表查询',
        category: 'Tushare数据',
        description: '获取基础股票信息',
        icon: <Database className="h-4 w-4 text-blue-500" />,
        color: 'bg-blue-100'
    },
    {
        id: 'daily',
        name: '日线行情查询',
        category: 'Tushare数据',
        description: '获取股票日线数据',
        icon: <LineChart className="h-4 w-4 text-green-500" />,
        color: 'bg-green-100'
    },
    // 添加更多Tushare工具...
]
```

### 7. 创建工具流执行器

新建文件：`lib/workflow/execute-tool-workflow.ts`

```typescript
import { DataStreamWriter } from 'ai';
import { executeTushareTool } from '../streaming/execute-tushare-tool';

// 工具流定义
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

// 预定义工作流
export const predefinedWorkflows: Record<string, Workflow> = {
  'financial_alert': {
    id: 'financial_alert',
    name: '财务异常预警器',
    description: '监控关键指标异动',
    steps: [
      { 
        toolId: 'stock_basic', 
        params: { list_status: 'L' } 
      },
      { 
        toolId: 'daily', 
        params: (prevResults) => {
          const stocks = prevResults[0].data;
          return { 
            ts_code: stocks[0].ts_code,
            start_date: '20230101',
            end_date: '20231231'
          };
        } 
      }
    ]
  },
  // 更多工作流定义...
};

// 执行工具流
export async function executeWorkflow(
  workflowId: string,
  dataStream: DataStreamWriter
) {
  // 查找工作流定义
  const workflow = predefinedWorkflows[workflowId];
  if (!workflow) {
    throw new Error(`未找到工作流: ${workflowId}`);
  }
  
  // 执行工作流步骤
  const results = [];
  for (const step of workflow.steps) {
    // 解析参数 - 可能是静态的或基于前面步骤结果的函数
    const params = typeof step.params === 'function' 
      ? step.params(results) 
      : step.params;
    
    // 执行工具
    const result = await executeTushareTool(
      { toolId: step.toolId, params },
      dataStream
    );
    
    results.push(result);
  }
  
  return results;
}
```

### 8. 创建工具流调用流处理器

新建文件：`lib/streaming/create-workflow-stream.ts`

```typescript
import {
  createDataStreamResponse,
  DataStreamWriter
} from 'ai';
import { executeWorkflow } from '../workflow/execute-tool-workflow';
import { BaseStreamConfig } from './types';

export interface WorkflowStreamConfig extends BaseStreamConfig {
  workflowId: string;
}

export function createWorkflowStreamResponse(config: WorkflowStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { workflowId } = config;

      try {
        // 执行工作流
        await executeWorkflow(workflowId, dataStream);
        
        // 完成标记
        dataStream.write({
          type: 'workflow-complete',
          workflowId
        });
      } catch (error) {
        console.error('工作流执行错误:', error);
        dataStream.write({
          type: 'workflow-error',
          workflowId,
          error: (error as Error).message
        });
        throw error;
      }
    },
    onError: error => {
      console.error('流处理错误:', error);
      return error instanceof Error ? error.message : String(error);
    }
  });
}
```

### 9. 更新API端点处理工具流调用

新建文件：`app/api/workflow/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createWorkflowStreamResponse } from '@/lib/streaming/create-workflow-stream';

export async function POST(req: NextRequest) {
  try {
    const { workflowId, userId, chatId } = await req.json();

    // 创建工作流流响应
    const streamResponse = createWorkflowStreamResponse({
      workflowId,
      chatId,
      userId,
      messages: [], // 工作流不需要消息上下文
      model: { providerId: 'system', id: 'workflow' },
      searchMode: false
    });

    return streamResponse;
  } catch (error) {
    console.error('工作流API错误:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

## 修改文件总结

| 文件                                             | 修改内容                      | 原因                              |
| ------------------------------------------------ | ----------------------------- | --------------------------------- |
| `lib/tools/tushare-tools.ts` (新建)              | 定义Tushare工具接口和具体实例 | 需要统一维护Tushare工具配置       |
| `app/api/tushare/route.ts` (新建)                | 创建Tushare API代理           | 保护API Token，解决CORS问题       |
| `lib/services/tushare-service.ts` (新建)         | 实现Tushare API调用逻辑       | 需要独立服务层处理API调用         |
| `lib/streaming/execute-tushare-tool.ts` (新建)   | 实现Tushare工具执行器         | 需要专门处理Tushare工具执行逻辑   |
| `lib/streaming/tool-execution.ts` (修改)         | 集成Tushare工具执行能力       | 现有工具执行器需要处理Tushare工具 |
| `components/tools-selector.tsx` (修改)           | 添加Tushare工具到选择器       | UI需要展示Tushare工具             |
| `lib/workflow/execute-tool-workflow.ts` (新建)   | 实现工具流定义和执行逻辑      | 支持顺序执行多个工具              |
| `lib/streaming/create-workflow-stream.ts` (新建) | 实现工作流流式处理            | 将工作流结果通过流返回            |
| `app/api/workflow/route.ts` (新建)               | 提供工作流调用API             | 提供前端调用工作流的接口          |

## 执行流程

1. 用户选择一个Tushare工具组合(如"财务异常预警器")
2. 前端调用`/api/workflow`接口，传递工作流ID
3. 服务端创建工作流流响应，执行预定义工作流
4. 工作流按步骤执行多个Tushare工具调用
5. 结果通过流式响应返回前端
6. 前端接收流式结果并更新UI展示

## 安全最佳实践

1. **Token保护**
   - 避免在前端暴露API Token
   - 使用服务端API路由代理所有Tushare请求

2. **请求限制**
   - 实现速率限制，避免超出Tushare API调用限额
   - 监控API调用量，合理安排请求频率

3. **错误处理**
   - 实现请求重试机制
   - 妥善处理API错误响应，提供友好的用户反馈

4. **数据缓存**
   - 实现短期缓存，减少重复请求
   - 对于稳定数据(如股票列表)可使用更长的缓存时间

## 优势

- **解耦设计**：工具定义与执行逻辑分离，便于维护
- **工作流支持**：支持复杂工作流定义，包括参数依赖关系
- **实时反馈**：流式响应提供实时反馈，改善用户体验
- **高扩展性**：易于添加新的Tushare接口和工作流
- **参数灵活性**：支持静态参数和动态参数(基于前序步骤结果)
- **安全性**：服务端代理模式保护API Token

## 技术栈选择

| 技术方向    | 推荐方案                 | 作用                         |
| ----------- | ------------------------ | ---------------------------- |
| HTTP 客户端 | axios                    | 可靠的HTTP请求处理           |
| 状态管理    | SWR / React Query (可选) | 客户端数据缓存和请求状态管理 |
| 类型定义    | TypeScript               | 提供类型安全                 |
| 错误监控    | Sentry (可选)            | 生产环境错误监控             |
| 缓存策略    | 内存缓存 + SWR           | 减少重复请求                 |

## 后续扩展

> 以下为可选的未来扩展方向，暂不需要实现

1. 添加工作流编辑器UI，允许用户自定义工作流
2. 增加参数验证和转换功能
3. 实现工作流执行历史和结果缓存
4. 添加数据可视化组件，展示Tushare数据结果
5. 支持定时执行工作流的能力 