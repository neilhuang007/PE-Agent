// Specialized agent for extracting competitor revenue and market data from PDFs

export async function extractCompetitorData(fileUris, model) {
    if (!fileUris || fileUris.length === 0) {
        return "无文档可供分析";
    }
    
    const contentParts = [
        { text: `你是一位专业的竞争分析专家。请从以下文档中提取所有关于竞争对手的具体数据，特别关注收入和财务信息。` }
    ];
    
    fileUris.forEach(file => {
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
    });
    
    contentParts.push({ text: `

专门提取以下竞争对手信息：

1. **竞争对手公司名称**（完整公司名、简称、英文名）
2. **收入数据**（年营收、季度收入、增长率、具体数字）
3. **市场份额**（百分比、排名、市场地位）
4. **用户数据**（用户总数、活跃用户、增长数据）
5. **财务指标**（利润、估值、融资金额、IPO信息）
6. **业务规模**（员工数、办公地点、业务覆盖范围）
7. **产品价格**（具体定价、收费模式）
8. **市场表现**（销售额、市场占有率、增长趋势）

输出格式：
【竞争对手概览】
公司A：
- 收入：具体数字（年份）
- 市场份额：具体百分比
- 用户数：具体数字
- 其他关键指标：...

公司B：
- 收入：具体数字（年份）
- 市场份额：具体百分比
- 用户数：具体数字
- 其他关键指标：...

【行业整体数据】
- 市场总规模：...
- 增长率：...
- 主要参与者排名：...

【数据来源】
- 来源1：具体页面/章节
- 来源2：具体页面/章节

重要：如果文档中包含表格、图表或数据列表，请逐一提取所有数字。不要遗漏任何竞争对手的财务数据。` });

    try {
        const result = await model.generateContent(contentParts);
        return result.response.text();
    } catch (error) {
        console.error('Error in competitor data extraction:', error);
        return `竞争对手数据提取失败: ${error.message}`;
    }
}

// Function to specifically search for revenue patterns in text
export function findRevenuePatterns(text) {
    const revenuePatterns = [
        /营收.*?(\d+\.?\d*)\s*(亿|万|千万|百万)/gi,
        /收入.*?(\d+\.?\d*)\s*(亿|万|千万|百万)/gi,
        /revenue.*?(\d+\.?\d*)\s*(billion|million|万|亿)/gi,
        /销售额.*?(\d+\.?\d*)\s*(亿|万|千万|百万)/gi,
        /(\d+\.?\d*)\s*(亿|万|千万|百万).*?(营收|收入|销售)/gi
    ];
    
    const matches = [];
    revenuePatterns.forEach(pattern => {
        const found = [...text.matchAll(pattern)];
        matches.push(...found.map(match => match[0]));
    });
    
    return [...new Set(matches)]; // Remove duplicates
}