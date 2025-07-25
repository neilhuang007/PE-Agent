import { GoogleGenAI } from '@google/genai';
import type { Part, Content, GenerateContentParameters } from '@google/genai';

let ai: GoogleGenAI | null = null;

export function initGeminiClient(apiKey: string) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      baseUrl: 'https://corsproxy.io/https://generativelanguage.googleapis.com/',
      apiVersion: 'v1beta'
    }
  });
}

export function convertContentParts(parts: Array<{text?: string; fileData?: {mimeType: string; fileUri: string;}}>): Content[] {
  const userParts: Part[] = [];
  for (const p of parts) {
    if (p.text) {
      userParts.push({ text: p.text });
    } else if (p.fileData) {
      userParts.push({ fileData: p.fileData });
    }
  }
  return [{ role: 'user', parts: userParts }];
}

async function callGeminiStream(request: GenerateContentParameters & { thinkingBudget?: number }, systemPrompt: string) {
  if (!ai) throw new Error('Gemini client not initialized');

  const config = {
    thinkingConfig: {
      thinkingBudget: request.thinkingBudget ?? -1,
    },
    systemInstruction: [{ text: systemPrompt }],
  };

  const response = await ai.models.generateContentStream({
    model: request.model ?? 'gemini-2.5-pro',
    config,
    contents: request.contents,
  });
  let text = '';
  for await (const chunk of response) {
    text += chunk.text;
  }
  return text;
}

export async function generateWithRetry(contents: Content[], systemPrompt: string, thinkingBudget = -1, model = 'gemini-2.5-pro', retries = 3): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await callGeminiStream({ contents, model, thinkingBudget }, systemPrompt);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
