// Bias Detection Agent - Identifies and removes subjective language and AI interpretations
import { generateWithRetry, convertContentParts, generateWithFileSearch } from '../utils/gemini-wrapper.js';

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

export async function detectAndRemoveBias(report, model, fileSearchStoreName = null) {
    const prompts = await loadBiasDetectionPrompts();
    const promptConfig = prompts.detectAndRemoveBias;
    
    if (!promptConfig) {
        console.warn('Bias detection prompt not found, using fallback');
        // Simple fallback processing
        return report;
    }
    
    const ragNotice = fileSearchStoreName
        ? '\n\nRAG 已启用：请使用统一的 Google File API + File Search 文档上下文验证并消除主观偏见。'
        : '';

    const prompt = `${promptConfig.role}

${promptConfig.task}



task：
${promptConfig.taskDetails.map((task, i) => `${i + 1}. ${task}`).join('\n')}

remove these biases：
${promptConfig.biasExpressions.map(expr => `- ${expr}`).join('\n')}

${promptConfig.outputFormat}

report content：
${report}

${ragNotice}

`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        if (fileSearchStoreName) {
            return await generateWithFileSearch(parts, '事实核查专家', fileSearchStoreName, -1, model);
        }
        return await generateWithRetry(parts, '事实核查专家', -1, model);
    } catch (error) {
        console.error('Error in bias detection:', error);
        return report; // Return original if bias detection fails
    }
}