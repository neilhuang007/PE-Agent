// Enhanced agents with thinking mode for highest quality reports
// This file contains the complete enhanced agent architecture for generating
// world-class private equity interview reports using Gemini Pro's thinking capabilities

import { generateWithThinking, generateWithFilesAndThinking } from '../config/gemini-config.js';
import { getPrompt, buildPrompt } from '../utils/prompt-loader.js';

// Enhanced Agent 10: Comprehensive Business Plan Analyzer
export async function comprehensiveBPAnalysis(fileUris, model) {
    if (!fileUris || fileUris.length === 0) {
        return "无商业计划书可供分析";
    }
    
    // Load prompt from centralized JSON
    const promptConfig = getPrompt('enhanced-agents-prompts', 'comprehensiveBPAnalysis');
    
    const contentParts = [
        { text: promptConfig.role }
    ];
    
    contentParts.push({ text: '\n\n' + promptConfig.taskIntro });
    fileUris.forEach(file => {
        contentParts.push({
            fileData: {
                mimeType: file.mimeType,
                fileUri: file.uri
            }
        });
    });
    
    // Build complete prompt from components
    const taskPrompt = `
${promptConfig.taskDetails}

${promptConfig.outputFormat}`;
    
    contentParts.push({ text: taskPrompt });
    
    try {
        const result = await generateWithFilesAndThinking(contentParts, model, promptConfig.thinkingPrompt);
        return result;
    } catch (error) {
        console.error('BP分析错误:', error);
        return "商业计划书分析失败：" + error.message;
    }
}

// Enhanced Agent 1: Deep Information Extraction with Thinking
export async function deepExtractChunk(chunk, fileUris, model) {
    const promptConfig = getPrompt('enhanced-agents-prompts', 'deepExtractChunk');
    
    const contentParts = [
        { text: promptConfig.role }
    ];
    
    contentParts.push({ text: `\n\n访谈片段：\n${chunk}` });
    
    // Add context from uploaded files
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n参考以下支持文档进行更深入的分析：' });
        fileUris.forEach(file => {
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
    
    // Build requirements
    const requirementsText = promptConfig.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n');
    contentParts.push({ text: `\n\n深度提取要求：\n${requirementsText}\n\n${promptConfig.outputFormat}` });
    
    return await generateWithFilesAndThinking(contentParts, model, promptConfig.thinkingPrompt);
}

// Enhanced Agent 2: Information Architecture with Thinking
export async function architectInformation(extractedInfo, model) {
    const promptConfig = getPrompt('enhanced-agents-prompts', 'architectInformation');
    
    const prompt = buildPrompt({
        role: promptConfig.role,
        mainTask: promptConfig.mainTask,
        requirements: promptConfig.requirements,
        outputFormat: promptConfig.outputStructure,
        thinkingPrompt: promptConfig.thinkingPrompt
    });
    
    const fullPrompt = `${prompt}\n\n待架构的信息：\n${extractedInfo}`;
    
    return await generateWithThinking(fullPrompt, model, promptConfig.thinkingPrompt);
}

// Export other functions (to be updated similarly)
export { 
    masterComposeReport,
    verifyCitations,
    validateExcellence,
    intelligentEnrichment,
    integrateEnhancements,
    excellenceFormatter,
    finalQualityInspection
} from './enhanced-agents.js';