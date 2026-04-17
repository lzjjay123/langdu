import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON body parsing
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.get('content-length') || 0} bytes`);
    next();
  });

  function getApiKey(req: express.Request) {
      // 优先级：请求头传入的自定义Key > 环境变量
      const customKey = req.headers["x-custom-api-key"] as string;
      if (customKey && customKey.trim().length > 5) return customKey.trim();
      return process.env.DASHSCOPE_API_KEY || "";
  }

  // API Route: Analyze Pronunciation
  app.post("/api/analyze", async (req, res) => {
    try {
      const { referenceText, audioBase64, mimeType } = req.body;
      const apiKey = getApiKey(req);

      if (!apiKey) {
        return res.status(500).json({ error: "服务器未配置 API Key" });
      }

      const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "qwen-audio-turbo",
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { audio: `data:${mimeType};base64,${audioBase64}` },
                  { text: `你是一位专业的少儿英语老师。参考文本: "${referenceText}"。任务: 比较音频与文本。必须返回严格 JSON 格式: {"rating":数字, "feedback":"评语", "corrections":[{"word":"单词", "errorType":"skipped"|"mispronounced", "suggestion":"建议"}], "fluency":"评价"}` }
                ]
              }
            ]
          },
          parameters: { result_format: "message" }
        })
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`阿里云服务器返回了异常格式: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.message || data.error?.message || "阿里云接口错误");

      const choices = data.output?.choices;
      if (!choices || choices.length === 0) throw new Error("AI 没能给出有效的评价，请重新录制试一下");

      let content = choices[0].message.content[0].text;
      
      // Clean up markdown
      if (content.includes('```json')) content = content.split('```json')[1].split('```')[0].trim();
      else if (content.includes('```')) content = content.split('```')[1].split('```')[0].trim();

      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("Server Analysis Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Prepare Lesson
  app.post("/api/prepare", async (req, res) => {
    try {
      const { text } = req.body;
      const apiKey = getApiKey(req);

      if (!apiKey) {
        return res.status(500).json({ error: "服务器未配置 API Key" });
      }

      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "qwen-plus",
          messages: [
            { role: "system", content: "你是一个专业的英语教育助手，只返回严格的 JSON 格式。" },
            { role: "user", content: `将以下英文文本切分为适合孩子学习的句子并提供中文翻译。文本: "${text}"。返回 JSON: {"sentences": [{"english": "英文", "chinese": "翻译"}]}` }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "阿里云接口错误");

      const content = data.choices[0].message.content;
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("Server Prepare Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
