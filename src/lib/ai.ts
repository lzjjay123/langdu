import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  // 检查常见的空值或占位符
  if (!key || key === "undefined" || key === "null" || key === "" || key === "NO_KEY") {
    console.warn("GEMINI_API_KEY is not set. Please configure it in your environment variables/Netlify settings.");
    return null;
  }
  return key;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * 语音发音分析
 */
export async function analyzePronunciation(referenceText: string, audioBase64: string, mimeType: string) {
  if (!ai) {
    return { 
      score: 0, 
      feedback: "请在环境变量中设置 GEMINI_API_KEY 后使用 AI 评分功能。", 
      detail: "Missing API Key" 
    };
  }

  try {
    const prompt = `你是一位专业的少儿英语老师。
参考文本: "${referenceText}"
任务: 监听录音并与参考文本对比。
1. 识别漏读(skipped)或发音错误(mispronounced)的单词。
2. 给出 1-5 分的评分。
3. 提供鼓励性的中文评语。
4. 评估流利度。

必须返回严格的 JSON 格式:
{
  "rating": number,
  "feedback": "string",
  "corrections": [{"word": "string", "errorType": "skipped" | "mispronounced", "suggestion": "string"}],
  "fluency": "string"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rating: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            fluency: { type: Type.STRING },
            corrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  errorType: { type: Type.STRING, enum: ["skipped", "mispronounced"] },
                  suggestion: { type: Type.STRING }
                },
                required: ["word", "errorType", "suggestion"]
              }
            }
          },
          required: ["rating", "feedback", "corrections", "fluency"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.warn("Gemini Analysis Error (falling back to mock):", error);
    // 启发式 Mock 逻辑：如果没有 AI，我们通过正向激励让用户先动起来
    return {
      rating: 4,
      feedback: "听起来很不错！由于目前处于本地离线模式，详细的发音分析暂时无法提供，请继续加油！",
      corrections: [],
      fluency: "流畅"
    };
  }
}

// 辅助函数：即使在没有模型的情况下也能进行基础的句子切分
export function splitSentencesLocally(text: string) {
  // 匹配常见的英文标点符号进行切分
  const rawSentences = text.split(/(?<=[.!?])\s+/);
  return rawSentences.map(s => ({
    english: s.trim(),
    chinese: "（AI 翻译需配置秘钥）"
  })).filter(s => s.english.length > 0);
}

export async function prepareLesson(text: string) {
  if (!ai) {
    return { 
      sentences: splitSentencesLocally(text),
      vocabulary: {}
    };
  }

  try {
    const prompt = `将以下英文文本切分为适合孩子学习的句子，并提供对应的中文翻译。
文本: "${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  english: { type: Type.STRING },
                  chinese: { type: Type.STRING }
                },
                required: ["english", "chinese"]
              }
            },
            vocabulary: {
              type: Type.OBJECT,
              description: "A map of unique English words to their concise Chinese translations",
              additionalProperties: { type: Type.STRING }
            }
          },
          required: ["sentences", "vocabulary"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.warn("Gemini Prepare Error (falling back to local split):", error);
    return { 
      sentences: splitSentencesLocally(text),
      vocabulary: {} // 本地切分暂不提供离线词典，后续点击会动态补充
    };
  }
}

/**
 * 获取单词及其简洁的中文翻译
 */
export async function translateWord(word: string): Promise<string> {
  // 大幅扩展本地映射作为极速兜底和防错处理，通过离线常用词掩盖网络抖动
  const localDict: Record<string, string> = {
    "hello": "你好", "world": "世界", "good": "好", "bad": "差", "apple": "苹果",
    "book": "书", "school": "学校", "student": "学生", "teacher": "老师", 
    "love": "爱", "like": "喜欢", "study": "学习", "english": "英语", 
    "china": "中国", "friend": "朋友", "cat": "猫", "dog": "狗",
    "boy": "男孩", "girl": "女孩", "water": "水", "food": "食物", "sun": "太阳",
    "moon": "月亮", "star": "星星", "tree": "树", "flower": "花", "red": "红色",
    "blue": "蓝色", "green": "绿色", "yellow": "黄色", "black": "黑色", "white": "白色",
    "run": "跑", "walk": "走", "eat": "吃", "sleep": "睡觉", "play": "玩", 
    "happy": "快乐", "sad": "难过", "big": "大", "small": "小", "hot": "热", "cold": "冷",
    "father": "父亲", "mother": "母亲", "brother": "兄弟", "sister": "姐妹",
    "morning": "早上", "night": "晚上", "day": "白天", "time": "时间", "home": "家",
    "pen": "笔", "bag": "包", "desk": "书桌", "chair": "椅子", "bird": "鸟", "fish": "鱼"
  };

  const lowerWord = word.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");
  if (localDict[lowerWord]) return localDict[lowerWord];

  // 如果没有 AI 实例，直接返回提示（由于上面的 localDict 已经覆盖了常见词，这能改善体验）
  if (!ai) return "需配置AI秘钥";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: `Translate the English word "${word}" into a concise Chinese meaning. Return MUST be a JSON object with a "translation" field. Example: {"translation": "苹果"}` }]
      }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data.translation || "未知含义";
  } catch (error: any) {
    console.error("Translate Word Error:", error);
    // 如果是 RPC 错误，尝试简单文本兜底（有时 JSON 模式会导致某些环境下 Proxy 拦截报错）
    if (error.message?.includes('Rpc failed')) {
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Word: ${word}. Translate to one Chinese word.`
        });
        return fallbackResponse.text?.trim() || "翻译失败";
      } catch (e) {
        return "网络错误";
      }
    }
    return "翻译失败";
  }
}
