// Agent 1: Extract all information from chunk (no summarization)
export async function summarizeChunk(chunk, index, model) {
    const prompt = `你是一位专业的私募股权投资分析师。请极其详细地提取以下访谈片段中的所有信息，不要遗漏任何细节。

访谈片段 ${index + 1}:
${chunk}

要求：
1. 提取所有提到的事实、数据、观点、细节、背景信息
2. 保留所有具体数字（金额、百分比、数量、日期等）
3. 记录所有人名、职位、公司名、产品名、地名
4. 保留所有业务描述、流程说明、技术细节
5. 记录所有提到的客户、合作伙伴、竞争对手
6. 提取所有战略规划、目标、预测数据
7. 保留所有行业分析、市场判断、趋势观察
8. 记录所有问题、挑战、解决方案
9. 将口语化表达规范化但保留原意
10. 绝对不要总结、省略或合并任何信息

输出格式：
- [详细信息点1，包含完整上下文]
- [详细信息点2，包含完整上下文]
- [详细信息点3，包含完整上下文]
...

技术术语与专有名词：[列出所有识别到的技术术语、行业术语、缩写]`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Agent 2: Organize information
export async function organizeInformation(summaries, businessPlanText, fileUris, model) {
    // Build content array with text and file references
    const contentParts = [
        { text: `你是一位专业的私募股权投资分析师。请将以下所有信息极其详细地整理到对应的报告章节中，确保每一个细节都被包含。

访谈提取的详细信息：
${summaries.join('\n\n---\n\n')}` }
    ];
    
    // Add business plan text if available
    if (businessPlanText) {
        contentParts.push({ text: `\n\n商业计划书内容：\n${businessPlanText}` });
    }
    
    // Add file references
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n请同时分析以下上传的文档：' });
        fileUris.forEach(file => {
            contentParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            });
        });
    }
    
    contentParts.push({ text: `

请将信息分类到以下章节，每个章节包含所有相关的详细信息：
1. 公司简介 - 包括但不限于：公司全称、成立时间、创始人背景、发展历程、核心团队、员工规模、组织架构、企业文化、办公地点等
2. 行业情况 - 包括但不限于：市场规模数据、增长率、行业趋势、竞争格局、主要竞争对手、市场份额、行业壁垒、政策环境、技术发展等
3. 主营业务 - 包括但不限于：产品线详情、服务内容、商业模式、收费模式、客户群体、销售渠道、核心技术、竞争优势、业务流程等
4. 财务情况 - 包括但不限于：历史收入、利润数据、成本结构、毛利率、费用明细、现金流、财务预测、单位经济模型等
5. 融资情况 - 包括但不限于：历史融资轮次、投资方、融资金额、估值、股权结构、员工持股、未来融资计划、IPO计划等

输出JSON格式（每个信息点要包含完整细节，不要简化）：
{
  "公司简介": ["详细信息点1，包含所有相关数据和背景", "详细信息点2..."],
  "行业情况": ["详细信息点1，包含完整的市场数据和分析", "详细信息点2..."],
  "主营业务": ["详细信息点1，包含产品/服务的完整描述", "详细信息点2..."],
  "财务情况": ["详细信息点1，包含所有财务数据和指标", "详细信息点2..."],
  "融资情况": ["详细信息点1，包含完整的融资历史和计划", "详细信息点2..."],
  "技术术语": ["术语1：解释", "术语2：解释"]
}` });

    const result = await model.generateContent({ contents: [{ parts: contentParts }] });
    const text = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse JSON:', e);
            return null;
        }
    }
    return null;
}

// Agent 3: Compose report (comprehensive content generation)
export async function composeReport(organizedInfo, companyName, businessPlanText, fileUris, model) {
    const contentParts = [
        { text: `你是一位私募股权投资经理，需要撰写一份极其详细和全面的访谈纪要报告。

背景信息和访谈内容已经整理如下：
${JSON.stringify(organizedInfo, null, 2)}` }
    ];
    
    if (businessPlanText) {
        contentParts.push({ text: `\n\n商业计划书内容：\n${businessPlanText}` });
    }
    
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n请参考以下上传的文档生成报告：' });
        fileUris.forEach(file => {
            contentParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            });
        });
    }
    
    contentParts.push({ text: `

任务：为${companyName}撰写一份极其详细的访谈纪要报告。

内容要求：
1. 包含所有整理好的信息，不要遗漏任何细节
2. 每个章节都要充分展开，包含所有相关的数据、事实、背景信息
3. 保留所有具体数字、百分比、金额、日期等量化信息
4. 详细描述所有业务细节、产品功能、技术特点
5. 完整记录所有提到的人物、公司、合作关系
6. 将口语化内容改写为正式书面语，但保持信息完整性
7. 可以创建多级子章节来组织复杂信息

章节结构：
【公司简介】- 必须包含公司概述、历史沿革、核心团队等子章节
【行业情况】- 必须包含市场机遇、竞争格局等子章节
【主营业务】- 必须包含产品与服务、技术架构、核心竞争优势等子章节
【财务情况】- 必须包含收入情况、成本分析、财务预测等子章节
【融资情况】- 必须包含融资历史、股权结构、未来计划等子章节

注意：这不是格式化阶段，请尽可能详细地输出所有信息，格式化将在后续步骤完成。

输出格式：
1) 报告结构
报告应包含主要章节：
【公司简介】（公司概况）
【行业情况】（行业分析）
【主营业务】（核心业务）
【财务情况】（财务状态）
【融资情况】（融资历史）

每个主要章节前：2个空行
每个标题后：1个空行

2) 章节标题
主要章节：【章节名称】
子章节：子章节名称（普通文本，分段落展示）

3) 内容层次
段落之间空1行
将数据直接嵌入句子中

请参考以下示例格式：

【公司简介】

公司全称和成立时间等基本信息介绍。

技术实力
描述公司的技术能力和专利情况。

发展历程
描述公司重要发展节点。


【行业情况】

市场规模与增长
行业市场规模数据和增长预测。` });

    const result = await model.generateContent({ contents: [{ parts: contentParts }] });
    return result.response.text();
}

// Agent 5: Format report (new formatting agent)
export async function formatReport(report, model) {
    const prompt = `你是一位专业的报告格式化专家。请将以下详细的报告内容按照标准格式进行排版。

原始报告内容：
${report}

格式化要求：
1) 章节结构
- 每个主要章节【章节名称】前空2行
- 章节标题后空1行
- 子章节标题后空1行

2) 标题格式
- 主要章节：【章节名称】
- 一级子章节：直接写子章节名称（如：公司概述）
- 二级子章节：使用缩进或编号

3) 内容格式
- 段落之间空1行
- 长段落适当分段以提高可读性
- 数据密集部分可使用列表形式
- 重要数据可以适当突出（如使用括号标注）

4) 整体要求
- 保持专业、简洁、易读
- 确保所有信息都被保留
- 优化段落结构但不改变内容
- 参考冈蒂斯访谈纪要的格式风格

请输出格式化后的完整报告。`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Agent 4: Verify report (updated)
export async function verifyReport(report, transcript, businessPlanText, fileUris, model) {
    const contentParts = [
        { text: `你是一位专业的报告审核员。请审核以下投资报告。

报告内容：
${report}

原始访谈记录：
${transcript}` }
    ];
    
    if (businessPlanText) {
        contentParts.push({ text: `\n\n商业计划书：\n${businessPlanText}` });
    }
    
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n请对照以下上传的原始文档验证报告准确性：' });
        fileUris.forEach(file => {
            contentParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            });
        });
    }
    
    contentParts.push({ text: `

审核要求：
1. 核实报告中所有数据的准确性
2. 确保访谈中提到的所有重要信息都已包含在报告中
3. 删除所有主观判断词汇（如"最好"、"展现了"、"显示了"等）
4. 将口语化表达改为正式书面语
5. 保留所有技术性证据和客观事实
6. 确保格式符合要求
7. 验证上传文档中的关键信息是否已包含在报告中

请输出修正后的报告，保持原有格式。` });

    const result = await model.generateContent({ contents: [{ parts: contentParts }] });
    return result.response.text();
}