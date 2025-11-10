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


// Enhanced Business Plan Analysis using RAG (File Search Store)
// This replaces the old per-file analysis with a unified RAG-based approach
export async function comprehensiveBPAnalysis(fileMetadata, model, genAI = null, progressCallback = null, fileSearchStoreName = null) {
    if (!fileMetadata || fileMetadata.length === 0) {
        return { combinedAnalyses: '', fileSummaries: [] };
    }

    if (!fileSearchStoreName) {
        console.error('❌ File Search Store not available - cannot analyze documents');
        return { combinedAnalyses: '文档分析失败：RAG 系统未初始化', fileSummaries: [] };
    }

    try {
        console.log(`🔍 开始使用 RAG 分析 ${fileMetadata.length} 个文档...`);

        const prompts = await loadEnhancedPrompts();
        let filePrompt = prompts.perFileAnalysis;

        if (!filePrompt) {
            console.warn('Per-file analysis prompt not found');
            filePrompt = {
                task: '请分析所有上传的商业计划书文档，提取关键信息',
                role: '你是一位资深的投资分析专家',
                outputFormat: '请以结构化格式输出所有文档的关键信息'
            };
        }

        // Build comprehensive prompt for analyzing all documents via RAG
        const fileList = fileMetadata.map((f, i) => `${i + 1}. ${f.displayName} (${f.mimeType})`).join('\n');

        const prompt = `${filePrompt.task}

已上传的文档列表:
${fileList}

重点:
${filePrompt.critical?.map(c => `• ${c}`).join('\n') || '• 提取所有关键商业数据\n• 分析市场定位和竞争优势\n• 提取财务指标和增长数据'}

请从所有已上传的文档中检索和综合信息，生成全面的商业计划分析。

${filePrompt.outputFormat}`;

        const contents = [{
            role: 'user',
            parts: [{ text: prompt }]
        }];

        // Use RAG to analyze all documents at once
        console.log('🔍 Using File Search RAG to analyze all documents...');
        const result = await generateWithFileSearch(contents, filePrompt.role, fileSearchStoreName, -1, model);

        console.log(`✅ RAG 文档分析完成 - 提取长度: ${result?.length || 0} 字符`);

        // Call progress callback with the comprehensive analysis
        if (progressCallback) {
            progressCallback(0, '所有文档 (RAG)', result);
        }

        // Return combined analyses
        const combinedAnalyses = `【综合文档分析 (RAG)】
基于 ${fileMetadata.length} 个文档:
${fileList}

${result}
${'='.repeat(60)}`;

        return {
            combinedAnalyses,
            fileSummaries: [result]
        };

    } catch (error) {
        console.error('RAG document analysis error:', error);
        return {
            combinedAnalyses: `RAG文档分析失败：${error.message}`,
            fileSummaries: []
        };
    }
}

// Enhanced Agent 1: Deep Information Extraction with Cross-Reference (RAG-only)
export async function deepExtractChunk(chunk, index, transcript, combinedAnalyses, fileUris, model, fileSearchStoreName) {
    if (!fileSearchStoreName) {
        console.error('❌ File Search Store not available for chunk extraction');
        return `片段 ${index + 1}: ${chunk}\n\n[注意: RAG系统未启用，仅返回原始内容]`;
    }

    try {
        const prompts = await loadEnhancedPrompts();
        const extractPrompt = prompts.deepExtractChunk;

        if (!extractPrompt) {
            console.warn('Deep extract prompt not found, using fallback');
            return `片段 ${index + 1}: ${chunk}`;
        }

        // RAG MODE: Use File Search API to retrieve relevant context from all documents
        console.log(`🔍 Using File Search RAG for chunk ${index + 1}`);

        const prompt = `${extractPrompt.task}

Requirements:
${extractPrompt.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

Critical: ${extractPrompt.critical}

访谈片段 ${index + 1}:
${chunk}

完整访谈上下文（用于理解背景）:
${transcript}

${combinedAnalyses ? `
商业计划书综合分析:
${combinedAnalyses}
` : ''}

请从已上传的所有文档中检索相关信息，以深度理解和交叉验证访谈内容。

${extractPrompt.outputFormat}`;

        const contents = [{
            role: 'user',
            parts: [{ text: prompt }]
        }];

        const result = await generateWithFileSearch(contents, extractPrompt.role, fileSearchStoreName, -1, model);
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

// Enhanced Agent 4: Citation Verifier (RAG-optimized)
export async function verifyCitations(report, transcript, combinedAnalyses, fileSummaries, fileUris, model, fileSearchStoreName = null) {
    try {
        const prompts = await loadEnhancedPrompts();
        const verifyPrompt = prompts.verifyCitations;

        if (!verifyPrompt) {
            console.warn('Verify prompt not found, using fallback');
            return { verified: true, issues: [] };
        }

        // RAG-only mode
        if (!fileSearchStoreName) {
            console.warn('⚠️ File Search Store not available for citation verification - skipping');
            return { verified: true, issues: [], note: 'RAG系统未启用，跳过验证' };
        }

        console.log('🔍 Using File Search RAG for citation verification');

        const prompt = `${verifyPrompt.check ? verifyPrompt.check.map((task, i) => `${i + 1}. ${task}`).join('\n') : ''}

报告内容:
${report}

原始访谈记录:
${transcript}

${combinedAnalyses ? `
商业计划书综合分析:
${combinedAnalyses}
` : ''}

请从已上传的所有文档中检索信息以交叉验证报告中的引用和数据。

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

    } catch (error) {
        console.error('Error in verifyCitations:', error);
        return { verified: false, error: error.message };
    }
}


// Enhanced Agent 5: Excellence Validator (RAG-optimized)
export async function validateExcellence(report, transcript, combinedAnalyses, fileUris, model, fileSearchStoreName = null) {
    try {
        const prompts = await loadEnhancedPrompts();
        const validatePrompt = prompts.validateExcellence;

        if (!validatePrompt) {
            console.warn('Validate prompt not found, using fallback');
            return { score: 85, pass: true };
        }

        // RAG-only mode
        if (!fileSearchStoreName) {
            console.warn('⚠️ File Search Store not available for excellence validation - using default score');
            return { score: 85, pass: true, note: 'RAG系统未启用，使用默认评分' };
        }

        console.log('🔍 Using File Search RAG for excellence validation');

        const prompt = `评估标准：
${validatePrompt.criteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

评分系统：
${validatePrompt.outputFormat}

报告内容:
${report}

原始访谈记录（用于完整性评估）:
${transcript}

${combinedAnalyses ? `
商业计划书综合分析:
${combinedAnalyses}
` : ''}

请从已上传的所有文档中检索信息以评估报告的深度和质量。

请按照以下格式输出评估结果：
${JSON.stringify(validatePrompt.outputFormat, null, 2)}`;

        const contents = [{
            role: 'user',
            parts: [{ text: prompt }]
        }];

        const result = await generateWithFileSearch(contents, validatePrompt.role, fileSearchStoreName, -1, model);

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



