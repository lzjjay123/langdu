const DASHSCOPE_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

function getApiKey() {
  // 按照优先级尝试获取秘钥
  const apiKey = (process.env.DASHSCOPE_API_KEY) || 
                 ((import.meta as any).env?.VITE_DASHSCOPE_API_KEY) ||
                 (localStorage.getItem('CUSTOM_DASHSCOPE_API_KEY'));

  if (!apiKey || apiKey === "undefined" || apiKey === "YOUR_DASHSCOPE_API_KEY" || apiKey === "") {
    const error: any = new Error("API 密钥未生效。");
    error.isApiKeyError = true;
    throw error;
  }
  return apiKey;
}

export async function analyzePronunciation(referenceText: string, audioBase64: string, mimeType: string) {
  const apiKey = getApiKey();
  const prompt = `你是一位专业的少儿英语老师。
参考文本: "${referenceText}"
任务: 比较提供的音频与参考文本。
1. 识别漏读(skipped)或发音错误(mispronounced)的单词。
2. 给出 1-5 分的评分。
3. 提供鼓励性的中文评语。
4. 评估流利度。

必须返回 JSON 格式:
{
  "rating": 数字,
  "feedback": "中文评语",
  "corrections": [{"word": "单词", "errorType": "skipped" | "mispronounced", "suggestion": "中文建议"}],
  "fluency": "流利度评价"
}`;

  try {
    const response = await fetch(DASHSCOPE_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen-audio-turbo",
        messages: [
          {
            role: "user",
            content: [
              { type: "audio", audio_url: { url: `data:${mimeType};base64,${audioBase64}` } },
              { type: "text", text: prompt }
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("Alibaba Analysis Error:", error);
    throw error;
  }
}

export async function prepareLesson(text: string) {
  const apiKey = getApiKey();
  const prompt = `将以下英文文本切分为适合孩子学习的句子，并提供对应的中文翻译。
文本: "${text}"

返回 JSON 格式:
{
  "sentences": [
    {
      "english": "英文句子",
      "chinese": "中文翻译"
    }
  ]
}`;

  try {
    const response = await fetch(DASHSCOPE_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen-plus",
        messages: [
          {
            role: "system",
            content: "你是一个专业的英语教育助手，只返回严格的 JSON 格式。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("Alibaba Prepare Error:", error);
    throw error;
  }
}
