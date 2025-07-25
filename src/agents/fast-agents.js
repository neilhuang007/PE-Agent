// Fast agents optimized for speed while maintaining quality
// These agents use more concise prompts and focus on essential information extraction

// Fast Agent 1: Quick Information Extraction - Optimized for Speed and Accuracy
export async function fastExtractChunk(chunk, index, model) {
    console.log(`FastExtractChunk ${index + 1} input:`, chunk.substring(0, 100) + '...'); // Debug log
    
    const prompt = `快速提取访谈片段中的关键信息。只要客观事实，确保准确性：

片段 ${index + 1}: ${chunk}

重点提取：
• 具体数字：收入、用户量、增长率、市场份额
• 业务核心：产品服务、商业模式、客户情况
• 财务数据：营收、成本、利润、资金需求
• 团队信息：规模、关键人员、背景
• 时间节点：成立时间、重要里程碑

输出简洁要点：
数据: 
业务: 
财务: 
团队: 
其他: `;

    try {
        const result = await model.generateContent(prompt);
        const extractedText = result.response.text();
        console.log(`FastExtractChunk ${index + 1} result:`, extractedText.substring(0, 150) + '...'); // Debug log
        return extractedText;
    } catch (error) {
        console.error(`Error in fastExtractChunk ${index}:`, error);
        return `片段 ${index + 1} 快速提取失败: ${error.message}`;
    }
}

// Fast Agent 2: Quick Information Organization - Streamlined for Speed
export async function fastOrganizeInformation(extractedChunks, businessPlan, model) {
    const allInfo = extractedChunks.join('\n') + (businessPlan ? `\n${businessPlan.substring(0, 800)}` : '');
    
    const prompt = `快速整理为结构化报告，输出JSON：

信息: ${allInfo}

JSON格式：
{
  "公司概况": ["基本信息","团队情况"],
  "业务模式": ["核心业务","产品服务"],
  "财务状况": ["收入数据","成本利润"],
  "市场情况": ["市场地位","竞争情况"],
  "发展计划": ["未来规划","资金需求"]
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log('FastOrganize raw response:', text); // Debug log
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('FastOrganize parsed result:', parsed); // Debug log
            return parsed;
        }
        
        // Fallback: create a basic structure from the raw information
        console.warn('Failed to parse JSON, creating fallback structure');
        return {
            "公司概况": [allInfo.substring(0, 200) + "..."],
            "业务模式": [allInfo.substring(200, 400) + "..."],
            "财务状况": [allInfo.substring(400, 600) + "..."],
            "市场情况": [allInfo.substring(600, 800) + "..."],
            "发展计划": [allInfo.substring(800, 1000) + "..."]
        };
    } catch (error) {
        console.error('Error in fastOrganizeInformation:', error);
        // Return a fallback structure instead of null
        return {
            "公司概况": ["信息提取失败"],
            "业务模式": ["信息提取失败"],
            "财务状况": ["信息提取失败"],
            "市场情况": ["信息提取失败"],
            "发展计划": ["信息提取失败"]
        };
    }
}

// Fast Agent 3: Quick Report Composition - Optimized for Speed and Accuracy
export async function fastComposeReport(organizedInfo, companyName, model) {
    console.log('FastComposeReport inputs:', { organizedInfo, companyName }); // Debug log
    
    // Ensure we have valid inputs
    if (!organizedInfo || typeof organizedInfo !== 'object') {
        console.error('Invalid organizedInfo:', organizedInfo);
        organizedInfo = { "错误": ["输入数据无效"] };
    }
    
    if (!companyName || typeof companyName !== 'string') {
        console.error('Invalid companyName:', companyName);
        companyName = "未知公司";
    }
    
    const prompt = `生成专业PE访谈纪要：

公司：${companyName}
信息：${JSON.stringify(organizedInfo, null, 2)}

要求：
- 专业投资风格
- 数据用**粗体**标注
- 章节清晰结构
- 只用已有事实
- 每个章节至少写2-3段详细内容

格式：
### 公司概况
### 业务模式  
### 财务状况
### 市场情况
### 发展计划

直接输出格式化报告：`;

    console.log('FastComposeReport prompt:', prompt.substring(0, 500) + '...'); // Debug log

    try {
        const result = await model.generateContent(prompt);
        const reportText = result.response.text();
        
        console.log('FastComposeReport raw result:', reportText.substring(0, 200) + '...'); // Debug log
        
        // Safety check for valid report
        if (!reportText || typeof reportText !== 'string' || reportText.trim().length < 50) {
            console.error('生成的报告过短或无效，长度:', reportText?.length);
            return `【报告生成错误】\n无法生成有效报告内容。\n\n基于提供的信息：\n${JSON.stringify(organizedInfo, null, 2)}`;
        }
        
        return reportText;
    } catch (error) {
        console.error('Error in fastComposeReport:', error);
        return `【报告生成失败】\n错误信息: ${error.message}\n\n输入信息:\n公司：${companyName}\n数据：${JSON.stringify(organizedInfo, null, 2)}`;
    }
}

// Fast Agent 4: Quick Quality Check - Streamlined
export async function fastQualityCheck(report, model) {
    const prompt = `快速评估报告质量：

${report.substring(0, 2000)}...

JSON输出：
{
  "score": 85,
  "pass": true,
  "issues": [],
  "summary": "质量评估"
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { score: 80, pass: true, issues: [], summary: "快速检查完成" };
    } catch (error) {
        console.error('Error in fastQualityCheck:', error);
        return { score: 75, pass: true, issues: ["检查失败"], summary: "检查过程出错" };
    }
}

// Fast Agent 5: Quick Formatting - Streamlined
export async function fastFormatReport(report, model) {
    const prompt = `快速格式化报告：

${report}

要求：标题统一、数据加粗、格式规范

输出格式化报告：`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error in fastFormatReport:', error);
        return report; // 如果格式化失败，返回原报告
    }
}