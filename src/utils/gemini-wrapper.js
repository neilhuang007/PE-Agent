import { GoogleGenAI, } from '@google/genai';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
let ai = null;
let useProxy = false;
let proxyConfig = null;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export function initGeminiClient(apiKey, proxyUrl) {
    if (proxyUrl) {
        useProxy = true;
        proxyConfig = { apiKey, proxyUrl };
        console.log('Initialized with proxy:', proxyUrl);
    }
    else {
        useProxy = false;
        ai = new GoogleGenAI({
            apiKey: apiKey,
        });
    }
}
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
async function callGeminiDirect(contents, systemPrompt, thinkingBudget, model) {
    if (!proxyConfig)
        throw new Error('Proxy config not initialized');
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
    const fetchOptions = {
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
async function callGeminiStream(contents, systemPrompt, thinkingBudget = -1, model = 'gemini-2.5-pro') {
    if (useProxy && proxyConfig) {
        // Use direct API call when proxy is configured
        return await callGeminiDirect(contents, systemPrompt, thinkingBudget, model);
    }
    if (!ai)
        throw new Error('Gemini client not initialized');
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
