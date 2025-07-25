// Gemini API configuration with thinking mode support for 2.5 Pro

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
export function createModelConfig(genAI, taskComplexity = 'DYNAMIC', includeThoughts = false) {
    return genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
        generationConfig: {
            thinkingConfig: {
                thinkingBudget: THINKING_BUDGETS[taskComplexity],
                includeThoughts: includeThoughts
            }
        }
    });
}

// Generate content with thinking mode (simplified for 2.5 Pro)
export async function generateWithThinking(prompt, model, thinkingPrompt = null, taskComplexity = 'DYNAMIC') {
    try {
        // Combine thinking prompt with main prompt if provided
        const fullPrompt = thinkingPrompt ? `${thinkingPrompt}\n\n${prompt}` : prompt;
        
        // Use the model's native thinking capabilities
        const result = await model.generateContent(fullPrompt);
        
        return result.response.text();
    } catch (error) {
        console.error('Error in generateWithThinking:', error);
        throw error;
    }
}

// Generate content with file references and thinking
export async function generateWithFilesAndThinking(model, contentParts, taskComplexity = 'DYNAMIC') {
    try {
        // Pass content parts directly to the model with native thinking
        const result = await model.generateContent(contentParts);
        
        return {
            text: result.response.text(),
            usageMetadata: result.response.usageMetadata
        };
    } catch (error) {
        console.error('Error in generateWithFilesAndThinking:', error);
        throw error;
    }
}