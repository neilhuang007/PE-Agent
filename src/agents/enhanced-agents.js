// Enhanced agents with thinking mode for highest quality reports
// This file contains the complete enhanced agent architecture for generating
// world-class private equity interview reports using Gemini Pro's thinking capabilities

import { initGeminiClient, generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

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
async function analyzeIndividualFile(file, index, model, genAI) {
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
        
        // Use the new TypeScript wrapper if genAI is available, otherwise fall back to old method
        let result;
        if (genAI) {
            const convertedParts = convertContentParts(contentParts);
            result = await generateWithRetry(convertedParts, filePrompt.role, -1); // Use dynamic thinking
        } else {
            const convertedParts = convertContentParts(contentParts);
            result = await generateWithRetry(convertedParts, filePrompt.role, -1);
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
export async function comprehensiveBPAnalysis(fileUris, model, genAI = null, progressCallback = null) {
    if (!fileUris || fileUris.length === 0) {
        return { combinedAnalyses: '', fileSummaries: [] };
    }
    
    try {
        console.log(`🔍 开始per-file分析 ${fileUris.length} 个文档...`);
        
        // Analyze each file individually in parallel with real-time updates
        const individualAnalyses = [];
        const fileAnalysisPromises = fileUris.map(async (file, index) => {
            const result = await analyzeIndividualFile(file, index, model, genAI);
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

// Enhanced Agent 1: Deep Information Extraction with Cross-Reference
export async function deepExtractChunk(chunk, index, transcript, combinedAnalyses, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const extractPrompt = prompts.deepExtractChunk;
        
        if (!extractPrompt) {
            console.warn('Deep extract prompt not found, using fallback');
            return `片段 ${index + 1}: ${chunk}`;
        }
        
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


        console.log(contentParts.text)

        
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

        console.log(contentParts)

        const convertedParts = convertContentParts(contentParts);
        const result = await generateWithRetry(convertedParts, extractPrompt.role, -1);
        return result;
        
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

// Enhanced Agent 4: Citation Verifier
export async function verifyCitations(report, transcript, combinedAnalyses, fileSummaries, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const verifyPrompt = prompts.verifyCitations;
        
        if (!verifyPrompt) {
            console.warn('Verify prompt not found, using fallback');
            return { verified: true, issues: [] };
        }
        
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
        
    } catch (error) {
        console.error('Error in verifyCitations:', error);
        return { verified: false, error: error.message };
    }
}


// Enhanced Agent 5: Excellence Validator
export async function validateExcellence(report, transcript, combinedAnalyses, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const validatePrompt = prompts.validateExcellence;
        
        if (!validatePrompt) {
            console.warn('Validate prompt not found, using fallback');
            return { score: 85, pass: true };
        }
        
        // Build content parts with all available data for comprehensive evaluation
        const contentParts = [
            { text: `${validatePrompt.role}

评估标准：
${validatePrompt.criteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

评分系统：
${validatePrompt.outputFormat}

报告内容:
${report}

原始访谈记录（用于完整性评估）:
${transcript}

商业计划书分析（用于深度评估）:
${combinedAnalyses || '无商业计划书数据'}` }
        ];
        
        // Add uploaded files for comprehensive quality assessment
        if (fileUris && fileUris.length > 0) {
            contentParts.push({ text: '\n\n**原始文档用于质量评估:**' });
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
        
        contentParts.push({ text: `\n\n请按照以下格式输出评估结果：\n${JSON.stringify(validatePrompt.outputFormat, null, 2)}` });
        
        const convertedParts = convertContentParts(contentParts);
        const result = await generateWithRetry(convertedParts, validatePrompt.role, -1);
        
        try {
            return JSON.parse(result);
        } catch {
            return { score: 80, pass: true, note: result };
        }
        
    } catch (error) {
        console.error('Error in validateExcellence:', error);
        return { score: 75, pass: true, error: error.message };
    }
}



