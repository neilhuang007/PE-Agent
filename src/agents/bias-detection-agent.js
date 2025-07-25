// Bias Detection Agent - Identifies and removes subjective language and AI interpretations
import { generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

export async function detectAndRemoveBias(report, model) {
    const prompt = `你是一位严格的事实核查专家。通过专业、精确的方式，提供具有深度洞察的行业和企业分析报告。

请识别并修正以下报告中的主观判断、AI分析和偏向性语言。

报告内容：
${report}

任务：
1. 识别所有主观性描述（如"可能"、"倾向于"、"似乎"、"体现了"等推测性语言）
2. 移除AI分析和解读（如对企业文化的主观评价）
3. 保留客观事实和具体数据
4. 确保所有陈述都有明确的事实依据
5. 移除结论性评价和总结

需要移除的典型偏向性表达：
- "可能倡导一种..."
- "体现了..."
- "显示出..."
- "反映了..."
- "说明..."
- "表明其..."
- 任何对企业文化、战略意图的推测

输出修正后的客观报告，只保留可验证的事实和具体数据。`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        return await generateWithRetry(parts, '事实核查专家', -1);
    } catch (error) {
        console.error('Error in bias detection:', error);
        return report; // Return original if bias detection fails
    }
}

export async function extractFactsOnly(content, model) {
    const prompt = `通过专业、精确的方式，提供具有深度洞察的行业和企业分析报告。

从以下内容中只提取客观事实和具体数据，移除所有推测、分析和主观判断：

内容：
${content}

要求：
1. 只保留可验证的事实：数字、日期、地点、人名、公司名、具体事件
2. 移除所有"可能"、"似乎"、"体现"、"反映"等推测性语言
3. 移除对动机、文化、战略的主观解读
4. 保持原有的具体信息完整性

输出格式：
【客观事实】
- 事实1（具体数据/日期/地点等）
- 事实2（具体数据/日期/地点等）
...`;

    try {
        const parts = convertContentParts([{ text: prompt }]);
        return await generateWithRetry(parts, '事实提取助手', -1);
    } catch (error) {
        console.error('Error in facts extraction:', error);
        return content;
    }
}