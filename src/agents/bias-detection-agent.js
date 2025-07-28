// Bias Detection Agent - Identifies and removes subjective language and AI interpretations
import { generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

// Load prompts from centralized JSON files
let biasDetectionPrompts = null;

async function loadBiasDetectionPrompts() {
    if (!biasDetectionPrompts) {
        try {
            const response = await fetch('./prompts/bias-detection-prompts.json');
            biasDetectionPrompts = await response.json();
        } catch (error) {
            console.error('Failed to load bias detection prompts:', error);
            // Fallback to empty object if loading fails
            biasDetectionPrompts = {};
        }
    }
    return biasDetectionPrompts;
}

export async function detectAndRemoveBias(report, model) {
    const prompts = await loadBiasDetectionPrompts();
    const promptConfig = prompts.detectAndRemoveBias;
    
    if (!promptConfig) {
        console.warn('Bias detection prompt not found, using fallback');
        // Simple fallback processing
        return report;
    }
    
    const prompt = `${promptConfig.role}

${promptConfig.task}

报告内容：
${report}

任务：
${promptConfig.taskDetails.map((task, i) => `${i + 1}. ${task}`).join('\n')}

需要移除的典型偏向性表达：
${promptConfig.biasExpressions.map(expr => `- ${expr}`).join('\n')}

${promptConfig.outputFormat}`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        return await generateWithRetry(parts, '事实核查专家', -1);
    } catch (error) {
        console.error('Error in bias detection:', error);
        return report; // Return original if bias detection fails
    }
}

export async function extractFactsOnly(content, model) {
    const prompts = await loadBiasDetectionPrompts();
    const promptConfig = prompts.extractFactsOnly;
    
    if (!promptConfig) {
        console.warn('Facts extraction prompt not found, using fallback');
        return content;
    }
    
    const prompt = `${promptConfig.role}

${promptConfig.task}

内容：
${content}

要求：
${promptConfig.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

输出格式：
${promptConfig.outputFormat}`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        return await generateWithRetry(parts, '事实提取助手', -1);
    } catch (error) {
        console.error('Error in facts extraction:', error);
        return content;
    }
}