# 本地大模型代理服务 API 使用说明

## 项目概述

本项目是一个基于 Node.js 的本地大模型代理服务 API，用于封装对中国移动九天大模型（jiutian-lan）的调用。该服务提供了统一的接口，支持问答（completions）和对话（chat）两种模式，并且每种模式都支持流式和非流式返回。

## 功能特点

- 统一封装九天大模型的 Completions 和 Chat 接口
- 支持非流式和流式（SSE）返回两种模式
- 自动处理 JWT Token 生成和认证
- 简单的控制台日志记录
- 通过环境变量进行配置

## 安装与配置

### 前置条件

- Node.js v18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

或

```bash
yarn install
```

### 配置环境变量

在项目根目录创建 `.env` 文件，并设置以下环境变量：

```
# 九天大模型 API Key
JIUTIAN_API_KEY=your_api_key_here

# 服务端口
PORT=3000

# 环境模式 (development 或 production)
NODE_ENV=production
```

## 启动服务

```bash
node app.js
```

服务启动后，将在控制台输出以下信息：

```
服务已启动: http://localhost:3000
健康检查: http://localhost:3000/health
问答接口: http://localhost:3000/api/completions
对话接口: http://localhost:3000/api/chat
```

## API 接口说明

### 1. 问答接口（Completions）

**请求地址**：`POST /api/completions`

**请求参数**：

```json
{
  "model": "jiutian-lan",
  "prompt": "用200字介绍一下北京",
  "temperature": 0.1,
  "top_p": 0.1,
  "history": [],
  "stream": false
}
```

**非流式返回示例**：

```json
{
  "choices": [
    {
      "text": "北京，中国的首都，是一个历史悠久、文化丰富的城市……",
      "index": 0,
      "finish_reason": "stop",
      "type": "text",
      "status": "finish"
    }
  ],
  "model": "jiutian-lan",
  "usage": {
    "prompt_tokens": 17,
    "completion_tokens": 127,
    "total_tokens": 144
  },
  "object": "chat.completion"
}
```

**流式请求示例**：

```json
{
  "model": "jiutian-lan",
  "prompt": "2*3=？",
  "temperature": 0.1,
  "top_p": 0.1,
  "history": [],
  "stream": true
}
```

**流式返回示例**：

```
data: {
  "created": 1725502748,
  "model": "jiutian-lan",
  "id": "dc443cc0-6ca2-4ec5-a918-b6940565c5e3",
  "choices": [
    {
      "delta": {
        "index": 0,
        "text": "2",
        "type": "text",
        "status": "init"
      }
    }
  ],
  "object": "chat.completion.chunk"
}

// 更多数据块...

data: {
  "created": 1725502748,
  "usage": {
    "completion_tokens": 6,
    "prompt_tokens": 15,
    "total_tokens": 21
  },
  "model": "jiutian-lan",
  "id": "dc443cc0-6ca2-4ec5-a918-b6940565c5e3",
  "choices": [
    {
      "delta": {
        "finish_reason": "stop",
        "index": 0,
        "type": "text",
        "status": "finish"
      }
    }
  ],
  "completionMsg": {
    "modelId": "jiutian-lan",
    "modelVersion": "V3"
  },
  "object": "chat.completion.chunk"
}
```

### 2. 对话接口（Chat）

**请求地址**：`POST /api/chat`

**请求参数**：

```json
{
  "model": "jiutian-lan",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "2020年谁赢得了世界大赛？"},
    {"role": "assistant", "content": "道奇队赢得了2020年世界大赛。"},
    {"role": "user", "content": "在哪里打的？"}
  ],
  "temperature": 0.1,
  "top_p": 0.1,
  "stream": false
}
```

**非流式返回示例**：

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "2020年世界大赛在德克萨斯州的阿灵顿环球人寿球场举行。"
      },
      "index": 0,
      "finish_reason": "stop",
      "type": "text",
      "status": "finish"
    }
  ],
  "model": "jiutian-lan",
  "usage": {
    "prompt_tokens": 52,
    "completion_tokens": 22,
    "total_tokens": 74
  },
  "object": "chat.completion"
}
```

**流式模式**：

与问答接口类似，将 `stream` 参数设置为 `true` 即可启用流式返回。

### 3. 健康检查接口

**请求地址**：`GET /health`

**返回示例**：

```json
{
  "status": "ok",
  "timestamp": "2025-05-20T13:21:37.000Z"
}
```

## 错误处理

当 API 调用失败时，将返回以下格式的错误信息：

```json
{
  "error": "九天模型调用失败",
  "detail": "错误详细信息"
}
```

在开发环境（`NODE_ENV=development`）下，还会包含错误堆栈信息。

## 注意事项

1. 请确保 `.env` 文件中的 `JIUTIAN_API_KEY` 正确设置
2. 流式响应使用 Server-Sent Events (SSE) 格式
3. 所有接口调用都会在控制台记录日志
4. JWT Token 有效期默认为 1 小时（3600 秒）
