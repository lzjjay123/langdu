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

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      const snippet = responseText.substring(0, 100);
      throw new Error(`分析服务器异常 (${response.status}): ${snippet || "无内容"}`);
    }

    if (!response.ok) {
      const errorMsg = data.error || data.message || "音频分析失败";
      // 检查是否为 API Key 相关错误
      if (errorMsg.includes("未配置 API Key") || 
          errorMsg.toLowerCase().includes("invalid api key") || 
          errorMsg.toLowerCase().includes("authentication") ||
          response.status === 401) {
        const error: any = new Error(`API 密钥无效或未配置: ${errorMsg}\n\n请检查您的阿里云 DashScope 密钥并重新设置。`);
        error.isApiKeyError = true;
        throw error;
      }
      throw new Error(errorMsg);
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

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      const snippet = responseText.substring(0, 100);
      throw new Error(`课程准备服务器异常 (${response.status}): ${snippet || "无内容"}`);
    }

    if (!response.ok) {
      const errorMsg = data.error || data.message || "准备课程失败";
      // 检查是否为 API Key 相关错误
      if (errorMsg.includes("未配置 API Key") || 
          errorMsg.toLowerCase().includes("invalid api key") || 
          errorMsg.toLowerCase().includes("authentication") ||
          response.status === 401) {
        const error: any = new Error(`API 密钥无效或未配置: ${errorMsg}\n\n请检查您的阿里云 DashScope 密钥并重新设置。`);
        error.isApiKeyError = true;
        throw error;
      }
      throw new Error(errorMsg);
    }
    return data;
  } catch (error: any) {
    console.error("Client Prepare Error:", error);
    throw error;
  }
}
