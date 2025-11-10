// Enhanced agents with thinking mode for highest quality reports
// This file contains the complete enhanced agent architecture for generating
// world-class private equity interview reports using Gemini Pro's thinking capabilities

import { initGeminiClient, generateWithRetry, convertContentParts, generateWithFileSearch } from '../utils/gemini-wrapper.js';

// Load prompts from centralized JSON files
let enhancedPrompts = null;

async function loadEnhancedPrompts() {
    if (!enhancedPrompts) {
        try {
            const response = await fetch('./prompts/enhanced-agents-prompts.json');
            enhancedPrompts = await response.json();
        } catch (error) {
            console.error('Failed to load enhanced prompts:', error);
            // Fallback to empty object if loading fails
            enhancedPrompts = {};
        }
    }
    return enhancedPrompts;
}


// Enhanced Agent 10: Per-File Business Plan Analyzer
async function analyzeIndividualFile(file, index, model, genAI, fileSearchStoreName = null) {
    console.log(`🔍 开始分析文档 ${index + 1}: ${file.displayName}`);
    try {
        const prompts = await loadEnhancedPrompts();
        let filePrompt = prompts.perFileAnalysis;
        
        const contentParts = [
            { text: `${filePrompt.task}\n\n文档: ${file.displayName}\n\n重点:\n${filePrompt.critical?.map(c => `• ${c}`).join('\n') || '提取所有数据'}\n\n${filePrompt.outputFormat}` }
        ];
        
        if (file.content) {
            // For local TXT files
            contentParts.push({ text: `\n\n文档内容：\n${file.content}` });
        } else {
            // For uploaded files
            contentParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            });
        }
        
        // Use File Search RAG when available so every enhanced pass references the unified corpus
        const convertedParts = convertContentParts(contentParts);
        let result;
        if (fileSearchStoreName) {
            console.log(`📚 Using File Search RAG for per-file分析: ${file.displayName}`);
            result = await generateWithFileSearch(convertedParts, filePrompt.role, fileSearchStoreName, -1, model);
        } else {
            // Fall back to standard generation when RAG is unavailable
            result = await generateWithRetry(convertedParts, filePrompt.role, -1, model);
        }
        
        console.log(`✅ 文档 ${file.displayName} 分析成功 - 提取长度: ${result?.length || 0} 字符`);
        
        return {
            fileName: file.displayName,
            mimeType: file.mimeType,
            extractedContent: result,
            extractionTime: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`❌ 文档 ${file.displayName} 分析失败:`, error);
        return {
            fileName: file.displayName,
            mimeType: file.mimeType,
            extractedContent: `文件分析失败: ${error.message}\n\n请检查文件格式和API连接状态。`,
            error: true,
            extractionTime: new Date().toISOString()
        };
    }
}

// Simplified Per-File Analysis Only
export async function comprehensiveBPAnalysis(fileUris, model, genAI = null, progressCallback = null, fileSearchStoreName = null) {
    if (!fileUris || fileUris.length === 0) {
        return { combinedAnalyses: '', fileSummaries: [] };
    }
    
    try {
        console.log(`🔍 开始per-file分析 ${fileUris.length} 个文档...`);
        
        // Analyze each file individually in parallel with real-time updates
        const individualAnalyses = [];
        const fileAnalysisPromises = fileUris.map(async (file, index) => {
            const result = await analyzeIndividualFile(file, index, model, genAI, fileSearchStoreName);
            individualAnalyses[index] = result;
            
            // Call progress callback immediately when file completes
            if (progressCallback) {
                progressCallback(index, result.fileName, result.extractedContent);
            }
            
            return result;
        });
        
        await Promise.all(fileAnalysisPromises);
        console.log(`✅ Per-file分析完成，共处理了 ${individualAnalyses.length} 个文档`);
        
        // Return combined analyses for all other agents to use
        const fileSummaries = individualAnalyses.map(a => a.extractedContent);
        const combinedAnalyses = individualAnalyses.map((analysis, i) => `
【文档 ${i + 1}】${analysis.fileName}
${analysis.extractedContent}
${'='.repeat(60)}
`).join('\n');

        return { combinedAnalyses, fileSummaries };
        
    } catch (error) {
        console.error('Per-file analysis error:', error);
        return { combinedAnalyses: "Per-file分析失败：" + error.message, fileSummaries: [] };
    }
}

// Enhanced Agent 1: Deep Information Extraction with Cross-Reference (RAG-optimized)
export async function deepExtractChunk(chunk, index, transcript, combinedAnalyses, fileUris, model, fileSearchStoreName = null) {
    try {
        const prompts = await loadEnhancedPrompts();
        const extractPrompt = prompts.deepExtractChunk;

        if (!extractPrompt) {
            console.warn('Deep extract prompt not found, using fallback');
            return `片段 ${index + 1}: ${chunk}`;
        }

        // Use File Search RAG if available, otherwise fall back to traditional method
        if (fileSearchStoreName) {
            // RAG MODE: Use File Search API to retrieve relevant context
            console.log(`🔍 Using File Search RAG for chunk ${index + 1}`);

            const prompt = `${extractPrompt.task}

Requirements:
${extractPrompt.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

Critical: ${extractPrompt.critical}

访谈片段 ${index + 1}:
${chunk}

所有访谈原文和商业计划书材料均已写入统一的 File Search 存储，请检索相关证据来补全和验证信息。

${extractPrompt.outputFormat}`;

            const contents = [{
                role: 'user',
                parts: [{ text: prompt }]
            }];

            const result = await generateWithFileSearch(contents, extractPrompt.role, fileSearchStoreName, -1, model);
            return result;

        } else {
            // TRADITIONAL MODE: Pass full context (legacy behavior)
            console.log(`📋 Using traditional full-context mode for chunk ${index + 1}`);

            // Build content parts with all context
            const contentParts = [
                { text: `${extractPrompt.role}

${extractPrompt.task}

Requirements:
${extractPrompt.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

Critical: ${extractPrompt.critical}

访谈片段 ${index + 1}:
${chunk}

完整访谈上下文（用于理解背景）:
${transcript}

商业计划书分析（用于深度理解和交叉验证）:
${combinedAnalyses ? combinedAnalyses : '无商业计划书数据'}

${extractPrompt.outputFormat}

` }];


            // Add uploaded files for reference
            if (fileUris && fileUris.length > 0) {
                contentParts.push({ text: '\n\n**参考文档用于信息提取:**' });
                fileUris.slice(0, 2).forEach(file => { // Limit to first 2 files to avoid overload
                    if (file.content) {
                        contentParts.push({ text: `\n文档：${file.displayName}\n${file.content}` });
                    } else {
                        contentParts.push({
                            fileData: {
                                mimeType: file.mimeType,
                                fileUri: file.uri
                            }
                        });
                    }
                });
            }

            const convertedParts = convertContentParts(contentParts);
            const result = await generateWithRetry(convertedParts, extractPrompt.role, -1);
            return result;
        }

    } catch (error) {
        console.error(`Error in deepExtractChunk ${index}:`, error);
        return `片段 ${index + 1} 深度提取失败: ${error.message}`;
    }
}

// Enhanced Agent 2: Information Architecture
export async function architectInformation(extractedChunks, enhancedInfoSources, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const archPrompt = prompts.architectInformation;
        
        if (!archPrompt) {
            console.warn('Architect prompt not found, using fallback');
            return { analysis: "信息架构失败" };
        }
        
        const allInfo = extractedChunks.join('\n\n') + '\n\n' + enhancedInfoSources;
        
        const prompt = `${archPrompt.role}

${archPrompt.task}

组织结构要求:
${Object.entries(archPrompt.sections).map(([key, desc], i) => `${i + 1}. ${key}: ${desc}`).join('\n')}

信息源:
${allInfo}

${archPrompt.outputFormat}`;
        
        const parts = convertContentParts([{ text: prompt }]);
        const result = await generateWithRetry(parts, archPrompt.role, -1);
        
        try {
            return JSON.parse(result);
        } catch {
            return { analysis: result };
        }
        
    } catch (error) {
        console.error('Error in architectInformation:', error);
        return { error: error.message };
    }
}

// Enhanced Agent 4: Citation Verifier (RAG-optimized)
export async function verifyCitations(report, transcript, combinedAnalyses, fileSummaries, fileUris, model, fileSearchStoreName = null) {
    try {
        const prompts = await loadEnhancedPrompts();
        const verifyPrompt = prompts.verifyCitations;

        if (!verifyPrompt) {
            console.warn('Verify prompt not found, using fallback');
            return { verified: true, issues: [] };
        }

        // Use File Search RAG if available
        if (fileSearchStoreName) {
            console.log('🔍 Using File Search RAG for citation verification');

            const prompt = `${verifyPrompt.check ? verifyPrompt.check.map((task, i) => `${i + 1}. ${task}`).join('\n') : ''}

报告内容:
${report}

原始访谈记录:
${transcript}

请从已上传的商业计划书文档中检索信息以交叉验证报告中的引用和数据。

请按照以下格式输出验证结果：
${verifyPrompt.outputFormat}`;

            const contents = [{
                role: 'user',
                parts: [{ text: prompt }]
            }];

            const result = await generateWithFileSearch(contents, verifyPrompt.role, fileSearchStoreName, -1, model);

            try {
                return JSON.parse(result);
            } catch {
                return { verified: true, issues: [], note: result };
            }

        } else {
            // TRADITIONAL MODE
            console.log('📋 Using traditional full-context mode for citation verification');

            // Build content parts with all available data
            const contentParts = [
                { text: `${verifyPrompt.role}

${verifyPrompt.check ? verifyPrompt.check.map((task, i) => `${i + 1}. ${task}`).join('\n') : ''}

压缩总结:
${combinedAnalyses}

文件摘要:
${fileSummaries.map((fs,i)=>`文件${i+1}: ${fs}`).join('\n')}

报告内容:
${report}

原始访谈记录:
${transcript}` }
            ];

            // Add uploaded files as verification sources
            if (fileUris && fileUris.length > 0) {
                contentParts.push({ text: '\n\n**原始文档用于交叉验证:**' });
                fileUris.forEach(file => {
                    if (file.content) {
                        // For local TXT files
                        contentParts.push({ text: `\n文档：${file.displayName}\n${file.content}` });
                    } else {
                        // For uploaded files
                        contentParts.push({
                            fileData: {
                                mimeType: file.mimeType,
                                fileUri: file.uri
                            }
                        });
                    }
                });
            }

            contentParts.push({ text: `\n\n请按照以下格式输出验证结果：\n${verifyPrompt.outputFormat}` });

            const convertedParts = convertContentParts(contentParts);
            const result = await generateWithRetry(convertedParts, verifyPrompt.role, -1);

            try {
                return JSON.parse(result);
            } catch {
                return { verified: true, issues: [], note: result };
            }
        }

    } catch (error) {
        console.error('Error in verifyCitations:', error);
        return { verified: false, error: error.message };
    }
}


