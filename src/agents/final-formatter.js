// Final formatting agent to ensure enhanced reports are properly formatted and displayed
import { generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

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
export async function finalReportFormatter(report, model) {
    if (!report || typeof report !== 'string') {
        console.error('❌ 无效的报告输入');
        return report;
    }

    const prompts = await loadFormatterPrompts();
    const promptConfig = prompts.finalReportFormatter;
    
    if (!promptConfig) {
        console.warn('Final formatter prompt not found, using fallback');
        return report;
    }
    
    const formattingReqs = Object.entries(promptConfig.formattingRequirements)
        .map(([key, section], index) => 
            `${index + 1}. **${section.title}**：\n   ${section.requirements.map(req => `- ${req}`).join('\n   ')}`
        ).join('\n\n');
    
    const prompt = `${promptConfig.role}\n\n${promptConfig.task}\n\n${formattingReqs}\n\n要求：\n${promptConfig.generalRequirements.map(req => `- ${req}`).join('\n')}\n\n报告内容：\n${report}\n\n${promptConfig.outputFormat}`;

    try {
        const thinkingConfig = prompts.formatterThinking;
        
        const thinkingSteps = Object.entries(thinkingConfig.thinkingSteps)
            .map(([key, step], index) => 
                `${index + 1}. **${step.title}**：\n   ${step.tasks.map(task => `- ${task}`).join('\n   ')}`
            ).join('\n\n');
        
        const thinkingPrompt = `## ${thinkingConfig.title}\n\n${thinkingConfig.role}\n\n${thinkingSteps}`;

        const parts = convertContentParts([{ text: prompt }]);
        const formattedReport = await generateWithRetry(parts, '顶级报告格式化专家', 32000);
        
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
export async function quickFinalFormatter(report, model) {
    if (!report || typeof report !== 'string') {
        console.error('❌ 无效的报告输入');
        return report;
    }

    const prompts = await loadFormatterPrompts();
    const promptConfig = prompts.quickFinalFormatter;
    
    if (!promptConfig) {
        console.warn('Quick formatter prompt not found, using fallback');
        return report;
    }
    
    const prompt = `${promptConfig.role}\n\n重点关注：\n${promptConfig.focusAreas.map((area, i) => `${i + 1}. ${area}`).join('\n')}\n\n保持：\n${promptConfig.preserveRequirements.map(req => `- ${req}`).join('\n')}\n\n报告内容：\n${report}\n\n${promptConfig.outputFormat}`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        const result = await generateWithRetry(parts, '专业报告格式化专家', -1);
        
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
 * HTML formatter to ensure proper display in the web interface
 */
export function formatForDisplay(report) {
    if (!report || typeof report !== 'string') {
        return '<div class="error">无效的报告内容</div>';
    }

    // Convert markdown-style formatting to HTML
    let htmlReport = report
        // Headers
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
        .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
        
        // Bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        
        // Wrap in paragraphs
        .replace(/^(.)/gm, '<p>$1')
        .replace(/(.*)<\/p>/gm, '$1</p>')
        
        // Clean up empty paragraphs
        .replace(/<p><\/p>/g, '')
        .replace(/<p><br>/g, '<p>')
        
        // Handle lists
        .replace(/^[•·-] (.*)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        
        // Numbers and percentages styling
        .replace(/(\d+(?:\.\d+)?%)/g, '<span class="number">$1</span>')
        .replace(/(\d+(?:,\d{3})*(?:\.\d+)?)/g, '<span class="number">$1</span>');

    return `<div class="report-content">${htmlReport}</div>`;
}