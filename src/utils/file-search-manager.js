// File Search Manager for RAG-based context optimization
// Uses Google's File Search API to manage document embeddings and retrieval

import { initGeminiClient } from './gemini-wrapper.js';

let fileSearchStore = null;
let fileSearchStoreName = null;

/**
 * Create a new file search store for document embeddings
 * @param {Object} ai - GoogleGenAI instance
 * @param {string} displayName - Name for the file search store
 * @returns {Promise<Object>} Created file search store
 */
export async function createFileSearchStore(ai, displayName = 'PE-Agent-Document-Store') {
    try {
        console.log(`📦 Creating file search store: ${displayName}...`);

        // Create the file search store
        const createStoreOp = await ai.fileSearchStores.create({
            config: {
                displayName: displayName,
                // Optional: Configure chunking strategy
                chunkingConfig: {
                    maxTokensPerChunk: 2048,
                    maxOverlapTokens: 256
                }
            }
        });

        // Wait for the operation to complete
        let store = createStoreOp;
        if (createStoreOp.poll) {
            console.log('⏳ Waiting for store creation to complete...');
            store = await createStoreOp.poll();
        }

        fileSearchStore = store;
        fileSearchStoreName = store.name;

        console.log(`✅ File search store created: ${fileSearchStoreName}`);
        return store;

    } catch (error) {
        console.error('❌ Error creating file search store:', error);
        throw error;
    }
}

/**
 * Upload files to the file search store
 * @param {Object} ai - GoogleGenAI instance
 * @param {Array} files - Array of file objects to upload
 * @returns {Promise<Array>} Array of uploaded file references
 */
export async function uploadFilesToStore(ai, files) {
    if (!fileSearchStore) {
        throw new Error('File search store not initialized. Call createFileSearchStore first.');
    }

    try {
        console.log(`📤 Uploading ${files.length} files to file search store...`);

        const uploadedFiles = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`  Uploading file ${i + 1}/${files.length}: ${file.displayName}...`);

            // Upload file to the store
            const uploadOp = await ai.fileSearchStores.uploadToFileSearchStore({
                fileSearchStoreName: fileSearchStoreName,
                file: file.file || file, // Handle both file objects and raw files
                config: {
                    displayName: file.displayName || file.name,
                    // Optional: Add custom metadata
                    customMetadata: {
                        uploadTime: new Date().toISOString(),
                        fileType: file.mimeType || file.type
                    }
                }
            });

            // Wait for upload to complete
            let uploadedFile = uploadOp;
            if (uploadOp.poll) {
                uploadedFile = await uploadOp.poll();
            }

            uploadedFiles.push({
                name: uploadedFile.name,
                displayName: file.displayName || file.name,
                uri: uploadedFile.uri,
                state: uploadedFile.state
            });

            console.log(`  ✅ Uploaded: ${file.displayName || file.name}`);
        }

        console.log(`✅ All ${files.length} files uploaded to file search store`);
        return uploadedFiles;

    } catch (error) {
        console.error('❌ Error uploading files to store:', error);
        throw error;
    }
}

/**
 * Generate content with file search RAG
 * @param {Object} ai - GoogleGenAI instance
 * @param {string} model - Model name to use
 * @param {string} prompt - User prompt
 * @param {string} systemPrompt - System instruction
 * @param {number} thinkingBudget - Thinking budget (-1 for dynamic)
 * @returns {Promise<string>} Generated response
 */
export async function generateWithFileSearch(ai, model, prompt, systemPrompt = '', thinkingBudget = -1) {
    if (!fileSearchStoreName) {
        throw new Error('File search store not initialized. Call createFileSearchStore first.');
    }

    try {
        console.log('🔍 Generating with file search RAG...');

        // Configure the model with file search tool
        const config = {
            thinkingConfig: {
                thinkingBudget: thinkingBudget
            },
            systemInstruction: systemPrompt ? [{ text: systemPrompt }] : undefined,
            tools: [{
                fileSearch: {
                    fileSearchStoreNames: [fileSearchStoreName]
                }
            }]
        };

        // Generate content with file search
        const response = await ai.models.generateContentStream({
            model: model,
            config: config,
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }]
        });

        // Collect the response
        let text = '';
        for await (const chunk of response) {
            text += chunk.text;
        }

        console.log('✅ Generated response with file search');
        return text;

    } catch (error) {
        console.error('❌ Error generating with file search:', error);
        throw error;
    }
}

/**
 * Delete the file search store
 * @param {Object} ai - GoogleGenAI instance
 */
export async function deleteFileSearchStore(ai) {
    if (!fileSearchStoreName) {
        console.warn('No file search store to delete');
        return;
    }

    try {
        console.log(`🗑️  Deleting file search store: ${fileSearchStoreName}...`);
        await ai.fileSearchStores.delete({ name: fileSearchStoreName });

        fileSearchStore = null;
        fileSearchStoreName = null;

        console.log('✅ File search store deleted');

    } catch (error) {
        console.error('❌ Error deleting file search store:', error);
        throw error;
    }
}

/**
 * Get the current file search store name
 * @returns {string|null} Current store name
 */
export function getFileSearchStoreName() {
    return fileSearchStoreName;
}

/**
 * Check if file search store is initialized
 * @returns {boolean} True if initialized
 */
export function isFileSearchInitialized() {
    return fileSearchStoreName !== null;
}
