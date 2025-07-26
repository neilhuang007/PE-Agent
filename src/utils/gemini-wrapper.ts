import {
  GoogleGenAI,
} from '@google/genai';
import type { Part, Content } from '@google/genai';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

let ai: GoogleGenAI | null = null;
let useProxy = false;
let proxyConfig: { apiKey: string; proxyUrl: string } | null = null;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function initGeminiClient(apiKey: string, proxyUrl?: string) {
  if (proxyUrl) {
    useProxy = true;
    proxyConfig = { apiKey, proxyUrl };
    console.log('Initialized with proxy:', proxyUrl);
  } else {
    useProxy = false;
    ai = new GoogleGenAI({
      apiKey: apiKey,
    });
  }
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

async function callGeminiDirect(contents: Content[], systemPrompt: string, thinkingBudget: number, model: string) {
  if (!proxyConfig) throw new Error('Proxy config not initialized');
  
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${proxyConfig.apiKey}`;
  
  const body = {
    contents,
    generationConfig: {
      thinkingConfig: {
        thinkingBudget
      }
    },
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined
  };
  
  const fetchOptions: any = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    agent: new HttpsProxyAgent(proxyConfig.proxyUrl)
  };
  
  const response = await fetch(url, fetchOptions);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API Error: ${JSON.stringify(data)}`);
  }
  
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiStream(contents: Content[], systemPrompt: string, thinkingBudget: number = -1, model: string = 'gemini-2.5-pro') {
  if (useProxy && proxyConfig) {
    // Use direct API call when proxy is configured
    return await callGeminiDirect(contents, systemPrompt, thinkingBudget, model);
  }
  
  if (!ai) throw new Error('Gemini client not initialized');

  const config = {
    thinkingConfig: {
      thinkingBudget: thinkingBudget,
    },
    systemInstruction: [
      {
        text: systemPrompt,
      }
    ],
  };

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });
  
  let text = '';
  for await (const chunk of response) {
    console.log(chunk.text);
    text += chunk.text;
  }
  return text;
}

export async function generateWithRetry(contents: Content[], systemPrompt: string, thinkingBudget = -1, model = 'gemini-2.5-pro', retries = 3): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await callGeminiStream(contents, systemPrompt, thinkingBudget, model);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}