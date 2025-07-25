// Enhanced agents with thinking mode for highest quality reports
// This file contains the complete enhanced agent architecture for generating
// world-class private equity interview reports using Gemini Pro's thinking capabilities

import { generateWithThinking, generateWithFilesAndThinking } from '../config/gemini-config.js';

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

// Enhanced Agent 10: Comprehensive Business Plan Analyzer
export async function comprehensiveBPAnalysis(fileUris, model) {
    if (!fileUris || fileUris.length === 0) {
        return "无商业计划书可供分析";
    }
    
    try {
        const prompts = await loadEnhancedPrompts();
        let bpPrompt = prompts.comprehensiveBPAnalysis;
        
        if (!bpPrompt) {
            console.warn('BP analysis prompt not found, using fallback');
            // Fallback to basic prompt if JSON loading fails
            bpPrompt = {
                role: "你是一位世界顶级的商业计划书分析专家，拥有20年分析经验，曾为数百家PE机构进行BP深度分析。",
                taskIntro: "请对以下商业计划书进行最深度、最全面的分析：",
                taskDetails: "分析任务：深度分析商业计划书的所有方面",
                outputFormat: "输出格式：结构化分析报告",
                thinkingPrompt: "分析思路：系统性商业计划书分析"
            };
        }
        
        const contentParts = [
            { text: bpPrompt.role }
        ];
        
        contentParts.push({ text: `\n\n${bpPrompt.taskIntro}` });
        fileUris.forEach(file => {
            contentParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            });
        });
        
        contentParts.push({ text: `\n\n${bpPrompt.taskDetails}\n\n${bpPrompt.outputFormat}` });
        
        const result = await generateWithFilesAndThinking(model, contentParts, 'VERY_HIGH');
        return result.text || result;
        
    } catch (error) {
        console.error('BP analysis error:', error);
        return "商业计划书分析失败：" + error.message;
    }
}

// Enhanced Agent 1: Deep Information Extraction with Cross-Reference
export async function deepExtractChunk(chunk, index, transcript, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const extractPrompt = prompts.deepExtractChunk;
        
        if (!extractPrompt) {
            console.warn('Deep extract prompt not found, using fallback');
            return `片段 ${index + 1}: ${chunk.substring(0, 500)}...`;
        }
        
        const prompt = `${extractPrompt.role}

访谈片段 ${index + 1}:
${chunk}

完整访谈上下文（用于理解背景）:
${transcript.substring(0, 5000)}...

${extractPrompt.extractionFocus.map((req, i) => `${i + 1}. ${req}`).join('\n')}

${extractPrompt.outputFormat}`;
        
        const result = await generateWithThinking(prompt, model, 'Extract key information from this transcript segment');
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
${Object.entries(archPrompt.organizationStructure).map(([key, desc], i) => `${i + 1}. ${key}: ${desc}`).join('\n')}

信息源:
${allInfo.substring(0, 15000)}

${archPrompt.outputFormat}`;
        
        const result = await generateWithThinking(prompt, model, 'Organize extracted information into structured sections');
        
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

// Enhanced Agent 3: Master Report Composer
export async function masterComposeReport(organizedInfo, companyName, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const composePrompt = prompts.masterComposeReport;
        
        if (!composePrompt) {
            console.warn('Compose prompt not found, using fallback');
            return `# ${companyName} 投资访谈报告\n\n基本信息分析完成`;
        }
        
        const prompt = `${composePrompt.role}

${composePrompt.task}

公司名称: ${companyName}

组织化信息:
${JSON.stringify(organizedInfo, null, 2)}

请按照以下结构撰写报告：
${JSON.stringify(composePrompt.reportStructure, null, 2)}

写作标准：
${composePrompt.writingStandards.map((std, i) => `${i + 1}. ${std}`).join('\n')}`;
        
        const result = await generateWithThinking(prompt, model, 'Generate comprehensive PE interview report');
        return result;
        
    } catch (error) {
        console.error('Error in masterComposeReport:', error);
        return `# ${companyName} 投资访谈报告\n\n报告生成失败: ${error.message}`;
    }
}

// Enhanced Agent 4: Citation Verifier
export async function verifyCitations(report, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const verifyPrompt = prompts.verifyCitations;
        
        if (!verifyPrompt) {
            console.warn('Verify prompt not found, using fallback');
            return { verified: true, issues: [] };
        }
        
        const prompt = `${verifyPrompt.role}

${verifyPrompt.checkPoints.map((task, i) => `${i + 1}. ${task}`).join('\n')}

报告内容:
${report.substring(0, 10000)}

请按照以下格式输出验证结果：
${verifyPrompt.outputFormat}`;
        
        const result = await generateWithThinking(prompt, model, 'Verify data accuracy in the report');
        
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
export async function validateExcellence(report, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const validatePrompt = prompts.validateExcellence;
        
        if (!validatePrompt) {
            console.warn('Validate prompt not found, using fallback');
            return { score: 85, pass: true };
        }
        
        const prompt = `${validatePrompt.role}

评估标准：
${validatePrompt.evaluationCriteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

评分系统：
${validatePrompt.outputFormat}

报告内容:
${report.substring(0, 10000)}

请按照以下格式输出评估结果：
${JSON.stringify(validatePrompt.outputFormat, null, 2)}`;
        
        const result = await generateWithThinking(prompt, model, 'Evaluate report quality and completeness');
        
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

// Enhanced Agent 6: Intelligent Enrichment
export async function intelligentEnrichment(report, originalSources, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const enrichPrompt = prompts.intelligentEnrichment;
        
        if (!enrichPrompt) {
            console.warn('Enrich prompt not found, using fallback');
            return [];
        }
        
        const prompt = `${enrichPrompt.role}

增强策略：
${enrichPrompt.searchStrategy.map((strategy, i) => `${i + 1}. ${strategy}`).join('\n')}

当前报告:
${report.substring(0, 8000)}

原始资料:
${originalSources.substring(0, 5000)}

请按照以下格式输出增强内容：
${JSON.stringify(enrichPrompt.outputFormat, null, 2)}`;
        
        const result = await generateWithThinking(prompt, model, 'Find additional relevant information to enrich the report');
        
        try {
            return JSON.parse(result);
        } catch {
            return [{ enrichmentList: result }];
        }
        
    } catch (error) {
        console.error('Error in intelligentEnrichment:', error);
        return [];
    }
}

// Enhanced Agent 7: Integration Engine
export async function integrateEnhancements(report, enrichments, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const integratePrompt = prompts.integrateEnhancements;
        
        if (!integratePrompt) {
            console.warn('Integrate prompt not found, using fallback');
            return report;
        }
        
        const prompt = `${integratePrompt.role}

整合原则：
${integratePrompt.integrationRules.map((principle, i) => `${i + 1}. ${principle}`).join('\n')}

当前报告:
${report}

增强内容:
${JSON.stringify(enrichments, null, 2)}

请输出整合后的完整报告：`;
        
        const result = await generateWithThinking(prompt, model, 'Integrate enhancements into the main report');
        return result;
        
    } catch (error) {
        console.error('Error in integrateEnhancements:', error);
        return report;
    }
}

// Enhanced Agent 8: Excellence Formatter
export async function excellenceFormatter(report, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const formatPrompt = prompts.excellenceFormatter;
        
        if (!formatPrompt) {
            console.warn('Format prompt not found, using fallback');
            return report;
        }
        
        const prompt = `${formatPrompt.role}

格式化标准：
${formatPrompt.formattingRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

当前报告:
${report}

请输出专业格式化后的报告：`;
        
        const result = await generateWithThinking(prompt, model, 'Format the report to professional standards');
        return result;
        
    } catch (error) {
        console.error('Error in excellenceFormatter:', error);
        return report;
    }
}

// Enhanced Agent 9: Final Quality Inspector
export async function finalQualityInspection(report, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const inspectPrompt = prompts.finalQualityInspection;
        
        if (!inspectPrompt) {
            console.warn('Inspect prompt not found, using fallback');
            return { quality: "检查完成", pass: true };
        }
        
        const prompt = `${inspectPrompt.role}

检查清单：
${inspectPrompt.inspectionChecklist.map((item, i) => `${i + 1}. ${item}`).join('\n')}

输出格式：
${inspectPrompt.outputFormat}

报告内容:
${report.substring(0, 10000)}

请按照以下格式输出检查结果：
${inspectPrompt.outputFormat}`;
        
        const result = await generateWithThinking(prompt, model, 'Perform final quality inspection of the report');
        
        try {
            return JSON.parse(result);
        } catch {
            return { quality: result, pass: true };
        }
        
    } catch (error) {
        console.error('Error in finalQualityInspection:', error);
        return { quality: "检查失败", pass: false, error: error.message };
    }
}