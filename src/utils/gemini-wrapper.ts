// src/utils/gemini-wrapper.ts


import { GoogleGenAI } from '@google/genai';
import type { Part, Content } from '@google/genai';

let fetchFn: typeof fetch | null = typeof fetch === 'function' ? fetch.bind(globalThis) : null;
let HttpsProxyAgent: any = null;

async function getNodeFetch() {
  if (fetchFn) return fetchFn;
  const mod = await import('node-fetch');
  fetchFn = mod.default as unknown as typeof fetch;
  return fetchFn;
}

async function getHttpsProxyAgent() {
  if (HttpsProxyAgent) return HttpsProxyAgent;
  const mod = await import('https-proxy-agent');
  HttpsProxyAgent = (mod as any).HttpsProxyAgent;
  return HttpsProxyAgent;
}

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
  if (typeof window !== 'undefined') {
    if (proxyUrl) {
      console.warn(
        'Proxy URL ignored in browser; configure your browser\'s proxy settings instead.'
      );
    }
    useProxy = false;
    ai = new GoogleGenAI({ apiKey });
    return;
  }
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

  // Log the complete prompt
  console.log('=== Gemini API Request ===');
  console.log('Model:', model);
  console.log('System Prompt:', systemPrompt);
  console.log('Contents:', JSON.stringify(contents, null, 2));
  console.log('Thinking Budget:', thinkingBudget);
  console.log('========================');

  const fetchImpl = typeof window === 'undefined' ? await getNodeFetch() : fetchFn!;
  const fetchOptions: any = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  if (typeof window === 'undefined') {
    const Agent = await getHttpsProxyAgent();
    fetchOptions.agent = new Agent(proxyConfig.proxyUrl);
  }

  const response = await fetchImpl(url, fetchOptions);
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
  
  // Log the complete prompt
  console.log('=== Gemini API Request (Stream) ===');
  console.log('Model:', model);
  console.log('System Prompt:', systemPrompt);
  console.log('Contents:', JSON.stringify(contents, null, 2));
  console.log('Thinking Budget:', thinkingBudget);
  console.log('==================================');
  
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

// Define a return type for uploaded files
export interface GeminiFile {
  name: string;
  displayName: string;
  mimeType: string;
  uri: string;
  state: string;
}

/**
 * Upload a browser File/Blob to Gemini.
 * Waits for the file to become ACTIVE before resolving.
 * Requires that initGeminiClient() has been called so `ai` is defined.
 */
export async function uploadFile(file: File): Promise<GeminiFile> {
  if (!ai) throw new Error('Gemini client not initialized');
  // Upload the file through the SDK
  const uploaded: any = await ai.files.upload({
    file,
    config: { mimeType: file.type },
  });

  // Poll until ACTIVE
  let fetched = uploaded;
  if (fetched.state !== 'ACTIVE') {
    for (let i = 0; i < 20 && fetched.state !== 'ACTIVE'; i++) {
      await new Promise((res) => setTimeout(res, 1000));
      fetched = await ai.files.get({ name: uploaded.name });
    }
  }

  return {
    name: fetched.name,
    displayName: file.name,
    mimeType: file.type,
    uri: fetched.uri,
    state: fetched.state,
  };
}

/**
 * Delete an uploaded file from Gemini by its resource name.
 */
export async function deleteFile(name: string): Promise<void> {
  if (!ai) throw new Error('Gemini client not initialized');
  await ai.files.delete({ name });
}

