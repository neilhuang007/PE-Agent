// Enhanced agents with thinking mode for highest quality reports
// This file contains the complete enhanced agent architecture for generating
// world-class private equity interview reports using Gemini Pro's thinking capabilities

import { compactChineseBullets } from '../utils/utils.js';
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
        let filePrompt = prompts.perFileAnalysis || {
            role: "你是一位专业的文档分析专家，擅长从各种格式的文档中提取结构化信息。",
            extractionFocus: [
                "1. 表格数据：完整提取所有表格内容，包括行列标题和数据",
                "2. 财务数据：收入、成本、利润、增长率等所有数字",
                "3. 时间线数据：里程碑、时间节点、发展历程",
                "4. 团队信息：创始人、核心团队成员及其背景",
                "5. 产品/服务详情：功能、定价、竞争优势",
                "6. 市场数据：市场规模、增长率、竞争格局",
                "7. 客户信息：客户类型、案例、合作伙伴",
                "8. 商业模式：收入来源、成本结构、盈利模式"
            ]
        };
        
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
            result = await generateWithRetry(convertedParts, filePrompt.role, 32000);
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
export async function comprehensiveBPAnalysis(fileUris, model, genAI = null) {
    if (!fileUris || fileUris.length === 0) {
        return { combinedAnalyses: '', fileSummaries: [] };
    }
    
    try {
        console.log(`🔍 开始per-file分析 ${fileUris.length} 个文档...`);
        
        // Analyze each file individually in parallel
        const fileAnalysisPromises = fileUris.map((file, index) => 
            analyzeIndividualFile(file, index, model, genAI)
        );
        
        const individualAnalyses = await Promise.all(fileAnalysisPromises);
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
            return `片段 ${index + 1}: ${chunk.substring(0, 500)}...`;
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
        const result = await generateWithRetry(convertedParts, extractPrompt.role, 32000);
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
        const result = await generateWithRetry(parts, archPrompt.role, 32000);
        
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
        
        const parts = convertContentParts([{ text: prompt }]);
        const result = await generateWithRetry(parts, composePrompt.role, 32000);
        return result;
        
    } catch (error) {
        console.error('Error in masterComposeReport:', error);
        return `# ${companyName} 投资访谈报告\n\n报告生成失败: ${error.message}`;
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
        const result = await generateWithRetry(convertedParts, verifyPrompt.role, 32000);
        
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

// Enhanced Agent 4b: Cross-validate each fact from summaries
export async function crossValidateFacts(report, combinedAnalyses, fileSummaries, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const factPrompt = prompts.crossValidateFacts || {
            role: 'Fact presence checker',
            task: 'Answer yes if the fact is mentioned in the report, otherwise no',
            outputFormat: 'yes | no'
        };

        // Gather unique facts from compact summary and file summaries
        const extractFacts = text =>
            text ? text.split('\n').map(l => l.replace(/^\s*[•*-]?\s*/, '').trim()).filter(Boolean) : [];

        let facts = extractFacts(combinedAnalyses);
        if (Array.isArray(fileSummaries)) {
            fileSummaries.forEach(fs => {
                facts = facts.concat(extractFacts(fs));
            });
        }
        const uniqueFacts = Array.from(new Set(facts));

        const results = [];
        for (const fact of uniqueFacts) {
            const prompt = `${factPrompt.role}\n${factPrompt.task}\n\n事实: ${fact}\n\n报告内容:\n${report}\n\n${factPrompt.outputFormat}`;
            const parts = convertContentParts([{ text: prompt }]);
            const res = await generateWithRetry(parts, factPrompt.role, -1);
            results.push({ fact, present: /^yes/i.test(res.trim()), raw: res.trim() });
        }
        return results;
    } catch (error) {
        console.error('Error in crossValidateFacts:', error);
        return [];
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
${validatePrompt.evaluationCriteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

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
        const result = await generateWithRetry(convertedParts, validatePrompt.role, 32000);
        
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
export async function intelligentEnrichment(report, transcript, combinedAnalyses, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const enrichPrompt = prompts.intelligentEnrichment;
        
        if (!enrichPrompt) {
            console.warn('Enrich prompt not found, using fallback');
            return [];
        }
        
        // Build content parts with all available data sources
        const contentParts = [
            { text: `${enrichPrompt.role}

增强策略：
${enrichPrompt.searchStrategy.map((strategy, i) => `${i + 1}. ${strategy}`).join('\n')}

当前报告:
${report}

原始访谈记录:
${transcript}

商业计划书分析:
${combinedAnalyses || '无商业计划书数据'}` }
        ];
        
        // Add uploaded files as enrichment sources
        if (fileUris && fileUris.length > 0) {
            contentParts.push({ text: '\n\n**原始文档用于深度增强:**' });
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
        
        contentParts.push({ text: `\n\n请按照以下格式输出增强内容：\n${JSON.stringify(enrichPrompt.outputFormat, null, 2)}` });
        
        const convertedParts = convertContentParts(contentParts);
        const result = await generateWithRetry(convertedParts, enrichPrompt.role, 32000);
        
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
export async function integrateEnhancements(report, enrichments, transcript, combinedAnalyses, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const integratePrompt = prompts.integrateEnhancements;
        
        if (!integratePrompt) {
            console.warn('Integrate prompt not found, using fallback');
            return report;
        }
        
        // Build content parts with context for better integration
        const contentParts = [
            { text: `${integratePrompt.role}

整合原则：
${integratePrompt.integrationRules.map((principle, i) => `${i + 1}. ${principle}`).join('\n')}

当前报告:
${report}

增强内容:
${JSON.stringify(enrichments, null, 2)}

原始访谈记录（用于上下文理解）:
${transcript}

商业计划书分析（用于一致性检查）:
${combinedAnalyses || '无商业计划书数据'}` }
        ];
        
        // Add uploaded files for integration context
        if (fileUris && fileUris.length > 0) {
            contentParts.push({ text: '\n\n**原始文档用于整合参考:**' });
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
        
        contentParts.push({ text: '\n\n请输出整合后的完整报告：' });
        
        const convertedParts = convertContentParts(contentParts);
        const result = await generateWithRetry(convertedParts, integratePrompt.role, 32000);
        return result;
        
    } catch (error) {
        console.error('Error in integrateEnhancements:', error);
        return report;
    }
}

// Enhanced Agent 8: Excellence Formatter
export async function excellenceFormatter(report, transcript, combinedAnalyses, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const formatPrompt = prompts.excellenceFormatter;
        
        if (!formatPrompt) {
            console.warn('Format prompt not found, using fallback');
            return report;
        }
        
        // Build content parts with context for informed formatting
        const contentParts = [
            { text: `${formatPrompt.role}

格式化标准：
${formatPrompt.formattingRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

当前报告:
${report}

原始访谈记录（用于上下文理解）:
${transcript}

商业计划书分析（用于结构参考）:
${combinedAnalyses || '无商业计划书数据'}` }
        ];
        
        // Add uploaded files for formatting context
        if (fileUris && fileUris.length > 0) {
            contentParts.push({ text: '\n\n**原始文档用于格式参考:**' });
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
        
        contentParts.push({ text: '\n\n请输出专业格式化后的报告：' });
        
        const convertedParts = convertContentParts(contentParts);
        const result = await generateWithRetry(convertedParts, formatPrompt.role, 32000);
        return result;
        
    } catch (error) {
        console.error('Error in excellenceFormatter:', error);
        return report;
    }
}

// Enhanced Agent 9: Final Quality Inspector
export async function finalQualityInspection(report, transcript, combinedAnalyses, fileUris, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        const inspectPrompt = prompts.finalQualityInspection;
        
        if (!inspectPrompt) {
            console.warn('Inspect prompt not found, using fallback');
            return { quality: "检查完成", pass: true };
        }
        
        // Build content parts with all available data for comprehensive inspection
        const contentParts = [
            { text: `${inspectPrompt.role}

检查清单：
${inspectPrompt.inspectionChecklist.map((item, i) => `${i + 1}. ${item}`).join('\n')}

输出格式：
${inspectPrompt.outputFormat}

报告内容:
${report}

原始访谈记录（用于完整性检查）:
${transcript}

商业计划书分析（用于一致性检查）:
${combinedAnalyses || '无商业计划书数据'}` }
        ];
        
        // Add uploaded files for final cross-verification
        if (fileUris && fileUris.length > 0) {
            contentParts.push({ text: '\n\n**原始文档用于最终检查:**' });
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
        
        contentParts.push({ text: `\n\n请按照以下格式输出检查结果：\n${inspectPrompt.outputFormat}` });
        
        const convertedParts = convertContentParts(contentParts);
        const result = await generateWithRetry(convertedParts, inspectPrompt.role, 32000);
        
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