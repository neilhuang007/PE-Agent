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

// Retry configuration for handling API errors
const MAX_RETRIES = 3;
const INITIAL_DELAY = 2000; // 2 seconds
const BACKOFF_MULTIPLIER = 2;

// Helper function to sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for API calls
async function retryWithBackoff(apiCall, maxRetries = MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            
            // Check if it's a 503 overload error
            if (error.status === 503 || 
                error.code === 503 || 
                (error.message && error.message.includes('overloaded')) ||
                (error.message && error.message.includes('503'))) {
                
                const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt);
                console.log(`⚠️ Model overloaded (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            
            // Check for rate limit errors
            if (error.status === 429 || 
                error.code === 429 || 
                (error.message && error.message.includes('rate limit'))) {
                
                const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt) * 2; // Longer delay for rate limits
                console.log(`⚠️ Rate limit hit (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            
            // For other errors, throw immediately
            throw error;
        }
    }
    
    // If all retries failed, throw the last error
    console.error(`❌ All ${maxRetries} retry attempts failed`);
    throw lastError;
}

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
        // Check if prompt is an array (contentParts) or a string
        if (Array.isArray(prompt)) {
            // Handle contentParts array
            const result = await retryWithBackoff(async () => {
                return await model.generateContent(prompt);
            });
            return result.response.text();
        } else {
            // Handle string prompt
            const fullPrompt = thinkingPrompt ? `${thinkingPrompt}\n\n${prompt}` : prompt;
            
            // Use the model's native thinking capabilities with retry
            const result = await retryWithBackoff(async () => {
                return await model.generateContent(fullPrompt);
            });
            
            return result.response.text();
        }
    } catch (error) {
        console.error('Error in generateWithThinking:', error);
        throw error;
    }
}

// Generate content with file references and thinking
export async function generateWithFilesAndThinking(model, contentParts, taskComplexity = 'DYNAMIC') {
    try {
        // Pass content parts directly to the model with native thinking and retry
        const result = await retryWithBackoff(async () => {
            return await model.generateContent(contentParts);
        });
        
        return {
            text: result.response.text(),
            usageMetadata: result.response.usageMetadata
        };
    } catch (error) {
        console.error('Error in generateWithFilesAndThinking:', error);
        throw error;
    }
}