# Azure OpenAI 配置说明

在 Morphic 项目中使用 Azure OpenAI 服务需要正确配置三个关键参数：

## 必要参数

1. **API Key**: Azure OpenAI 服务的访问密钥
2. **Resource Name**: Azure OpenAI 资源的名称
3. **Deployment Name**: 部署的特定模型名称

## 配置步骤

### 1. 环境变量配置

首先，在 `.env.local` 文件中设置 API Key 和 Resource Name：

```bash
AZURE_API_KEY=your_azure_api_key_here
AZURE_RESOURCE_NAME=your_azure_resource_name_here
```

这两个参数用于认证和定位 Azure OpenAI 服务的实例。

### 2. 模型配置

接下来，需要在 `public/config/models.json` 文件中配置部署名称。找到以下部分：

```json
{
  "id": "<AZURE_DEPLOYMENT_NAME>",
  "name": "<AZURE_DEPLOYMENT_NAME>",
  "provider": "Azure",
  "providerId": "azure",
  "enabled": true,
  "toolCallType": "native"
}
```

将 `<AZURE_DEPLOYMENT_NAME>` 替换为你在 Azure 上部署的模型名称。例如，如果你的部署名称是 "gpt-4-turbo"，则配置应该为：

```json
{
  "id": "gpt-4-turbo",
  "name": "GPT-4 Turbo (Azure)",
  "provider": "Azure",
  "providerId": "azure",
  "enabled": true,
  "toolCallType": "native"
}
```

### 3. 多个部署配置

如果你有多个 Azure OpenAI 模型部署，可以在 `models.json` 中添加多个配置项：

```json
{
  "id": "gpt-4-turbo",
  "name": "GPT-4 Turbo (Azure)",
  "provider": "Azure",
  "providerId": "azure",
  "enabled": true,
  "toolCallType": "native"
},
{
  "id": "gpt-4o",
  "name": "GPT-4o (Azure)",
  "provider": "Azure",
  "providerId": "azure",
  "enabled": true,
  "toolCallType": "native"
}
```

## 工作原理

在 `lib/utils/registry.ts` 中，项目使用以下配置初始化 Azure 提供商：

```typescript
azure: createAzure({
  apiKey: process.env.AZURE_API_KEY,
  resourceName: process.env.AZURE_RESOURCE_NAME,
  apiVersion: '2025-03-01-preview'
})
```

当使用 Azure 模型时，系统会使用 `models.json` 中的 `id` 值作为部署名称。

## 常见问题

### 为什么 Azure OpenAI 需要三个参数？

- **API Key**: 用于验证请求的安全性
- **Resource Name**: 用于定位 Azure 中的特定资源
- **Deployment Name**: 用于指定资源中部署的特定模型版本

与标准的 OpenAI API 不同，Azure OpenAI 将模型部署为资源内的命名部署，因此需要这三个参数共同工作。

### 如何检查配置是否正确？

确保：
1. `.env.local` 文件中 `AZURE_API_KEY` 和 `AZURE_RESOURCE_NAME` 值正确
2. `public/config/models.json` 中的 `id` 字段包含正确的部署名称
3. Azure 资源中实际存在该名称的部署 