// TypeScript utility for proper Gemini API calls
// This works with the browser-based GoogleGenerativeAI from CDN

// Type definitions for the browser-based Google Generative AI
declare global {
    interface Window {
        GoogleGenerativeAI: any;
    }
}

export interface GeminiConfig {
    thinkingBudget?: number;
    systemInstruction?: string;
}

export interface GeminiContent {
    role: 'user';
    parts: Array<{
        text?: string;
        fileData?: {
            mimeType: string;
            fileUri: string;
        };
    }>;
}

export interface ProxyConfig {
    host: string;
    port: number;
    protocol?: 'http' | 'https';
}

export class GeminiClient {
    private ai: any;

    constructor(apiKey: string, proxyConfig?: ProxyConfig) {
        // Use the browser-based GoogleGenerativeAI
        if (typeof window !== 'undefined' && window.GoogleGenerativeAI) {
            this.ai = new window.GoogleGenerativeAI(apiKey);
        } else {
            throw new Error('GoogleGenerativeAI not available. Make sure the CDN script is loaded.');
        }
        
        // Note: Browser version doesn't support proxy configuration directly
        // Proxy should be configured at browser/system level
        if (proxyConfig) {
            console.log('Proxy config provided but browser version uses system proxy:', proxyConfig);
        }
    }

    async generateContent(
        contents: GeminiContent[],
        modelName: string = 'gemini-2.5-pro',
        config: GeminiConfig = {}
    ): Promise<string> {
        try {
            // Create model with system instruction and thinking config
            const modelConfig: any = {
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
                } else if (part.fileData) {
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
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }

    // Streaming not implemented for browser version - use generateContent instead
    async generateContentStream(
        contents: GeminiContent[],
        modelName: string = 'gemini-2.5-pro',
        config: GeminiConfig = {}
    ): Promise<string> {
        // Fallback to regular generation for browser compatibility
        return this.generateContent(contents, modelName, config);
    }

    // Helper method to create content from text
    static createTextContent(text: string): GeminiContent {
        return {
            role: 'user',
            parts: [{ text }]
        };
    }

    // Helper method to create content with file data
    static createFileContent(text: string, fileData?: { mimeType: string; fileUri: string }): GeminiContent {
        const parts: GeminiContent['parts'] = [{ text }];
        if (fileData) {
            parts.push({ fileData });
        }
        return {
            role: 'user',
            parts
        };
    }

    // Helper method to create content from multiple parts
    static createMultiPartContent(parts: Array<{ text?: string; fileData?: { mimeType: string; fileUri: string } }>): GeminiContent {
        return {
            role: 'user',
            parts
        };
    }
}

// Export a singleton instance that can be configured
let geminiClient: GeminiClient | null = null;

export function initializeGeminiClient(apiKey: string, proxyConfig?: ProxyConfig): GeminiClient {
    geminiClient = new GeminiClient(apiKey, proxyConfig);
    return geminiClient;
}

export function getGeminiClient(): GeminiClient {
    if (!geminiClient) {
        throw new Error('Gemini client not initialized. Call initializeGeminiClient() first.');
    }
    return geminiClient;
}

// Simple wrapper functions for JavaScript compatibility
export async function generateWithGemini(
    prompt: string | Array<{ text?: string; fileData?: { mimeType: string; fileUri: string } }>,
    systemInstruction?: string,
    thinkingBudget: number = -1
): Promise<string> {
    const client = getGeminiClient();
    
    let contents: GeminiContent[];
    if (typeof prompt === 'string') {
        contents = [GeminiClient.createTextContent(prompt)];
    } else {
        contents = [GeminiClient.createMultiPartContent(prompt)];
    }

    return await client.generateContent(contents, 'gemini-2.5-pro', {
        systemInstruction,
        thinkingBudget
    });
}