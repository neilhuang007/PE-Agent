// Final formatting agent to ensure enhanced reports are properly formatted and displayed
import { generateWithRetry, convertContentParts } from '../utils/gemini-wrapper.js';

/**
 * Final formatter agent that ensures the enhanced report is professionally formatted
 * and ready for display with optimal readability and structure
 */
export async function finalReportFormatter(report, model) {
    if (!report || typeof report !== 'string') {
        console.error('❌ 无效的报告输入');
        return report;
    }

    const prompt = `你是一位顶级的专业报告格式化专家，专门为私募股权机构制作最终的投资报告。

请对以下报告进行最终的专业格式化，确保：

1. **结构优化**：
   - 清晰的多级标题体系（### #### 等）
   - 逻辑清晰的段落结构
   - 合理的信息层次

2. **内容呈现**：
   - 重要数据用**粗体**突出
   - 关键发现用列表或要点形式
   - 数字和百分比格式统一
   - 专业术语准确使用

3. **可读性优化**：
   - 段落长度适中（避免过长段落）
   - 适当的空行分隔
   - 重要信息的视觉突出
   - 流畅的阅读体验

4. **专业标准**：
   - 符合顶级PE机构报告规范
   - 保持正式的商业语调
   - 确保数据引用的准确性
   - 维护逻辑的连贯性

5. **最终检查**：
   - 消除重复内容
   - 修正格式不一致
   - 确保完整性
   - 优化整体表现

要求：
- 保持所有原始内容和数据的完整性
- 不添加新的分析或观点
- 专注于格式和呈现的优化
- 确保报告适合直接呈现给投资委员会

报告内容：
${report}

请输出最终格式化的专业报告：`;

    try {
        const thinkingPrompt = `## 最终格式化思考

作为顶级的报告格式化专家，我需要：

1. **结构分析**：
   - 识别报告的主要章节
   - 确定信息层次关系
   - 优化标题和子标题

2. **内容优化**：
   - 突出关键数据和发现
   - 统一数据呈现格式
   - 改善段落结构

3. **可读性提升**：
   - 确保逻辑流畅
   - 优化视觉呈现
   - 提高专业性

4. **质量保证**：
   - 保持内容完整性
   - 确保格式一致性
   - 达到发布标准`;

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

    const prompt = `你是一位专业的报告格式化专家。请对以下PE访谈报告进行快速但专业的格式化。

重点关注：
1. 清晰的标题结构（### #### 等）
2. 重要数据用**粗体**突出
3. 适当的段落分隔
4. 统一的格式标准

保持：
- 所有原始内容完整
- 专业的商业语调
- 逻辑的连贯性

报告内容：
${report}

请输出格式化后的报告：`;

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