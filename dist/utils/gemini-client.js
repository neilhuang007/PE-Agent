// TypeScript utility for proper Gemini API calls
// This works with the browser-based GoogleGenerativeAI from CDN
export class GeminiClient {
    ai;
    constructor(apiKey, proxyConfig) {
        // Use the browser-based GoogleGenerativeAI
        if (typeof window !== 'undefined' && window.GoogleGenerativeAI) {
            this.ai = new window.GoogleGenerativeAI(apiKey);
        }
        else {
            throw new Error('GoogleGenerativeAI not available. Make sure the CDN script is loaded.');
        }
        // Note: Browser version doesn't support proxy configuration directly
        // Proxy should be configured at browser/system level
        if (proxyConfig) {
            console.log('Proxy config provided but browser version uses system proxy:', proxyConfig);
        }
    }
    async generateContent(contents, modelName = 'gemini-2.5-pro', config = {}) {
        try {
            // Create model with system instruction and thinking config
            const modelConfig = {
                model: modelName,
                generationConfig: {
                    thinkingConfig: {
                        thinkingBudget: config.thinkingBudget ?? -1,
                        includeThoughts: false
                    }
                }
            };
            if (config.systemInstruction) {
                modelConfig.systemInstruction = config.systemInstruction;
            }
            const model = this.ai.getGenerativeModel(modelConfig);
            // Convert our content format to the browser format
            const contentParts = contents[0].parts.map(part => {
                if (part.text) {
                    return { text: part.text };
                }
                else if (part.fileData) {
                    return {
                        fileData: {
                            mimeType: part.fileData.mimeType,
                            fileUri: part.fileData.fileUri
                        }
                    };
                }
                return part;
            });
            const response = await model.generateContent(contentParts);
            return response.response.text() || '';
        }
        catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }
    // Streaming not implemented for browser version - use generateContent instead
    async generateContentStream(contents, modelName = 'gemini-2.5-pro', config = {}) {
        // Fallback to regular generation for browser compatibility
        return this.generateContent(contents, modelName, config);
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