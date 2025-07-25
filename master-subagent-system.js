// Master-SubAgent System - Quote-based targeted enhancement
import { generateWithRetry, convertContentParts } from './src/utils/gemini-wrapper.js';

// Retry configuration for handling API errors
const MAX_RETRIES = 3;
const INITIAL_DELAY = 2000; // 2 seconds
const BACKOFF_MULTIPLIER = 2;

// Helper function to sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for API calls
async function retryWithBackoff(apiCall, maxRetries = MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            
            // Check if it's a 503 overload error
            if (error.status === 503 || 
                error.code === 503 || 
                (error.message && error.message.includes('overloaded')) ||
                (error.message && error.message.includes('503'))) {
                
                const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt);
                console.log(`⚠️ Model overloaded (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            
            // Check for rate limit errors
            if (error.status === 429 || 
                error.code === 429 || 
                (error.message && error.message.includes('rate limit'))) {
                
                const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt) * 2; // Longer delay for rate limits
                console.log(`⚠️ Rate limit hit (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            
            // For other errors, throw immediately
            throw error;
        }
    }
    
    // If all retries failed, throw the last error
    console.error(`❌ All ${maxRetries} retry attempts failed`);
    throw lastError;
}

export async function identifyEnhancementTasks(report, model) {
    const prompt = `你是一位顶级的投资分析师和报告质量专家。请分析以下PE访谈报告，识别需要深度增强的具体内容片段。

报告内容：
${report}

任务：识别报告中信息不充分、需要专业深挖的具体引用片段，为每个片段设计专门的研究任务。

识别标准：
1. 财务数据缺乏细节或上下文
2. 竞争对手信息过于简略
3. 技术描述缺乏专业深度
4. 市场数据需要验证或补充
5. 商业模式细节不够清晰
6. 团队背景信息有限
7. 客户信息需要更多细节
8. 风险因素描述不充分

输出JSON格式：
{
  "enhancement_tasks": [
    {
      "task_id": "唯一任务ID",
      "research_task": "具体的研究任务描述",
      "original_quote": "需要增强的原始报告片段（完整引用）",
      "enhancement_focus": "增强重点（如补充财务细节、竞争对手数据等）",
      "expected_improvement": "期望的改进效果",
      "priority": "high/medium/low",
      "data_sources_needed": ["需要的数据来源类型"]
    }
  ],
  "overall_strategy": "整体增强策略",
  "total_tasks": "任务总数"
}

要求：
- 只选择真正能显著提升报告价值的片段
- 每个原始引用必须是报告中的完整、准确片段，从报告中逐字复制，保持所有标点符号和格式
- original_quote必须是可以在报告中找到的连续文本，不要跨段落引用
- 避免引用包含特殊格式（如编号、项目符号）的片段
- 研究任务要具体、可执行
- 优先选择对投资决策有直接影响的内容
- 每个引用片段长度在50-300字之间为宜`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        const text = await generateWithRetry(parts, '增强任务识别专家', -1);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        console.error('Error in enhancement tasks identification:', error);
        return null;
    }
}

export async function executeSubAgentTask(task, report, transcript, fileUris, model) {
    // Build content parts for the sub-agent
    const contentParts = [
        { text: `你是一位专业的子代理，专门研究 ${task.research_task}。

**你的具体任务：**
${task.research_task}

**增强重点：**
${task.enhancement_focus}

**期望改进：**
${task.expected_improvement}

**原始报告片段（需要增强）：**
"${task.original_quote}"

**完整报告上下文：**
${report.substring(0, 3000)}...

**访谈记录：**
${transcript}` }
    ];

    // Add uploaded files as context
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n**参考文档：**' });
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

    contentParts.push({ text: `

**你的任务：**
请在上述所有资料中寻找与原始片段相关的详细信息，然后生成一个增强版本来替换原始片段。

**增强要求：**
1. 保持原始片段的上下文和逻辑位置
2. 大幅增加信息密度和专业深度
3. 补充具体数据、数字、时间、人名等细节
4. 提供更深入的行业洞察和专业分析
5. 确保所有信息都有事实依据
6. 使用专业的投资分析语言

**输出格式：**
只输出增强后的文本内容，用于直接替换原始片段。不要包含任何其他说明或格式标记。

增强后的内容：` });

    try {
        const gParts = convertContentParts(contentParts);
        const resultText = await generateWithRetry(gParts, '增强执行专家', -1);
        return {
            task_id: task.task_id,
            original_quote: task.original_quote,
            enhanced_content: resultText.trim(),
            research_task: task.research_task,
            priority: task.priority
        };
    } catch (error) {
        console.error(`Error in sub-agent task execution for ${task.task_id}:`, error);
        return {
            task_id: task.task_id,
            original_quote: task.original_quote,
            enhanced_content: task.original_quote, // Fallback to original
            research_task: task.research_task,
            priority: task.priority,
            error: error.message
        };
    }
}

export async function replaceQuotesWithEnhancements(report, enhancementResults) {
    let enhancedReport = report;
    let replacementCount = 0;
    
    // Sort by priority (high first) and process replacements
    const sortedResults = enhancementResults.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const result of sortedResults) {
        if (result.enhanced_content && result.enhanced_content !== result.original_quote) {
            // Try exact match first
            if (enhancedReport.includes(result.original_quote)) {
                enhancedReport = enhancedReport.replace(result.original_quote, result.enhanced_content);
                replacementCount++;
                console.log(`✅ Enhanced quote for task: ${result.research_task}`);
            } else {
                // Try normalized matching (remove extra spaces, line breaks)
                const normalizedOriginal = result.original_quote.replace(/\s+/g, ' ').trim();
                const normalizedReport = enhancedReport.replace(/\s+/g, ' ');
                
                if (normalizedReport.includes(normalizedOriginal)) {
                    // Find the actual text in the report that matches the normalized version
                    const startIndex = normalizedReport.indexOf(normalizedOriginal);
                    let endIndex = startIndex;
                    let originalIndex = 0;
                    
                    // Map back to original report indices
                    for (let i = 0, j = 0; i < enhancedReport.length && j <= startIndex + normalizedOriginal.length; i++) {
                        if (enhancedReport[i].match(/\s/) && normalizedReport[j] === ' ') {
                            // Skip multiple whitespaces
                            while (i + 1 < enhancedReport.length && enhancedReport[i + 1].match(/\s/)) {
                                i++;
                            }
                            j++;
                        } else if (!enhancedReport[i].match(/\s/)) {
                            j++;
                        }
                        
                        if (j === startIndex && originalIndex === 0) {
                            originalIndex = i;
                        }
                        if (j === startIndex + normalizedOriginal.length) {
                            endIndex = i + 1;
                            break;
                        }
                    }
                    
                    if (originalIndex > 0 && endIndex > originalIndex) {
                        const actualQuote = enhancedReport.substring(originalIndex, endIndex);
                        enhancedReport = enhancedReport.replace(actualQuote, result.enhanced_content);
                        replacementCount++;
                        console.log(`✅ Enhanced quote (normalized match) for task: ${result.research_task}`);
                    } else {
                        console.log(`⚠️ Quote not found even with normalization for task: ${result.research_task}`);
                    }
                } else {
                    console.log(`⚠️ Quote not found for task: ${result.research_task}`);
                    console.log(`   Looking for: "${result.original_quote.substring(0, 50)}..."`);
                }
            }
        }
    }

    console.log(`📊 Total replacements made: ${replacementCount}/${sortedResults.length}`);
    return enhancedReport;
}

export async function orchestrateMasterSubAgentSystem(report, transcript, fileUris, model, visualizationCallback = null) {
    console.log('🎯 启动主-子代理增强系统...');

    // Safety check for input report
    if (!report || typeof report !== 'string') {
        console.error('❌ 输入报告无效，跳过增强系统');
        return report || '报告生成失败';
    }

    // Step 1: Master agent identifies enhancement tasks
    console.log('🔍 主代理分析报告，识别增强任务...');
    const enhancementTasks = await identifyEnhancementTasks(report, model);

    if (!enhancementTasks || !enhancementTasks.enhancement_tasks) {
        console.log('❌ 未识别到需要增强的任务，返回原始报告');
        return report;
    }

    console.log('=== MASTER AGENT ANALYSIS ===');
    console.log(`Overall strategy: ${enhancementTasks.overall_strategy}`);
    console.log(`Total tasks identified: ${enhancementTasks.total_tasks}`);
    console.log('Enhancement tasks:');
    enhancementTasks.enhancement_tasks.forEach((task, i) => {
        console.log(`${i + 1}. [${task.priority.toUpperCase()}] ${task.research_task}`);
        console.log(`   Quote: "${task.original_quote.substring(0, 100)}..."`);
        console.log(`   Focus: ${task.enhancement_focus}`);
    });
    console.log('=== END MASTER ANALYSIS ===\n');

    // Send tasks to visualization callback if provided
    if (visualizationCallback) {
        visualizationCallback('tasks', enhancementTasks);
    }

    // Step 2: Filter high-priority tasks
    const highPriorityTasks = enhancementTasks.enhancement_tasks.filter(
        task => task.priority === 'high'
    );

    if (highPriorityTasks.length === 0) {
        console.log('💡 未发现高优先级增强任务，返回原始报告');
        return report;
    }

    console.log(`🔬 执行 ${highPriorityTasks.length} 个高优先级子代理任务...`);

    // Step 3: Execute sub-agents in parallel
    const subAgentPromises = highPriorityTasks.map(task => 
        executeSubAgentTask(task, report, transcript, fileUris, model)
    );

    const enhancementResults = await Promise.all(subAgentPromises);

    console.log('=== SUB-AGENT RESULTS ===');
    enhancementResults.forEach(result => {
        console.log(`\n--- Task: ${result.research_task} ---`);
        console.log(`Original (${result.original_quote.length} chars): "${result.original_quote.substring(0, 100)}..."`);
        console.log(`Enhanced (${result.enhanced_content.length} chars): "${result.enhanced_content.substring(0, 100)}..."`);
        const improvement = result.enhanced_content.length - result.original_quote.length;
        console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement} characters`);
        if (result.error) {
            console.log(`Error: ${result.error}`);
        }
    });
    console.log('=== END SUB-AGENT RESULTS ===\n');

    // Send enhancement results to visualization callback if provided
    if (visualizationCallback) {
        visualizationCallback('enhancements', enhancementResults);
    }

    // Step 4: Replace quotes with enhanced content
    console.log('🔄 替换原始片段为增强内容...');
    const enhancedReport = await replaceQuotesWithEnhancements(report, enhancementResults);

    const originalLength = report.length;
    const enhancedLength = enhancedReport.length;
    const improvementPercentage = ((enhancedLength - originalLength) / originalLength * 100).toFixed(1);

    // Final safety check
    if (!enhancedReport || typeof enhancedReport !== 'string') {
        console.error('❌ 增强后的报告无效，返回原始报告');
        return report;
    }

    console.log(`✅ 报告增强完成！`);
    console.log(`原始长度: ${originalLength} 字符`);
    console.log(`增强长度: ${enhancedLength} 字符`);
    console.log(`改进幅度: ${improvementPercentage}%`);

    return enhancedReport;
}