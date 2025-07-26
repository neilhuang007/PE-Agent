// src/utils/gemini-wrapper.ts


import { GoogleGenAI } from '@google/genai';
import type { Part, Content } from '@google/genai';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

let ai: GoogleGenAI | null = null;
let useProxy = false;
let proxyConfig: { apiKey: string; proxyUrl: string } | null = null;

const GEMINI_API_BASE =
    'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Initialize the Gemini client. If a proxy URL is provided, the wrapper will
 * bypass the @google/genai SDK and send requests directly through the proxy.
 *
 * @param apiKey  Your Gemini API key
 * @param proxyUrl  Optional proxy URL (e.g., "http://127.0.0.1:10809")
 */
export function initGeminiClient(apiKey: string, proxyUrl?: string) {
  if (proxyUrl) {
    useProxy = true;
    proxyConfig = { apiKey, proxyUrl };
    console.log('Initialized Gemini client with proxy:', proxyUrl);
  } else {
    useProxy = false;
    ai = new GoogleGenAI({ apiKey });
  }
}

/**
 * Convert an array of simple part objects (text or fileData) into the
 * Content[] structure expected by the Gemini API.
 */
export function convertContentParts(
    parts: Array<{ text?: string; fileData?: { mimeType: string; fileUri: string } }>
): Content[] {
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

/**
 * When behind a firewall, send the request directly using node‑fetch through a proxy.
 */
async function callGeminiDirect(
    contents: Content[],
    systemPrompt: string,
    thinkingBudget: number,
    model: string
): Promise<string> {
  if (!proxyConfig) throw new Error('Proxy config not initialized');
  // Build the full endpoint and include the API key in the query string
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${proxyConfig.apiKey}`;
  const body: any = {
    contents,
    generationConfig: {
      thinkingConfig: { thinkingBudget }
    }
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  // Use HttpsProxyAgent so requests go through 127.0.0.1:10809
  const fetchOptions: any = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    agent: new HttpsProxyAgent(proxyConfig.proxyUrl)
  };

  const response = await fetch(url, fetchOptions);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`API Error: ${JSON.stringify(data)}`);
  }
  // Return the first candidate’s text if present
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Fallback to the official SDK for streaming content when not using a proxy.
 */
async function callGeminiStream(
    contents: Content[],
    systemPrompt: string,
    thinkingBudget: number = -1,
    model: string = 'gemini-2.5-pro'
): Promise<string> {
  // If proxy is configured, we call the direct function instead
  if (useProxy && proxyConfig) {
    return callGeminiDirect(contents, systemPrompt, thinkingBudget, model);
  }
  if (!ai) throw new Error('Gemini client not initialized');
  const config = {
    thinkingConfig: { thinkingBudget },
    systemInstruction: [{ text: systemPrompt }]
  };
  const response = await ai.models.generateContentStream({ model, config, contents });
  let text = '';
  for await (const chunk of response) {
    text += chunk.text;
  }
  return text;
}

/**
 * Wrapper to retry the request a few times before throwing an error.
 */
export async function generateWithRetry(
    contents: Content[],
    systemPrompt: string,
    thinkingBudget = -1,
    model = 'gemini-2.5-pro',
    retries = 3
): Promise<string> {
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
