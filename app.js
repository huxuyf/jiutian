/**
 * 本地大模型代理服务 API
 * 基于九天大模型（jiutian-lan）
 * 支持 Completions（问答）和 Chat（对话）接口
 * 支持非流式和流式返回两种模式
 * 增加 Ollama 兼容接口，支持 Cherry Studio 连接
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

// ============= Ollama 兼容接口 =============

/**
 * Ollama 兼容 - 模型列表接口
 * 对应 Ollama 的 /api/tags 接口
 */
app.get("/api/tags", (req, res) => {
  console.log("Ollama 兼容 - 获取模型列表");
  
  // 返回模型列表，包含九天大模型
  const models = [
    {
      name: "jiutian-lan",
      modified_at: new Date().toISOString(),
      size: 0,
      digest: "jiutian-lan-model-digest",
      details: {
        format: "gguf",
        family: "jiutian",
        families: null,
        parameter_size: "7B",
        quantization_level: "Q4_0"
      }
    }
  ];
  
  res.json({ models });
});

/**
 * Ollama 兼容 - 生成接口
 * 对应 Ollama 的 /api/generate 接口
 */
app.post("/api/generate", async (req, res) => {
  try {
    console.log("Ollama 兼容 - 生成接口");
    
    // 从请求中提取参数
    const { model, prompt, stream = true, system = "", options = {} } = req.body;
    
    // 检查模型是否为 jiutian-lan
    if (model !== "jiutian-lan") {
      return res.status(404).json({
        error: `模型 '${model}' 不存在，请使用 'jiutian-lan'`
      });
    }
    
    // 准备九天大模型的请求参数
    const jiutianParams = {
      model: "jiutian-lan",
      prompt: prompt,
      temperature: options.temperature || 0.7,
      top_p: options.top_p || 0.9,
      history: [],
      stream: stream
    };
    
    // 生成 JWT Token
    const jwtToken = generateToken(process.env.JIUTIAN_API_KEY);
    
    if (stream) {
      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // 调用九天大模型 API（流式）
      const response = await axios.post(
        `${JIUTIAN_API_BASE_URL}/completions`,
        jiutianParams,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwtToken}`
          },
          responseType: 'stream'
        }
      );
      
      let isFirstChunk = true;
      let fullResponse = "";
      
      // 处理流式响应
      response.data.on('data', (chunk) => {
        try {
          const text = chunk.toString();
          if (text.startsWith('data: ')) {
            const jsonStr = text.substring(6);
            const data = JSON.parse(jsonStr);
            
            // 提取文本内容
            let responseText = "";
            if (data.choices && data.choices.length > 0) {
              if (data.choices[0].delta && data.choices[0].delta.text) {
                responseText = data.choices[0].delta.text;
                fullResponse += responseText;
              }
            }
            
            // 构造 Ollama 格式的响应
            const ollamaResponse = {
              model: "jiutian-lan",
              created_at: new Date().toISOString(),
              response: responseText,
              done: false
            };
            
            // 发送响应
            res.write(`data: ${JSON.stringify(ollamaResponse)}\n\n`);
            
            // 检查是否是最后一个数据块
            if (data.choices && 
                data.choices[0].delta && 
                data.choices[0].delta.status === "finish") {
              
              // 构造最终响应
              const finalResponse = {
                model: "jiutian-lan",
                created_at: new Date().toISOString(),
                response: "",
                done: true,
                context: [1, 2, 3], // 模拟上下文
                total_duration: 1000000000, // 模拟耗时（纳秒）
                load_duration: 100000000,
                prompt_eval_count: prompt.length,
                prompt_eval_duration: 200000000,
                eval_count: fullResponse.length,
                eval_duration: 700000000
              };
              
              res.write(`data: ${JSON.stringify(finalResponse)}\n\n`);
              res.end();
            }
          }
        } catch (error) {
          console.error("处理流式响应出错:", error);
        }
      });
      
      // 错误处理
      response.data.on('error', (err) => {
        console.error("流式响应错误:", err);
        res.end(`data: ${JSON.stringify({ error: "流式响应错误" })}\n\n`);
      });
      
    } else {
      // 非流式请求
      const result = await axios.post(
        `${JIUTIAN_API_BASE_URL}/completions`,
        jiutianParams,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwtToken}`
          }
        }
      );
      
      // 提取文本内容
      let responseText = "";
      if (result.data.choices && result.data.choices.length > 0) {
        responseText = result.data.choices[0].text || "";
      }
      
      // 构造 Ollama 格式的响应
      const ollamaResponse = {
        model: "jiutian-lan",
        created_at: new Date().toISOString(),
        response: responseText,
        done: true,
        context: [1, 2, 3], // 模拟上下文
        total_duration: 1000000000, // 模拟耗时（纳秒）
        load_duration: 100000000,
        prompt_eval_count: prompt.length,
        prompt_eval_duration: 200000000,
        eval_count: responseText.length,
        eval_duration: 700000000
      };
      
      res.json(ollamaResponse);
    }
    
  } catch (error) {
    console.error("Ollama 兼容生成接口调用失败:", error.message);
    res.status(500).json({ 
      error: "生成失败", 
      detail: error.message
    });
  }
});

/**
 * Ollama 兼容 - 聊天接口
 * 对应 Ollama 的 /api/chat 接口
 */
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Ollama 兼容 - 聊天接口");
    
    // 从请求中提取参数
    const { model, messages, stream = true, options = {} } = req.body;
    
    // 检查模型是否为 jiutian-lan
    if (model !== "jiutian-lan") {
      return res.status(404).json({
        error: `模型 '${model}' 不存在，请使用 'jiutian-lan'`
      });
    }
    
    // 准备九天大模型的请求参数
    const jiutianParams = {
      model: "jiutian-lan",
      messages: messages,
      temperature: options.temperature || 0.7,
      top_p: options.top_p || 0.9,
      stream: stream
    };
    
    // 生成 JWT Token
    const jwtToken = generateToken(process.env.JIUTIAN_API_KEY);
    
    if (stream) {
      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // 调用九天大模型 API（流式）
      const response = await axios.post(
        `${JIUTIAN_API_BASE_URL}/chat/completions`,
        jiutianParams,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwtToken}`
          },
          responseType: 'stream'
        }
      );
      
      let fullContent = "";
      
      // 处理流式响应
      response.data.on('data', (chunk) => {
        try {
          const text = chunk.toString();
          if (text.startsWith('data: ')) {
            const jsonStr = text.substring(6);
            const data = JSON.parse(jsonStr);
            
            // 提取文本内容
            let contentDelta = "";
            if (data.choices && data.choices.length > 0 && 
                data.choices[0].delta && data.choices[0].delta.content) {
              contentDelta = data.choices[0].delta.content;
              fullContent += contentDelta;
            }
            
            // 构造 Ollama 格式的响应
            const ollamaResponse = {
              model: "jiutian-lan",
              created_at: new Date().toISOString(),
              message: {
                role: "assistant",
                content: contentDelta
              },
              done: false
            };
            
            // 发送响应
            res.write(`data: ${JSON.stringify(ollamaResponse)}\n\n`);
            
            // 检查是否是最后一个数据块
            if (data.choices && 
                data.choices[0].delta && 
                data.choices[0].delta.status === "finish") {
              
              // 构造最终响应
              const finalResponse = {
                model: "jiutian-lan",
                created_at: new Date().toISOString(),
                message: {
                  role: "assistant",
                  content: ""
                },
                done: true,
                total_duration: 1000000000, // 模拟耗时（纳秒）
                load_duration: 100000000,
                prompt_eval_duration: 200000000,
                eval_count: fullContent.length,
                eval_duration: 700000000
              };
              
              res.write(`data: ${JSON.stringify(finalResponse)}\n\n`);
              res.end();
            }
          }
        } catch (error) {
          console.error("处理流式响应出错:", error);
        }
      });
      
      // 错误处理
      response.data.on('error', (err) => {
        console.error("流式响应错误:", err);
        res.end(`data: ${JSON.stringify({ error: "流式响应错误" })}\n\n`);
      });
      
    } else {
      // 非流式请求
      const result = await axios.post(
        `${JIUTIAN_API_BASE_URL}/chat/completions`,
        jiutianParams,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwtToken}`
          }
        }
      );
      
      // 提取文本内容
      let content = "";
      if (result.data.choices && result.data.choices.length > 0 && 
          result.data.choices[0].message && result.data.choices[0].message.content) {
        content = result.data.choices[0].message.content;
      }
      
      // 构造 Ollama 格式的响应
      const ollamaResponse = {
        model: "jiutian-lan",
        created_at: new Date().toISOString(),
        message: {
          role: "assistant",
          content: content
        },
        done: true,
        total_duration: 1000000000, // 模拟耗时（纳秒）
        load_duration: 100000000,
        prompt_eval_duration: 200000000,
        eval_count: content.length,
        eval_duration: 700000000
      };
      
      res.json(ollamaResponse);
    }
    
  } catch (error) {
    console.error("Ollama 兼容聊天接口调用失败:", error.message);
    res.status(500).json({ 
      error: "聊天失败", 
      detail: error.message
    });
  }
});

// 健康检查接口
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, '127.0.0.1', () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`九天大模型接口:`);
  console.log(`  问答接口: http://localhost:${PORT}/api/completions`);
  console.log(`  对话接口: http://localhost:${PORT}/api/chat`);
  console.log(`Ollama 兼容接口:`);
  console.log(`  模型列表: http://localhost:${PORT}/api/tags`);
  console.log(`  生成接口: http://localhost:${PORT}/api/generate`);
  console.log(`  聊天接口: http://localhost:${PORT}/api/chat`);
});
