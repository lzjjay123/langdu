import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "undefined") {
      throw new Error("GEMINI_API_KEY is not configured. Please add it to your secrets.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function analyzePronunciation(referenceText: string, audioBase64: string, mimeType: string) {
  const prompt = `Ref: "${referenceText}". Task: Compare audio vs Ref. Identify missing/wrong words. JSON: {rating:1-5, feedback:CN, corrections:[{word, errorType, suggestion:CN}], fluency:CN}. Focus on accuracy.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64
              }
            }
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
            },
            fluency: { type: Type.STRING }
          },
          required: ["rating", "feedback", "corrections", "fluency"]
        }
      }
    });

    const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr || "{}");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}

export async function prepareLesson(text: string) {
  const prompt = `Split into sentences + CN translation. Text: "${text}". JSON: {sentences: [{english, chinese}]}`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
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
            }
          },
          required: ["sentences"]
        }
      }
    });

    const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr || "{}");
  } catch (error) {
    console.error("Prepare Lesson Error:", error);
    throw error;
  }
}
