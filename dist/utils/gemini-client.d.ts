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
export declare class GeminiClient {
    private ai;
    constructor(apiKey: string, proxyConfig?: ProxyConfig);
    generateContent(contents: GeminiContent[], modelName?: string, config?: GeminiConfig): Promise<string>;
    generateContentStream(contents: GeminiContent[], modelName?: string, config?: GeminiConfig): Promise<string>;
    static createTextContent(text: string): GeminiContent;
    static createFileContent(text: string, fileData?: {
        mimeType: string;
        fileUri: string;
    }): GeminiContent;
    static createMultiPartContent(parts: Array<{
        text?: string;
        fileData?: {
            mimeType: string;
            fileUri: string;
        };
    }>): GeminiContent;
}
export declare function initializeGeminiClient(apiKey: string, proxyConfig?: ProxyConfig): GeminiClient;
export declare function getGeminiClient(): GeminiClient;
export declare function generateWithGemini(prompt: string | Array<{
    text?: string;
    fileData?: {
        mimeType: string;
        fileUri: string;
    };
}>, systemInstruction?: string, thinkingBudget?: number): Promise<string>;
