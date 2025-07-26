// Simple browser-compatible Gemini wrapper that doesn't rely on compiled TypeScript
// This uses the GoogleGenerativeAI from CDN directly

let geminiClient = null;

export function initGeminiClient(apiKey) {
    console.log('🔄 Initializing simple Gemini client...');
    try {
        if (typeof GoogleGenerativeAI === 'undefined') {
            throw new Error('GoogleGenerativeAI not available. Make sure the CDN script is loaded.');
        }
        
        geminiClient = new GoogleGenerativeAI(apiKey);
        console.log('✅ Simple Gemini client initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize simple Gemini client:', error);
        throw error;
    }
}

export async function generateWithSystemInstruction(prompt, systemInstruction, thinkingBudget = -1) {
    if (!geminiClient) {
        throw new Error('Gemini client not initialized. Call initGeminiClient() first.');
    }

    try {
        // Create model with system instruction
        const modelConfig = {
            model: "gemini-2.5-pro",
            generationConfig: {
                thinkingConfig: {
                    thinkingBudget: thinkingBudget,
                    includeThoughts: false
                }
            }
        };

        if (systemInstruction) {
            modelConfig.systemInstruction = systemInstruction;
        }

        const model = geminiClient.getGenerativeModel(modelConfig);
        const response = await model.generateContent(prompt);
        return response.response.text() || '';
    } catch (error) {
        console.error('Error in generateWithSystemInstruction:', error);
        throw error;
    }
}

export async function generateWithMultiPart(contentParts, systemInstruction, thinkingBudget = -1) {
    if (!geminiClient) {
        throw new Error('Gemini client not initialized. Call initGeminiClient() first.');
    }

    try {
        // Create model with system instruction
        const modelConfig = {
            model: "gemini-2.5-pro", 
            generationConfig: {
                thinkingConfig: {
                    thinkingBudget: thinkingBudget,
                    includeThoughts: false
                }
            }
        };

        if (systemInstruction) {
            modelConfig.systemInstruction = systemInstruction;
        }

        const model = geminiClient.getGenerativeModel(modelConfig);
        
        // Convert contentParts to the format expected by the browser version
        const formattedParts = contentParts.map(part => {
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

        const response = await model.generateContent(formattedParts);
        return response.response.text() || '';
    } catch (error) {
        console.error('Error in generateWithMultiPart:', error);
        throw error;
    }
}

// Helper to convert old contentParts format to new format
export function convertContentParts(oldContentParts) {
    return oldContentParts.map(part => {
        if (part.text) {
            return { text: part.text };
        } else if (part.fileData) {
            return { fileData: part.fileData };
        }
        return part;
    });
}

// Retry wrapper (keeping the same retry logic as before)
export async function generateWithRetry(
    contentParts, 
    systemInstruction, 
    thinkingBudget = -1, 
    maxRetries = 3
) {
    let lastError;
    const initialDelay = 2000;
    const backoffMultiplier = 2;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await generateWithMultiPart(contentParts, systemInstruction, thinkingBudget);
        } catch (error) {
            lastError = error;
            
            // Check if it's a 503 overload error
            if (error.status === 503 || 
                error.code === 503 || 
                (error.message && error.message.includes('overloaded')) ||
                (error.message && error.message.includes('503'))) {
                
                const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
                console.log(`⚠️ Model overloaded (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // Check for rate limit errors
            if (error.status === 429 || 
                error.code === 429 || 
                (error.message && error.message.includes('rate limit'))) {
                
                const delay = initialDelay * Math.pow(backoffMultiplier, attempt) * 2;
                console.log(`⚠️ Rate limit exceeded (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // For other errors, throw immediately
            throw error;
        }
    }
    
    console.error(`❌ All ${maxRetries} retry attempts failed`);
    throw lastError;
}