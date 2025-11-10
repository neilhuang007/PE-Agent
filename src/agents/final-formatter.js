// Final formatting agent to ensure enhanced reports are properly formatted and displayed
import { generateWithRetry, convertContentParts, generateWithFileSearch } from '../utils/gemini-wrapper.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.2.0/+esm';

// Load prompts from centralized JSON files
let formatterPrompts = null;

async function loadFormatterPrompts() {
    if (!formatterPrompts) {
        try {
            const response = await fetch('./prompts/formatter-prompts.json');
            formatterPrompts = await response.json();
        } catch (error) {
            console.error('Failed to load formatter prompts:', error);
            // Fallback to empty object if loading fails
            formatterPrompts = {};
        }
    }
    return formatterPrompts;
}

/**
 * Final formatter agent that ensures the enhanced report is professionally formatted
 * and ready for display with optimal readability and structure
 */
export async function finalReportFormatter(report, model, fileSearchStoreName = null) {
    if (!report || typeof report !== 'string') {
        console.error('❌ 无效的报告输入');
        return report;
    }

    const prompts = await loadFormatterPrompts();
    const promptConfig = prompts.reportFormatter;
    
    if (!promptConfig) {
        console.warn('Final formatter prompt not found, using fallback');
        return report;
    }
    
    const ragNotice = fileSearchStoreName
        ? '\n\n【RAG 提示】所有引用均可通过统一的 Google File API + File Search 存储验证，确保最终格式化保持事实准确。'
        : '';

    const prompt = `${promptConfig.userPrompt}${ragNotice}\n\nReport content to format:\n${report}`;

    // Log the full prompt to confirm all content is sent
    console.log('Formatter prompt (full):', prompt);

    try {
        const parts = convertContentParts([{ text: prompt }]);
        let formattedReport;
        if (fileSearchStoreName) {
            formattedReport = await generateWithFileSearch(parts, promptConfig.systemPrompt, fileSearchStoreName, -1, model);
        } else {
            formattedReport = await generateWithRetry(parts, promptConfig.systemPrompt, -1, model);
        }
        
        if (!formattedReport || typeof formattedReport !== 'string') {
            console.warn('⚠️ 最终格式化失败，返回原报告');
            return report;
        }

        console.log('✅ 最终格式化完成');
        return formattedReport;
        
    } catch (error) {
        console.error('最终格式化错误:', error);
        return report; // 返回原报告而不是失败
    }
}

/**
 * Quick formatter for fast mode - lighter formatting with focus on readability
 */
export async function quickFinalFormatter(report, model, fileSearchStoreName = null) {
    if (!report || typeof report !== 'string') {
        console.error('❌ 无效的报告输入');
        return report;
    }

    const prompts = await loadFormatterPrompts();
    const promptConfig = prompts.reportFormatter;
    
    if (!promptConfig) {
        console.warn('Quick formatter prompt not found, using fallback');
        return report;
    }
    
    const ragNotice = fileSearchStoreName
        ? '\n\n【RAG 提示】统一的 Google File API + File Search 存储可用于核验格式化输出。'
        : '';

    const prompt = `${promptConfig.userPrompt}${ragNotice}\n\nReport content to format:\n${report}`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        let result;
        if (fileSearchStoreName) {
            result = await generateWithFileSearch(parts, promptConfig.systemPrompt, fileSearchStoreName, -1, model);
        } else {
            result = await generateWithRetry(parts, promptConfig.systemPrompt, -1, model);
        }

        if (!result || typeof result !== 'string') {
            console.warn('⚠️ 快速格式化失败，返回原报告');
            return report;
        }

        console.log('✅ 快速格式化完成');
        return result;

    } catch (error) {
        console.error('快速格式化错误:', error);
        return report;
    }
}

/**
 * Calculate data completeness score based on report content
 */
function calculateDataCompletenessScore(report) {
    const criteria = {
        citations: { weight: 20, found: false, missing: [] },
        dataPoints: { weight: 20, found: false, missing: [] },
        financialMetrics: { weight: 15, found: false, missing: [] },
        dateReferences: { weight: 15, found: false, missing: [] },
        comparisons: { weight: 10, found: false, missing: [] },
        trends: { weight: 10, found: false, missing: [] },
        sources: { weight: 10, found: false, missing: [] }
    };

    // Check for citations (numbers in brackets or parentheses)
    const citationPattern = /[\[（\(]\d+[\]）\)]/g;
    const citations = report.match(citationPattern);
    if (citations && citations.length > 3) {
        criteria.citations.found = true;
    } else {
        criteria.citations.missing.push('引用数量不足（少于3个）');
    }

    // Check for data points (percentages, numbers with units)
    const dataPattern = /\d+\.?\d*\s*(%|百分比|个|家|万|亿|美元|元|年|月|日)/g;
    const dataPoints = report.match(dataPattern);
    if (dataPoints && dataPoints.length > 5) {
        criteria.dataPoints.found = true;
    } else {
        criteria.dataPoints.missing.push('具体数据点不足（少于5个）');
    }

    // Check for financial metrics
    const financialPattern = /(收入|利润|成本|费用|资产|负债|现金流|市值|估值|融资|投资|回报|ROI|ROE|毛利|净利|EBITDA)/g;
    const financialMetrics = report.match(financialPattern);
    if (financialMetrics && financialMetrics.length > 3) {
        criteria.financialMetrics.found = true;
    } else {
        criteria.financialMetrics.missing.push('财务指标提及不足');
    }

    // Check for date references
    const datePattern = /\d{4}年|\d{1,2}月|\d{1,2}日|本季度|上季度|本年|去年|今年|明年/g;
    const dateRefs = report.match(datePattern);
    if (dateRefs && dateRefs.length > 2) {
        criteria.dateReferences.found = true;
    } else {
        criteria.dateReferences.missing.push('时间参考不足');
    }

    // Check for comparisons
    const comparisonPattern = /(相比|比较|对比|增长|下降|提升|减少|超过|低于|高于|同比|环比)/g;
    const comparisons = report.match(comparisonPattern);
    if (comparisons && comparisons.length > 2) {
        criteria.comparisons.found = true;
    } else {
        criteria.comparisons.missing.push('缺少对比分析');
    }

    // Check for trends
    const trendPattern = /(趋势|发展|前景|预期|预测|展望|未来|计划|战略|目标)/g;
    const trends = report.match(trendPattern);
    if (trends && trends.length > 2) {
        criteria.trends.found = true;
    } else {
        criteria.trends.missing.push('趋势分析不足');
    }

    // Check for sources
    const sourcePattern = /(来源|数据来源|根据|据|资料|报告显示|研究表明|分析师|机构)/g;
    const sources = report.match(sourcePattern);
    if (sources && sources.length > 2) {
        criteria.sources.found = true;
    } else {
        criteria.sources.missing.push('信息来源标注不足');
    }

    // Calculate total score
    let totalScore = 0;
    let missingItems = [];
    
    for (const [key, criterion] of Object.entries(criteria)) {
        if (criterion.found) {
            totalScore += criterion.weight;
        } else {
            missingItems = missingItems.concat(criterion.missing);
        }
    }

    return {
        score: totalScore,
        missingItems: missingItems,
        criteria: criteria
    };
}

/**
 * Get color class based on score
 */
function getScoreColorClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
}

/**
 * HTML formatter to ensure proper display in the web interface
 */
export function formatForDisplay(report) {
    if (!report || typeof report !== 'string') {
        return '<div class="error">无效的报告内容</div>';
    }

    // Use marked library for Markdown to HTML conversion
    let htmlReport = marked.parse(report);
    // Highlight numbers and percentages
    htmlReport = htmlReport
        .replace(/(\d+(?:\.\d+)?%)/g, '<span class="number">$1</span>')
        .replace(/(\d+(?:,\d{3})*(?:\.\d+)?)/g, '<span class="number">$1</span>');

    // Calculate data completeness score
    const completenessData = calculateDataCompletenessScore(report);
    const scoreColorClass = getScoreColorClass(completenessData.score);
    
    // Create score section HTML
    const scoreSection = `
        <div class="data-completeness-section">
            <h3>数据完整性评分</h3>
            <div class="score-display">
                <span class="score-label">总分：</span>
                <span class="score-value ${scoreColorClass}">${completenessData.score}/100</span>
                <span class="score-description">${getScoreDescription(completenessData.score)}</span>
            </div>
            ${completenessData.missingItems.length > 0 ? `
                <div class="missing-items-section">
                    <h4>需要改进的项目：</h4>
                    <ul class="missing-items-list">
                        ${completenessData.missingItems.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            ` : '<div class="all-items-complete">✅ 所有数据完整性要求均已满足</div>'}
        </div>
    `;

    return `<div class="report-content">${htmlReport}</div>${scoreSection}`;
}

/**
 * Get score description based on score range
 */
function getScoreDescription(score) {
    if (score >= 90) return '优秀 - 报告数据非常完整';
    if (score >= 80) return '良好 - 报告数据较为完整';
    if (score >= 70) return '合格 - 报告基本满足要求';
    if (score >= 60) return '及格 - 报告需要补充部分数据';
    return '需改进 - 报告缺少重要数据元素';
}