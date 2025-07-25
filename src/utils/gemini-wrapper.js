import { GoogleGenAI } from '@google/genai';
let ai = null;
export function initGeminiClient(apiKey) {
    ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
            baseUrl: 'https://corsproxy.io/https://generativelanguage.googleapis.com/',
            apiVersion: 'v1beta'
        }
    });
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
async function callGeminiStream(request, systemPrompt) {
    if (!ai)
        throw new Error('Gemini client not initialized');
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
export async function generateWithRetry(contents, systemPrompt, thinkingBudget = -1, model = 'gemini-2.5-pro', retries = 3) {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await callGeminiStream({ contents, model, thinkingBudget }, systemPrompt);
        }
        catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}
