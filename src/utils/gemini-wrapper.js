// src/utils/gemini-wrapper.ts
import { GoogleGenAI } from '@google/genai';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
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
    // Use HttpsProxyAgent so requests go through 127.0.0.1:10809
    const fetchOptions = {
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
async function callGeminiStream(contents, systemPrompt, thinkingBudget = -1, model = 'gemini-2.5-pro') {
    // If proxy is configured, we call the direct function instead
    if (useProxy && proxyConfig) {
        return callGeminiDirect(contents, systemPrompt, thinkingBudget, model);
    }
    if (!ai)
        throw new Error('Gemini client not initialized');
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
export async function generateWithRetry(contents, systemPrompt, thinkingBudget = -1, model = 'gemini-2.5-pro', retries = 3) {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await callGeminiStream(contents, systemPrompt, thinkingBudget, model);
        }
        catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}
