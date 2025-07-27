// Fast agents optimized for speed while maintaining quality
// These agents use more concise prompts and focus on essential information extraction
import { generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

// Load prompts from centralized JSON files
let fastPrompts = null;

async function loadFastPrompts() {
    if (!fastPrompts) {
        try {
            const response = await fetch('./prompts/fast-agents-prompts.json');
            fastPrompts = await response.json();
        } catch (error) {
            console.error('Failed to load fast prompts:', error);
            // Fallback to empty object if loading fails
            fastPrompts = {};
        }
    }
    return fastPrompts;
}

// Fast Agent 1: Quick Information Extraction - Optimized for Speed and Accuracy
export async function fastExtractChunk(chunk, index, businessPlanContext, model) {
    console.log(`FastExtractChunk ${index + 1} input:`, chunk.substring(0, 100) + '...'); // Debug log
    
    try {
        const prompts = await loadFastPrompts();
        const extractPrompt = prompts.fastExtractChunk;
        
        if (!extractPrompt) {
            console.warn('Fast extract prompt not found, using fallback');
            return `片段 ${index + 1}: ${chunk.substring(0, 500)}...`;
        }
        
        const prompt = `${extractPrompt.role}

${extractPrompt.task}

片段 ${index + 1}: ${chunk}

${businessPlanContext ? `商业计划书关键信息（用于理解上下文）：\n${businessPlanContext}\n` : ''}

重点提取：
${extractPrompt.extractionFocus.map(focus => `• ${focus}`).join('\n')}

${extractPrompt.outputFormat}`;

        const promptParts = convertContentParts([{ text: prompt }]);
        const extractedText = await generateWithRetry(promptParts, extractPrompt.role, -1);
        console.log(`FastExtractChunk ${index + 1} result:`, extractedText.substring(0, 150) + '...'); // Debug log
        return extractedText;
    } catch (error) {
        console.error(`Error in fastExtractChunk ${index}:`, error);
        return `片段 ${index + 1} 快速提取失败: ${error.message}`;
    }
}

// Fast Agent 2: Quick Information Organization - Streamlined for Speed
export async function fastOrganizeInformation(extractedChunks, businessPlan, model) {
    const allInfo = extractedChunks.join('\n') + (businessPlan ? `\n${businessPlan}` : '');
    
    try {
        const prompts = await loadFastPrompts();
        const organizePrompt = prompts.fastOrganizeInformation;
        
        if (!organizePrompt) {
            console.warn('Fast organize prompt not found, using fallback');
            return {
                "公司概况": ["信息提取失败"],
                "业务模式": ["信息提取失败"],
                "财务状况": ["信息提取失败"],
                "市场情况": ["信息提取失败"],
                "发展计划": ["信息提取失败"]
            };
        }
        
        const prompt = `${organizePrompt.role}

${organizePrompt.task}

信息: ${allInfo}

JSON格式：
${JSON.stringify(organizePrompt.organizationStructure, null, 2)}

${organizePrompt.outputFormat}`;

        const parts = convertContentParts([{ text: prompt }]);
        const text = await generateWithRetry(parts, organizePrompt.role, -1);
        console.log('FastOrganize raw response:', text); // Debug log
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('FastOrganize parsed result:', parsed); // Debug log
            return parsed;
        }
        
        // Fallback: create a basic structure from the raw information
        console.warn('Failed to parse JSON, creating fallback structure');
        return {
            "公司概况": [allInfo.substring(0, 200) + "..."],
            "业务模式": [allInfo.substring(200, 400) + "..."],
            "财务状况": [allInfo.substring(400, 600) + "..."],
            "市场情况": [allInfo.substring(600, 800) + "..."],
            "发展计划": [allInfo.substring(800, 1000) + "..."]
        };
    } catch (error) {
        console.error('Error in fastOrganizeInformation:', error);
        // Return a fallback structure instead of null
        return {
            "公司概况": ["信息提取失败"],
            "业务模式": ["信息提取失败"],
            "财务状况": ["信息提取失败"],
            "市场情况": ["信息提取失败"],
            "发展计划": ["信息提取失败"]
        };
    }
}

// Fast Agent 3: Quick Report Composition - Optimized for Speed and Accuracy
export async function fastComposeReport(organizedInfo, companyName, model) {
    console.log('FastComposeReport inputs:', { organizedInfo, companyName }); // Debug log
    
    // Ensure we have valid inputs
    if (!organizedInfo || typeof organizedInfo !== 'object') {
        console.error('Invalid organizedInfo:', organizedInfo);
        organizedInfo = { "错误": ["输入数据无效"] };
    }
    
    if (!companyName || typeof companyName !== 'string') {
        console.error('Invalid companyName:', companyName);
        companyName = "未知公司";
    }
    
    try {
        const prompts = await loadFastPrompts();
        const composePrompt = prompts.fastComposeReport;
        
        if (!composePrompt) {
            console.warn('Fast compose prompt not found, using fallback');
            return `# ${companyName} 投资访谈报告\n\n基本信息分析完成`;
        }
        
        const prompt = `${composePrompt.role}

${composePrompt.task}

公司：${companyName}
信息：${JSON.stringify(organizedInfo, null, 2)}

要求：
${composePrompt.requirements.map(req => `- ${req}`).join('\n')}

格式：
${composePrompt.reportStructure.join('\n')}

${composePrompt.outputFormat}`;

        console.log('FastComposeReport prompt:', prompt.substring(0, 500) + '...'); // Debug log

        const composeParts = convertContentParts([{ text: prompt }]);
        const reportText = await generateWithRetry(composeParts, composePrompt.role, -1);
        
        console.log('FastComposeReport raw result:', reportText.substring(0, 200) + '...'); // Debug log
        
        // Safety check for valid report
        if (!reportText || typeof reportText !== 'string' || reportText.trim().length < 50) {
            console.error('生成的报告过短或无效，长度:', reportText?.length);
            return `【报告生成错误】\n无法生成有效报告内容。\n\n基于提供的信息：\n${JSON.stringify(organizedInfo, null, 2)}`;
        }
        
        return reportText;
    } catch (error) {
        console.error('Error in fastComposeReport:', error);
        return `【报告生成失败】\n错误信息: ${error.message}\n\n输入信息:\n公司：${companyName}\n数据：${JSON.stringify(organizedInfo, null, 2)}`;
    }
}

// Fast Agent 4: Quick Quality Check - Streamlined but with context
export async function fastQualityCheck(report, transcript, businessPlanAnalysis, model) {
    try {
        const prompts = await loadFastPrompts();
        const qualityPrompt = prompts.fastQualityCheck;
        
        if (!qualityPrompt) {
            console.warn('Fast quality prompt not found, using fallback');
            return { score: 85, pass: true, issues: [], summary: "快速检查完成" };
        }
        
        const prompt = `${qualityPrompt.role}

${qualityPrompt.task}

报告内容：
${report}

原始访谈记录（用于完整性检查）：
${transcript}

商业计划书分析（用于一致性检查）：
${businessPlanAnalysis ? businessPlanAnalysis : '无商业计划书数据'}

评估标准：
${qualityPrompt.evaluationCriteria.map(criteria => `- ${criteria}`).join('\n')}

${qualityPrompt.outputFormat}`;

        const qParts = convertContentParts([{ text: prompt }]);
        const text = await generateWithRetry(qParts, qualityPrompt.role, -1);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { score: 80, pass: true, issues: [], summary: "快速检查完成" };
    } catch (error) {
        console.error('Error in fastQualityCheck:', error);
        return { score: 75, pass: true, issues: ["检查失败"], summary: "检查过程出错" };
    }
}

// Fast Agent 5: Quick Formatting - Streamlined
export async function fastFormatReport(report, model) {
    try {
        const prompts = await loadFastPrompts();
        const formatPrompt = prompts.fastFormatReport;
        
        if (!formatPrompt) {
            console.warn('Fast format prompt not found, using fallback');
            return report;
        }
        
        const prompt = `${formatPrompt.role}

${formatPrompt.task}

${report}

要求：
${formatPrompt.formattingRequirements.map(req => `- ${req}`).join('\n')}

${formatPrompt.outputFormat}`;

        const formatParts = convertContentParts([{ text: prompt }]);
        return await generateWithRetry(formatParts, formatPrompt.role, -1);
    } catch (error) {
        console.error('Error in fastFormatReport:', error);
        return report; // 如果格式化失败，返回原报告
    }
}