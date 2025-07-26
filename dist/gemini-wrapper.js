import { GoogleGenAI, } from '@google/genai';
let ai = null;
export function initGeminiClient(apiKey) {
    ai = new GoogleGenAI({
        apiKey: apiKey,
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
async function callGeminiStream(contents, systemPrompt, thinkingBudget = -1, model = 'gemini-2.5-pro') {
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
