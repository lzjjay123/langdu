const DASHSCOPE_COMPATIBLE_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DASHSCOPE_MULTIMODAL_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

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
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Custom-Api-Key": localStorage.getItem('CUSTOM_DASHSCOPE_API_KEY') || ""
      },
      body: JSON.stringify({ referenceText, audioBase64, mimeType })
    });

    const data = await response.json();
    if (!response.ok) {
      if (data.error?.includes("未配置 API Key")) {
        const error: any = new Error("API 密钥未生效。");
        error.isApiKeyError = true;
        throw error;
      }
      throw new Error(data.error || "音频分析失败");
    }
    return data;
  } catch (error: any) {
    console.error("Client Analysis Error:", error);
    throw error;
  }
}

export async function prepareLesson(text: string) {
  try {
    const response = await fetch("/api/prepare", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Custom-Api-Key": localStorage.getItem('CUSTOM_DASHSCOPE_API_KEY') || ""
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();
    if (!response.ok) {
      if (data.error?.includes("未配置 API Key")) {
        const error: any = new Error("API 密钥未生效。");
        error.isApiKeyError = true;
        throw error;
      }
      throw new Error(data.error || "准备课程失败");
    }
    return data;
  } catch (error: any) {
    console.error("Client Prepare Error:", error);
    throw error;
  }
}
