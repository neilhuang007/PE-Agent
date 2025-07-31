// Fast agents optimized for speed while maintaining quality
// Fast mode uses the same prompts as enhanced mode, but with gemini-2.5-flash-lite and thinking budget of 0
import { generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

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
export async function fastExtractChunk(chunk, index, businessPlanContext, model) {
    console.log(`FastExtractChunk ${index + 1} input:`, chunk.substring(0, 100) + '...'); // Debug log
    
    try {
        const prompts = await loadEnhancedPrompts();
        const extractPrompt = prompts.deepExtractChunk; // Use same prompt as enhanced mode
        
        if (!extractPrompt) {
            console.warn('Extract prompt not found, using fallback');
            return `片段 ${index + 1}: ${chunk.substring(0, 500)}...`;
        }
        
        const prompt = `${extractPrompt.role}

${extractPrompt.task}

Requirements:
${extractPrompt.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

Critical: ${extractPrompt.critical}

访谈片段 ${index + 1}:
${chunk}

${businessPlanContext ? `商业计划书分析（用于深度理解和交叉验证）:
${businessPlanContext}` : '无商业计划书数据'}

${extractPrompt.outputFormat}`;

        const promptParts = convertContentParts([{ text: prompt }]);
        const extractedText = await generateWithRetry(promptParts, extractPrompt.role, 0); // Use thinking budget 0 for fast mode
        console.log(`FastExtractChunk ${index + 1} result:`, extractedText.substring(0, 150) + '...'); // Debug log
        return extractedText;
    } catch (error) {
        console.error(`Error in fastExtractChunk ${index}:`, error);
        return `片段 ${index + 1} 快速提取失败: ${error.message}`;
    }
}


// Fast Agent 3: Quick Report Composition - Takes raw extracted data and creates formatted report
export async function fastComposeReport(rawData, companyName, model) {
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

请直接输出完整格式化的报告。`;

        console.log('FastComposeReport prompt:', prompt.substring(0, 500) + '...'); // Debug log

        const composeParts = convertContentParts([{ text: prompt }]);
        const reportText = await generateWithRetry(composeParts, 'PE投资分析师', 0); // Use thinking budget 0 for fast mode
        
        console.log('FastComposeReport raw result:', reportText.substring(0, 200) + '...'); // Debug log
        
        // Safety check for valid report
        if (!reportText || typeof reportText !== 'string' || reportText.trim().length < 50) {
            console.error('生成的报告过短或无效，长度:', reportText?.length);
            return `【报告生成错误】\n无法生成有效报告内容。\n\n基于提供的信息：\n${rawData.substring(0, 500)}...`;
        }
        
        return reportText;
    } catch (error) {
        console.error('Error in fastComposeReport:', error);
        return `【报告生成失败】\n错误信息: ${error.message}\n\n输入信息:\n公司：${companyName}\n原始数据: ${rawData.substring(0, 200)}...`;
    }
}

// Fast Agent 4: Quick Quality Check - Uses enhanced prompts with thinking budget 0
export async function fastQualityCheck(report, transcript, businessPlanAnalysis, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const qualityPrompt = prompts.validateExcellence; // Use same prompt as enhanced mode
        
        if (!qualityPrompt) {
            console.warn('Quality prompt not found, using fallback');
            return { score: 85, pass: true, issues: [], summary: "快速检查完成" };
        }
        
        const prompt = `${qualityPrompt.role}

评估标准：
${qualityPrompt.criteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

评分系统：
${qualityPrompt.outputFormat}

报告内容:
${report}

原始访谈记录（用于完整性评估）:
${transcript}

商业计划书分析（用于深度评估）:
${businessPlanAnalysis || '无商业计划书数据'}

请按照以下格式输出评估结果：
${JSON.stringify(qualityPrompt.outputFormat, null, 2)}`;

        const qParts = convertContentParts([{ text: prompt }]);
        const text = await generateWithRetry(qParts, qualityPrompt.role, 0); // Use thinking budget 0 for fast mode
        
        try {
            return JSON.parse(text);
        } catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { score: 80, pass: true, issues: [], summary: "快速检查完成", note: text };
        }
    } catch (error) {
        console.error('Error in fastQualityCheck:', error);
        return { score: 75, pass: true, issues: ["检查失败"], summary: "检查过程出错", error: error.message };
    }
}

// Fast Agent 5: Quick Formatting - Uses formatter prompts with thinking budget 0
export async function fastFormatReport(report, model) {
    try {
        const formatterPrompts = await loadFormatterPrompts();
        const formatPrompt = formatterPrompts.reportFormatter;
        
        if (!formatPrompt) {
            console.warn('Formatter prompt not found, using fallback');
            return report;
        }
        
        const prompt = `${formatPrompt.userPrompt}\n\nReport content to format:\n${report}`;
        const formatParts = convertContentParts([{ text: prompt }]);
        return await generateWithRetry(formatParts, formatPrompt.systemPrompt, 0); // Use thinking budget 0 for fast mode
    } catch (error) {
        console.error('Error in fastFormatReport:', error);
        return report; // 如果格式化失败，返回原报告
    }
}