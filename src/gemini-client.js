// TypeScript utility for proper Gemini API calls
// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node typescript
import { GoogleGenAI } from '@google/genai';
export class GeminiClient {
    ai;
    constructor(apiKey, proxyConfig) {
        const config = {
            apiKey: apiKey,
        };
        // Add proxy configuration if provided
        if (proxyConfig) {
            config.baseURL = `${proxyConfig.protocol || 'http'}://${proxyConfig.host}:${proxyConfig.port}`;
        }
        this.ai = new GoogleGenAI(config);
    }
    async generateContent(contents, modelName = 'gemini-2.5-pro', config = {}) {
        const requestConfig = {
            thinkingConfig: {
                thinkingBudget: config.thinkingBudget ?? -1, // Dynamic thinking by default
            },
            ...(config.systemInstruction && {
                systemInstruction: [
                    {
                        text: config.systemInstruction,
                    }
                ]
            })
        };
        try {
            const response = await this.ai.models.generateContent({
                model: modelName,
                config: requestConfig,
                contents,
            });
            return response.text || '';
        }
        catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }
    async generateContentStream(contents, modelName = 'gemini-2.5-pro', config = {}) {
        const requestConfig = {
            thinkingConfig: {
                thinkingBudget: config.thinkingBudget ?? -1,
            },
            ...(config.systemInstruction && {
                systemInstruction: [
                    {
                        text: config.systemInstruction,
                    }
                ]
            })
        };
        try {
            const response = await this.ai.models.generateContentStream({
                model: modelName,
                config: requestConfig,
                contents,
            });
            let result = '';
            for await (const chunk of response) {
                result += chunk.text || '';
            }
            return result;
        }
        catch (error) {
            console.error('Gemini API Stream Error:', error);
            throw error;
        }
    }
    // Helper method to create content from text
    static createTextContent(text) {
        return {
            role: 'user',
            parts: [{ text }]
        };
    }
    // Helper method to create content with file data
    static createFileContent(text, fileData) {
        const parts = [{ text }];
        if (fileData) {
            parts.push({ fileData });
        }
        return {
            role: 'user',
            parts
        };
    }
    // Helper method to create content from multiple parts
    static createMultiPartContent(parts) {
        return {
            role: 'user',
            parts
        };
    }
}
// Export a singleton instance that can be configured
let geminiClient = null;
export function initializeGeminiClient(apiKey, proxyConfig) {
    geminiClient = new GeminiClient(apiKey, proxyConfig);
    return geminiClient;
}
export function getGeminiClient() {
    if (!geminiClient) {
        throw new Error('Gemini client not initialized. Call initializeGeminiClient() first.');
    }
    return geminiClient;
}
// Simple wrapper functions for JavaScript compatibility
export async function generateWithGemini(prompt, systemInstruction, thinkingBudget = -1) {
    const client = getGeminiClient();
    let contents;
    if (typeof prompt === 'string') {
        contents = [GeminiClient.createTextContent(prompt)];
    }
    else {
        contents = [GeminiClient.createMultiPartContent(prompt)];
    }
    return await client.generateContent(contents, 'gemini-2.5-pro', {
        systemInstruction,
        thinkingBudget
    });
}
//# sourceMappingURL=gemini-client.js.map