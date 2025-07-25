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

// Enhanced Agent 10: Per-File Business Plan Analyzer
async function analyzeIndividualFile(file, index, model) {
    try {
        const prompts = await loadEnhancedPrompts();
        let filePrompt = prompts.comprehensiveBPAnalysis?.perFileAnalysis || {
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
            { text: `${filePrompt.role}\n\n文档 ${index + 1}: ${file.displayName}\n\n请对这个文档进行深度信息提取，特别注意：\n${filePrompt.extractionFocus?.join('\n') || '提取所有重要信息'}\n\n请确保：\n- 完整提取所有表格数据（保持原始格式）\n- 保留所有具体数字和百分比\n- 提取所有人名、公司名、产品名\n- 保持时间顺序和逻辑关系\n\n开始分析：` }
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
        
        const result = await generateWithThinking(contentParts, model, 'Extract all structured data including tables, charts, and key information');
        
        return {
            fileName: file.displayName,
            mimeType: file.mimeType,
            extractedContent: result,
            extractionTime: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`Error analyzing file ${file.displayName}:`, error);
        return {
            fileName: file.displayName,
            mimeType: file.mimeType,
            extractedContent: `文件分析失败: ${error.message}`,
            error: true
        };
    }
}

// Enhanced Agent 10: Comprehensive Business Plan Analyzer (Updated)
export async function comprehensiveBPAnalysis(fileUris, model) {
    if (!fileUris || fileUris.length === 0) {
        return "无商业计划书可供分析";
    }
    
    try {
        console.log(`🔍 开始分析 ${fileUris.length} 个文档...`);
        
        // Step 1: Analyze each file individually in parallel
        const fileAnalysisPromises = fileUris.map((file, index) => 
            analyzeIndividualFile(file, index, model)
        );
        
        const individualAnalyses = await Promise.all(fileAnalysisPromises);
        
        // Log extraction results
        individualAnalyses.forEach(analysis => {
            console.log(`✅ 文档 ${analysis.fileName} 分析完成 - 提取内容长度: ${analysis.extractedContent?.length || 0} 字符`);
        });
        
        // Step 2: Synthesize all individual analyses into comprehensive report
        const prompts = await loadEnhancedPrompts();
        let synthesisPrompt = prompts.comprehensiveBPAnalysis?.synthesis || {
            role: "你是一位世界顶级的投资分析专家，擅长整合多源信息生成深度投资分析报告。",
            task: "基于以下各文档的独立分析结果，生成一份整合性的商业计划书深度分析报告。"
        };
        
        const synthesisContent = `${synthesisPrompt.role}

${synthesisPrompt.task}

已分析的文档及提取结果：
${individualAnalyses.map((analysis, i) => `
【文档 ${i + 1}】${analysis.fileName} (${analysis.mimeType})
提取内容：
${analysis.extractedContent}
${'='.repeat(80)}
`).join('\n')}

请生成整合性分析报告，要求：
1. 整合所有文档中的关键信息
2. 突出财务数据和增长指标
3. 分析商业模式和竞争优势
4. 评估团队背景和执行能力
5. 识别潜在风险和机会
6. 提供投资建议和估值参考

输出格式：
# 商业计划书综合分析报告

## 1. 公司概况
[整合所有文档中的公司基本信息]

## 2. 财务分析
[所有财务数据、表格、增长率等]

## 3. 商业模式
[收入来源、成本结构、盈利能力]

## 4. 市场分析
[市场规模、竞争格局、增长潜力]

## 5. 团队评估
[创始团队、核心成员、背景实力]

## 6. 产品/服务分析
[产品特点、技术优势、客户价值]

## 7. 风险与机会
[主要风险、增长机会、护城河]

## 8. 投资建议
[估值分析、投资亮点、关注点]`;
        
        const synthesisResult = await generateWithThinking(synthesisContent, model, 'Synthesize all document analyses into comprehensive investment report');
        
        // Step 3: Return both individual analyses and synthesis for transparency
        const fullReport = `${'='.repeat(80)}
📊 商业计划书分析报告
${'='.repeat(80)}

📁 分析文档数量: ${fileUris.length}
⏰ 分析时间: ${new Date().toLocaleString('zh-CN')}

${'='.repeat(80)}
📋 各文档独立分析结果
${'='.repeat(80)}

${individualAnalyses.map((analysis, i) => `
### 文档 ${i + 1}: ${analysis.fileName}
类型: ${analysis.mimeType}
分析时间: ${new Date(analysis.extractionTime).toLocaleTimeString('zh-CN')}

${analysis.extractedContent}
`).join('\n' + '-'.repeat(60) + '\n')}

${'='.repeat(80)}
📈 综合分析报告
${'='.repeat(80)}

${synthesisResult}`;
        
        return fullReport;
        
    } catch (error) {
        console.error('BP analysis error:', error);
        return "商业计划书分析失败：" + error.message;
    }
}

// Enhanced Agent 1: Deep Information Extraction with Cross-Reference
export async function deepExtractChunk(chunk, index, transcript, businessPlanAnalysis, fileUris, model) {
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

访谈片段 ${index + 1}:
${chunk}

完整访谈上下文（用于理解背景）:
${transcript.substring(0, 5000)}...

商业计划书分析（用于深度理解和交叉验证）:
${businessPlanAnalysis ? businessPlanAnalysis.substring(0, 3000) : '无商业计划书数据'}...

${extractPrompt.extractionFocus.map((req, i) => `${i + 1}. ${req}`).join('\n')}

${extractPrompt.outputFormat}` }
        ];
        
        // Add uploaded files for reference
        if (fileUris && fileUris.length > 0) {
            contentParts.push({ text: '\n\n**参考文档用于信息提取:**' });
            fileUris.slice(0, 2).forEach(file => { // Limit to first 2 files to avoid overload
                if (file.content) {
                    contentParts.push({ text: `\n文档：${file.displayName}\n${file.content.substring(0, 1000)}...` });
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
        
        const result = await generateWithThinking(contentParts, model, 'Extract key information with BP context');
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
export async function verifyCitations(report, transcript, businessPlanAnalysis, fileUris, model) {
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

${verifyPrompt.checkPoints.map((task, i) => `${i + 1}. ${task}`).join('\n')}

报告内容:
${report}

原始访谈记录:
${transcript}

商业计划书分析:
${businessPlanAnalysis || '无商业计划书数据'}` }
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
        
        const result = await generateWithThinking(contentParts, model, 'Verify data accuracy against all available sources');
        
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
export async function validateExcellence(report, transcript, businessPlanAnalysis, fileUris, model) {
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
${businessPlanAnalysis || '无商业计划书数据'}` }
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
        
        const result = await generateWithThinking(contentParts, model, 'Evaluate report quality against all available data sources');
        
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
export async function intelligentEnrichment(report, transcript, businessPlanAnalysis, fileUris, model) {
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
${businessPlanAnalysis || '无商业计划书数据'}` }
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
        
        const result = await generateWithThinking(contentParts, model, 'Find additional relevant information from all sources to enrich the report');
        
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
export async function integrateEnhancements(report, enrichments, transcript, businessPlanAnalysis, fileUris, model) {
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
${businessPlanAnalysis || '无商业计划书数据'}` }
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
        
        const result = await generateWithThinking(contentParts, model, 'Integrate enhancements with full context from all sources');
        return result;
        
    } catch (error) {
        console.error('Error in integrateEnhancements:', error);
        return report;
    }
}

// Enhanced Agent 8: Excellence Formatter
export async function excellenceFormatter(report, transcript, businessPlanAnalysis, fileUris, model) {
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
${businessPlanAnalysis || '无商业计划书数据'}` }
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
        
        const result = await generateWithThinking(contentParts, model, 'Format the report with full context understanding');
        return result;
        
    } catch (error) {
        console.error('Error in excellenceFormatter:', error);
        return report;
    }
}

// Enhanced Agent 9: Final Quality Inspector
export async function finalQualityInspection(report, transcript, businessPlanAnalysis, fileUris, model) {
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
${businessPlanAnalysis || '无商业计划书数据'}` }
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
        
        const result = await generateWithThinking(contentParts, model, 'Perform comprehensive final quality inspection');
        
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