// src/utils/gemini-wrapper.ts
import { GoogleGenAI } from '@google/genai';
let fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null;
let HttpsProxyAgent = null;
async function getNodeFetch() {
    if (fetchFn)
        return fetchFn;
    const mod = await import('node-fetch');
    fetchFn = mod.default;
    return fetchFn;
}
async function getHttpsProxyAgent() {
    if (HttpsProxyAgent)
        return HttpsProxyAgent;
    const mod = await import('https-proxy-agent');
    HttpsProxyAgent = mod.HttpsProxyAgent;
    return HttpsProxyAgent;
}
let ai = null;
let useProxy = false;
let proxyConfig = null;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
/**
 * Initialize the Gemini client. If a proxy URL is provided, the wrapper will
 * bypass the @google/genai SDK and send requests directly through the proxy.
 *
 * @param apiKey  Your Gemini API key
 * @param proxyUrl  Optional proxy URL (e.g., "http://127.0.0.1:10809")
 */
export function initGeminiClient(apiKey, proxyUrl) {
    if (typeof window !== 'undefined') {
        if (proxyUrl) {
            console.warn('Proxy URL ignored in browser; configure your browser\'s proxy settings instead.');
        }
        useProxy = false;
        ai = new GoogleGenAI({ apiKey });
        return;
    }
    if (proxyUrl) {
        useProxy = true;
        proxyConfig = { apiKey, proxyUrl };
        console.log('Initialized Gemini client with proxy:', proxyUrl);
    }
    else {
        useProxy = false;
        ai = new GoogleGenAI({ apiKey });
    }
}
/**
 * Convert an array of simple part objects (text or fileData) into the
 * Content[] structure expected by the Gemini API.
 */
export function convertContentParts(parts) {
    const userParts = [];
    for (const p of parts) {
        if (p.text) {
            userParts.push({ text: p.text });
        }
        else if (p.fileData) {
            userParts.push({ fileData: p.fileData });
        }
    }
    return [{ role: 'user', parts: userParts }];
}
/**
 * When behind a firewall, send the request directly using node‑fetch through a proxy.
 */
async function callGeminiDirect(contents, systemPrompt, thinkingBudget, model) {
    if (!proxyConfig)
        throw new Error('Proxy config not initialized');
    // Build the full endpoint and include the API key in the query string
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${proxyConfig.apiKey}`;
    const body = {
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
    const fetchImpl = typeof window === 'undefined' ? await getNodeFetch() : fetchFn;
    const fetchOptions = {
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
        const errorMsg = `API Error ${response.status}: ${data.error?.message || JSON.stringify(data)}`;
        throw new Error(errorMsg);
    }
    // Return the first candidate’s text if present
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
/**
 * Fallback to the official SDK for streaming content when not using a proxy.
 */
async function callGeminiStream(contents, systemPrompt, thinkingBudget = -1, model = 'gemini-2.5-pro') {
    // If proxy is configured, we call the direct function instead
    if (useProxy && proxyConfig) {
        return callGeminiDirect(contents, systemPrompt, thinkingBudget, model);
    }
    if (!ai)
        throw new Error('Gemini client not initialized');
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
 * Wrapper to retry the request with exponential backoff and specific handling for HTTP errors.
 */
export async function generateWithRetry(contents, systemPrompt, thinkingBudget = -1, model = 'gemini-2.5-pro', retries = 5) {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await callGeminiStream(contents, systemPrompt, thinkingBudget, model);
        }
        catch (err) {
            lastError = err;
            console.warn(`API call attempt ${attempt + 1}/${retries} failed:`, err.message);
            
            // Check if it's a retryable error (503, 429, network issues)
            const isRetryable = err.message.includes('503') || 
                               err.message.includes('429') || 
                               err.message.includes('Service Unavailable') ||
                               err.message.includes('Rate limit') ||
                               err.message.includes('network') ||
                               err.message.includes('timeout');
            
            // Don't retry on non-retryable errors (400, 401, 403, etc.)
            if (!isRetryable && attempt > 0) {
                console.error('Non-retryable error encountered, stopping retries:', err.message);
                break;
            }
            
            // Don't wait on the last attempt
            if (attempt < retries - 1) {
                // Exponential backoff: 1s, 2s, 4s, 8s
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 8000);
                console.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    console.error(`All ${retries} retry attempts failed. Last error:`, lastError.message);
    throw lastError;
}
/**
 * Upload a browser File/Blob to Gemini.
 * Waits for the file to become ACTIVE before resolving.
 * Requires that initGeminiClient() has been called so `ai` is defined.
 */
export async function uploadFile(file) {
    if (!ai)
        throw new Error('Gemini client not initialized');
    // Upload the file through the SDK
    const uploaded = await ai.files.upload({
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
export async function deleteFile(name) {
    if (!ai)
        throw new Error('Gemini client not initialized');
    await ai.files.delete({ name });
}
