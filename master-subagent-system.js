// Master-SubAgent System - Quote-based targeted enhancement
import {generateWithRetry, convertContentParts} from './src/utils/gemini-wrapper.js';

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
    const prompt = `Find specific text segments requiring research enhancement.

CRITICAL: Extract exact quotes from the report - character-for-character precision required for text substitution.

IDENTIFICATION TARGETS:

    Financial claims without specific numbers or percentages

    Vague competitor references without details

    Generic technology descriptions lacking depth

    Unsubstantiated market size claims

    Unclear business model mechanics

    Generic team descriptions without credentials

    Customer statements without specifics

QUOTE EXTRACTION RULES:

    Copy text exactly as written - preserve all punctuation, capitalization, quotes

    Select single sentences only - never combine separate statements

    Choose shortest segment that captures the gap (50-150 characters ideal)

    Scan systematically through entire report - miss nothing

    Test: your quote must be findable with Ctrl+F in original text

TASK FOCUS:

    Target gaps affecting valuation accuracy and competitive assessment

    Prioritize quantifiable data gaps over qualitative ones

    Limit to 8 most critical gaps maximum

OUTPUT JSON:
{
"enhancement_tasks": [
{
"task_id": "unique_id",
"research_task": "specific data/analysis needed",
"original_quote": "exact text from report",
"enhancement_focus": "data type needed",
"expected_improvement": "investment decision impact",
"priority": "high/medium/low",
"data_sources_needed": ["source types"]
}
],
"overall_strategy": "research approach summary",
"total_tasks": "number"
}

REPORT CONTENT:
${report}
`;

    try {
        const parts = convertContentParts([{text: prompt}]);
        const text = await generateWithRetry(parts, 'You are an investment analyst identifying data gaps in PE interview reports.', -1);
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
        {
            text: `You are a data research specialist. Your task is to find specific factual information to enhance the following report segment.

**RESEARCH TASK:**
${task.research_task}

**ENHANCEMENT FOCUS:**
${task.enhancement_focus}

**EXPECTED IMPROVEMENT:**
${task.expected_improvement}

**ORIGINAL REPORT SEGMENT (to be enhanced):**
"${task.original_quote}"

**FULL REPORT CONTEXT:**
${report}

**INTERVIEW TRANSCRIPT:**
${transcript}`
        }
    ];

// Add uploaded files as context
    if (fileUris && fileUris.length > 0) {
        contentParts.push({text: '\n\n**REFERENCE DOCUMENTS:**'});
        fileUris.forEach(file => {
            if (file.content) {
                // For local TXT files
                contentParts.push({text: `\nDocument: ${file.displayName}\n${file.content}`});
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

    contentParts.push({
        text: `

**YOUR TASK:**
Search all provided materials above for factual data that can replace or enhance the original segment.

**ENHANCEMENT RULES:**
1. ONLY add factual data found in the provided materials (numbers, dates, names, specific details)
2. If NO additional data is found, return the original quote exactly as written
3. For vague terms, add factual explanations or definitions found in materials
4. NEVER add personal opinions, judgments, or analysis
5. NEVER add information not present in the provided sources
6. Maintain the same sentence structure and context as the original
7. Replace vague language with specific data when available

**FORBIDDEN:**
- Personal assessments ("strong," "impressive," "concerning")
- Interpretations or conclusions
- External knowledge not in provided materials
- Speculative language

**OUTPUT FORMAT:**
Return only the enhanced text segment for direct substitution. If no enhancement data is found, return the original quote unchanged.

Enhanced segment:`
    });


    try {
        const gParts = convertContentParts(contentParts);
        const resultText = await generateWithRetry(gParts, 'You are a data research specialist.', -1);
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
        const priorityOrder = {high: 3, medium: 2, low: 1};
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