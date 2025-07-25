// Gemini API configuration with thinking mode support for 2.5 Pro
import { generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

// Thinking budget configurations for different task complexities
export const THINKING_BUDGETS = {
    OFF: 0,
    LOW: 512,          // Simple extraction tasks
    MEDIUM: 2048,      // Analysis and organization
    HIGH: 8192,        // Complex reasoning and verification
    VERY_HIGH: 16384,  // Deep analysis and enrichment
    DYNAMIC: -1        // Let model decide (recommended for 2.5 Pro)
};


// Create model configuration with thinking for 2.5 Pro
export function createModelConfig(genAI, taskComplexity = 'DYNAMIC', includeThoughts = false, systemInstruction = null) {
    const config = {
        model: "gemini-2.5-pro",
        generationConfig: {
            thinkingConfig: {
                thinkingBudget: THINKING_BUDGETS[taskComplexity],
                includeThoughts: includeThoughts
            }
        }
    };
    
    if (systemInstruction) {
        config.systemInstruction = systemInstruction;
    }
    
    return genAI.getGenerativeModel(config);
}

// Generate content with thinking mode using proper API structure
export async function generateWithThinking(prompt, genAI, model = 'gemini-2.5-pro', systemInstruction = '', taskComplexity = 'DYNAMIC') {
    try {
        const budget = THINKING_BUDGETS[taskComplexity];
        const contents = Array.isArray(prompt)
            ? convertContentParts(prompt)
            : convertContentParts([{ text: prompt }]);
        return await generateWithRetry(contents, systemInstruction, budget, model);
    } catch (error) {
        console.error('Error in generateWithThinking:', error);
        throw error;
    }
}

// Generate content with file references and thinking
export async function generateWithFilesAndThinking(model, contentParts, taskComplexity = 'DYNAMIC') {
    try {
        const budget = THINKING_BUDGETS[taskComplexity];
        const converted = convertContentParts(contentParts);
        const text = await generateWithRetry(converted, '', budget, model);
        return { text, usageMetadata: null };
    } catch (error) {
        console.error('Error in generateWithFilesAndThinking:', error);
        throw error;
    }
}