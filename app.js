/**
 * 本地大模型代理服务 API
 * 基于九天大模型（jiutian-lan）
 * 支持 Completions（问答）和 Chat（对话）接口
 * 支持非流式和流式返回两种模式
 */

const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// 创建 Express 应用
const app = express();
app.use(express.json());

// 端口配置
const PORT = process.env.PORT || 3000;

// 九天大模型 API 基础 URL
const JIUTIAN_API_BASE_URL = "https://jiutian.10086.cn/largemodel/api/v2";

/**
 * 生成 JWT Token
 * @param {string} apiKey - 九天大模型 API Key
 * @param {number} expSeconds - Token 有效期（秒）
 * @returns {string} - JWT Token
 */
function generateToken(apiKey, expSeconds = 3600) {
  try {
    const [id, secret] = apiKey.split(".");
    
    const payload = {
      api_key: id,
      exp: Math.floor(Date.now() / 1000) + expSeconds,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(
      payload,
      secret,
      {
        algorithm: "HS256",
        header: { alg: "HS256", typ: "JWT", sign_type: "SIGN" }
      }
    );
  } catch (error) {
    console.error("JWT Token 生成失败:", error);
    throw new Error("无效的 API Key");
  }
}

/**
 * 日志记录中间件
 */
function loggerMiddleware(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  
  // 记录请求体（排除敏感信息）
  const requestBody = { ...req.body };
  delete requestBody.apiKey; // 排除敏感信息
  console.log(`请求体: ${JSON.stringify(requestBody)}`);
  
  // 记录响应
  const originalSend = res.send;
  res.send = function(body) {
    if (!req.body.stream) { // 非流式响应才记录
      console.log(`响应: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`);
    }
    return originalSend.call(this, body);
  };
  
  next();
}

// 应用日志中间件
app.use(loggerMiddleware);

/**
 * 问答接口 - 非流式
 */
app.post("/api/completions", async (req, res) => {
  try {
    // 检查是否为流式请求
    if (req.body.stream === true) {
      return handleStreamCompletions(req, res);
    }
    
    // 生成 JWT Token
    const jwtToken = generateToken(process.env.JIUTIAN_API_KEY);
    
    // 调用九天大模型 API
    const result = await axios.post(
      `${JIUTIAN_API_BASE_URL}/completions`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        }
      }
    );
    
    // 返回结果
    res.json(result.data);
  } catch (error) {
    console.error("问答接口调用失败:", error.message);
    res.status(500).json({ 
      error: "九天模型调用失败", 
      detail: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 问答接口 - 流式
 */
async function handleStreamCompletions(req, res) {
  try {
    // 生成 JWT Token
    const jwtToken = generateToken(process.env.JIUTIAN_API_KEY);
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 调用九天大模型 API（流式）
    const response = await axios.post(
      `${JIUTIAN_API_BASE_URL}/completions`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        },
        responseType: 'stream'
      }
    );
    
    // 将流式响应传递给客户端
    response.data.on('data', (chunk) => {
      res.write(chunk);
    });
    
    response.data.on('end', () => {
      res.end();
    });
    
    // 错误处理
    response.data.on('error', (err) => {
      console.error("流式响应错误:", err);
      res.end(`data: ${JSON.stringify({ error: "流式响应错误" })}\n\n`);
    });
    
  } catch (error) {
    console.error("流式问答接口调用失败:", error.message);
    res.write(`data: ${JSON.stringify({ error: "九天模型调用失败", detail: error.message })}\n\n`);
    res.end();
  }
}

/**
 * 对话接口 - 非流式和流式
 */
app.post("/api/chat", async (req, res) => {
  try {
    // 检查是否为流式请求
    if (req.body.stream === true) {
      return handleStreamChat(req, res);
    }
    
    // 生成 JWT Token
    const jwtToken = generateToken(process.env.JIUTIAN_API_KEY);
    
    // 调用九天大模型 API
    const result = await axios.post(
      `${JIUTIAN_API_BASE_URL}/chat/completions`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        }
      }
    );
    
    // 返回结果
    res.json(result.data);
  } catch (error) {
    console.error("对话接口调用失败:", error.message);
    res.status(500).json({ 
      error: "九天模型调用失败", 
      detail: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 对话接口 - 流式
 */
async function handleStreamChat(req, res) {
  try {
    // 生成 JWT Token
    const jwtToken = generateToken(process.env.JIUTIAN_API_KEY);
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 调用九天大模型 API（流式）
    const response = await axios.post(
      `${JIUTIAN_API_BASE_URL}/chat/completions`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        },
        responseType: 'stream'
      }
    );
    
    // 将流式响应传递给客户端
    response.data.on('data', (chunk) => {
      res.write(chunk);
    });
    
    response.data.on('end', () => {
      res.end();
    });
    
    // 错误处理
    response.data.on('error', (err) => {
      console.error("流式响应错误:", err);
      res.end(`data: ${JSON.stringify({ error: "流式响应错误" })}\n\n`);
    });
    
  } catch (error) {
    console.error("流式对话接口调用失败:", error.message);
    res.write(`data: ${JSON.stringify({ error: "九天模型调用失败", detail: error.message })}\n\n`);
    res.end();
  }
}

// 健康检查接口
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`问答接口: http://localhost:${PORT}/api/completions`);
  console.log(`对话接口: http://localhost:${PORT}/api/chat`);
});
