// Direct API implementation with proxy support
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export async function callGeminiDirect(config, model = 'gemini-2.5-pro', contents, systemInstruction, thinkingBudget = -1) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${config.apiKey}`;
    const body = {
        contents,
        generationConfig: {
            thinkingConfig: {
                thinkingBudget
            }
        },
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
    };
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    };
    if (config.proxyUrl) {
        fetchOptions.agent = new HttpsProxyAgent(config.proxyUrl);
    }
    console.log('Making direct API call with proxy:', config.proxyUrl);
    try {
        const response = await fetch(url, fetchOptions);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`API Error: ${JSON.stringify(data)}`);
        }
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    catch (error) {
        console.error('Direct API call failed:', error);
        throw error;
    }
}
// Test function
export async function testDirectAPI() {
    const config = {
        apiKey: 'AIzaSyA0CfzJO7IjmIq168wvOIfpwx9vSO7FS5g',
        proxyUrl: 'http://127.0.0.1:10809'
    };
    const contents = [{
            role: 'user',
            parts: [{ text: 'Say "Hello from direct API" and nothing else.' }]
        }];
    try {
        const result = await callGeminiDirect(config, 'gemini-2.5-pro', contents, 'You are a helpful assistant.', -1);
        console.log('Success:', result);
    }
    catch (error) {
        console.error('Failed:', error);
    }
}
