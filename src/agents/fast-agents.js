// Fast agents optimized for speed while maintaining quality
// Fast mode uses the same prompts as enhanced mode, but with gemini-2.5-flash-lite and thinking budget of 0
import { generateWithRetry, convertContentParts, generateWithFileSearch } from '../utils/gemini-wrapper.js';

// Load prompts from enhanced agents prompts (shared prompts)
let enhancedPrompts = null;
let formatterPrompts = null;

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

async function loadFormatterPrompts() {
    if (!formatterPrompts) {
        try {
            const response = await fetch('./prompts/formatter-prompts.json');
            formatterPrompts = await response.json();
        } catch (error) {
            console.error('Failed to load formatter prompts:', error);
            formatterPrompts = {};
        }
    }
    return formatterPrompts;
}

// Fast Agent 1: Quick Information Extraction - Uses enhanced prompts with thinking budget 0
export async function fastExtractChunk(chunk, index, businessPlanContext, model, fileSearchStoreName = null) {
    console.log(`FastExtractChunk ${index + 1} input:`, chunk); // Debug log
    
    try {
        const prompts = await loadEnhancedPrompts();
        const extractPrompt = prompts.deepExtractChunk; // Use same prompt as enhanced mode

        if (!extractPrompt) {
            console.warn('Extract prompt not found, using fallback');
            return `片段 ${index + 1}: ${chunk}`;
        }

        const ragNotice = fileSearchStoreName
            ? '\nRAG 已启用：所有文档均来自统一的 Google File API + File Search 存储，可直接检索引用。'
            : '';

        const prompt = `${extractPrompt.role}

${extractPrompt.task}

Requirements:
${extractPrompt.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

Critical: ${extractPrompt.critical}

访谈片段 ${index + 1}:
${chunk}

${businessPlanContext ? `商业计划书分析（用于深度理解和交叉验证）：
${businessPlanContext}` : '无商业计划书数据'}

${ragNotice}

${extractPrompt.outputFormat}`;

        const promptParts = convertContentParts([{ text: prompt }]);
        let extractedText;
        if (fileSearchStoreName) {
            extractedText = await generateWithFileSearch(promptParts, extractPrompt.role, fileSearchStoreName, 0, model);
        } else {
            extractedText = await generateWithRetry(promptParts, extractPrompt.role, 0, model); // Use thinking budget 0 for fast mode
        }
        console.log(`FastExtractChunk ${index + 1} result:`, extractedText); // Debug log
        return extractedText;
    } catch (error) {
        console.error(`Error in fastExtractChunk ${index}:`, error);
        return `片段 ${index + 1} 快速提取失败: ${error.message}`;
    }
}


// Fast Agent 3: Quick Report Composition - Takes raw extracted data and creates formatted report
export async function fastComposeReport(rawData, companyName, model, fileSearchStoreName = null) {
    console.log('FastComposeReport inputs:', { rawDataLength: rawData?.length, companyName }); // Debug log
    
    // Ensure we have valid inputs
    if (!rawData || typeof rawData !== 'string') {
        console.error('Invalid rawData:', rawData);
        rawData = "提取的信息为空";
    }
    
    if (!companyName || typeof companyName !== 'string') {
        console.error('Invalid companyName:', companyName);
        companyName = "未知公司";
    }
    
    try {
        // Use formatter approach - let the model organize and format the raw data
        const ragNotice = fileSearchStoreName
            ? '\n\n所有引用文档已通过 Google File API 上传并写入 File Search RAG，可根据需要检索以核对事实。'
            : '';

        const prompt = `你是专业的PE投资分析师，请基于以下原始信息生成专业的投资访谈报告。

公司名称: ${companyName}

原始提取信息:
${rawData}

要求：
1. 从原始信息中提取关键数据并按章节组织
2. 使用专业投资语言
3. 重要数据用**粗体**标记
4. 清晰的章节结构
5. 仅使用访谈中的事实信息
6. 专注于访谈总结，不进行分析

报告结构：
### 【公司简介】
#### 公司概述
#### 核心团队
### 【行业情况】
### 【主营业务】
### 【财务情况】
### 【融资情况】
#### 融资历史

${ragNotice}

请直接输出完整格式化的报告。`;

        console.log('FastComposeReport prompt:', prompt); // Debug log

        const composeParts = convertContentParts([{ text: prompt }]);
        let reportText;
        if (fileSearchStoreName) {
            reportText = await generateWithFileSearch(composeParts, 'PE投资分析师', fileSearchStoreName, 0, model);
        } else {
            reportText = await generateWithRetry(composeParts, 'PE投资分析师', 0, model); // Use thinking budget 0 for fast mode
        }
        
        console.log('FastComposeReport raw result:', reportText); // Debug log
        
        // Safety check for valid report
        if (!reportText || typeof reportText !== 'string' || reportText.trim().length < 50) {
            console.error('生成的报告过短或无效，长度:', reportText?.length);
            return `【报告生成错误】\n无法生成有效报告内容。\n\n基于提供的信息：\n${rawData}`;
        }
        
        return reportText;
    } catch (error) {
        console.error('Error in fastComposeReport:', error);
        return `【报告生成失败】\n错误信息: ${error.message}\n\n输入信息:\n公司：${companyName}\n原始数据: ${rawData}`;
    }
}

// Fast Agent 4 removed: quality optimization now handled directly in main pipeline without scoring
// Fast Agent 5: Quick Formatting - Uses formatter prompts with thinking budget 0
export async function fastFormatReport(report, model, fileSearchStoreName = null) {
    try {
        const formatterPrompts = await loadFormatterPrompts();
        const formatPrompt = formatterPrompts.reportFormatter;
        
        if (!formatPrompt) {
            console.warn('Formatter prompt not found, using fallback');
            return report;
        }
        
        const ragNotice = fileSearchStoreName
            ? '\n\n【RAG 提示】可在需要时查询统一的 Google File API 文档存储，保持事实一致性。'
            : '';

        const prompt = `${formatPrompt.userPrompt}${ragNotice}\n\nReport content to format:\n${report}`;
        const formatParts = convertContentParts([{ text: prompt }]);
        if (fileSearchStoreName) {
            return await generateWithFileSearch(formatParts, formatPrompt.systemPrompt, fileSearchStoreName, 0, model);
        }
        return await generateWithRetry(formatParts, formatPrompt.systemPrompt, 0, model); // Use thinking budget 0 for fast mode
    } catch (error) {
        console.error('Error in fastFormatReport:', error);
        return report; // 如果格式化失败，返回原报告
    }
}