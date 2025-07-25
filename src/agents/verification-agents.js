// Verification and enrichment agents for comprehensive report quality

// Agent 6: Extract key information from report for verification
export async function extractKeyInfo(report, model) {
    const prompt = `你是一位专业的信息提取专家。请从以下报告中提取所有重要的、可验证的信息点。

报告内容：
${report}

提取要求：
1. 所有具体数字（收入、利润、成本、增长率、市场规模等）
2. 所有日期和时间信息
3. 所有人名、职位、公司名称
4. 所有竞争对手信息
5. 所有产品名称、功能描述
6. 所有技术指标、性能参数
7. 所有客户名称、合作伙伴
8. 所有融资信息（金额、估值、投资方）
9. 所有市场份额、排名信息
10. 所有战略目标、预测数据

输出JSON格式：
{
  "财务数据": [
    {"类型": "收入", "数值": "xxx", "时间": "xxx", "原文": "xxx"},
    {"类型": "利润", "数值": "xxx", "时间": "xxx", "原文": "xxx"}
  ],
  "人物信息": [
    {"姓名": "xxx", "职位": "xxx", "背景": "xxx", "原文": "xxx"}
  ],
  "竞争对手": [
    {"公司": "xxx", "数据": "xxx", "原文": "xxx"}
  ],
  "产品技术": [
    {"名称": "xxx", "描述": "xxx", "原文": "xxx"}
  ],
  "客户合作": [
    {"名称": "xxx", "关系": "xxx", "原文": "xxx"}
  ],
  "融资历史": [
    {"轮次": "xxx", "金额": "xxx", "投资方": "xxx", "原文": "xxx"}
  ],
  "市场数据": [
    {"指标": "xxx", "数值": "xxx", "原文": "xxx"}
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse extracted info:', e);
            return null;
        }
    }
    return null;
}

// Agent 7: Enrich report with additional information
export async function enrichReport(report, extractedInfo, transcript, fileUris, model) {
    const contentParts = [
        { text: `你是一位专业的信息增强专家。你的任务是在原始资料中寻找与已提取信息相关的额外细节，并将这些细节补充到报告中。

当前报告：
${report}

已提取的关键信息：
${JSON.stringify(extractedInfo, null, 2)}

原始访谈记录：
${transcript}` }
    ];
    
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n请在以下上传的文档中搜索相关信息：' });
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

任务要求：
1. 针对每个已提取的信息点，在原始资料中搜索相关的补充信息
2. 寻找以下类型的补充信息：
   - 更详细的背景说明
   - 相关的上下文信息
   - 支持性的数据和事实
   - 相关的时间线信息
   - 关联的人物或组织
   - 技术细节或业务细节
3. 对于财务数据，寻找：
   - 同比/环比数据
   - 历史趋势
   - 细分数据
   - 相关说明
4. 对于人物信息，寻找：
   - 详细背景
   - 过往经历
   - 具体贡献
5. 对于竞争对手，寻找：
   - 详细对比数据
   - 优劣势分析
   - 市场地位

输出格式：
{
  "enrichments": [
    {
      "original_text": "报告中的原文段落",
      "enriched_text": "增强后的段落（包含新增信息）",
      "additions": ["新增信息1", "新增信息2"],
      "sources": ["来源：访谈记录第X部分", "来源：BP第Y页"]
    }
  ],
  "new_sections": [
    {
      "section": "建议添加到的章节",
      "content": "完全新的信息内容",
      "source": "来源说明"
    }
  ]
}` });

    const result = await model.generateContent({ contents: [{ parts: contentParts }] });
    const text = result.response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse enrichment data:', e);
            return null;
        }
    }
    return null;
}

// Agent 8: Validate report quality and completeness
export async function validateReport(report, bpExtract, enrichmentData, model) {
    const prompt = `你是一位严格的报告质量审核专家。请评估这份报告的质量和完整性。

报告内容：
${report}

商业计划书提取的信息：
${bpExtract}

信息增强数据：
${JSON.stringify(enrichmentData, null, 2)}

评估标准：
1. 信息完整性（90分以上）
   - BP中的所有关键信息是否都体现在报告中
   - 访谈中的所有重要细节是否都被包含
   - 数据是否有完整的上下文说明
   
2. 信息深度（必须详细）
   - 每个信息点是否都有充分的细节
   - 是否包含具体的数字、日期、人名
   - 是否有足够的背景信息
   
3. 引用准确性
   - 所有重要数据是否都有来源标注
   - 引用是否准确可追溯
   
4. 结构合理性
   - 信息是否按逻辑组织
   - 相关信息是否聚合在一起

输出格式：
{
  "quality_score": 85,  // 0-100分
  "pass": false,  // true表示高质量，false表示需要改进
  "issues": [
    {
      "type": "信息缺失",
      "description": "BP中提到的xxx信息在报告中未体现",
      "severity": "high"
    },
    {
      "type": "细节不足", 
      "description": "xxx部分缺少具体数据支撑",
      "severity": "medium"
    }
  ],
  "missing_from_bp": ["BP中的信息1未包含", "BP中的信息2未包含"],
  "suggestions": ["建议补充xxx信息", "建议增加xxx细节"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse validation result:', e);
            return { pass: false, quality_score: 0, issues: ["解析失败"] };
        }
    }
    return { pass: false, quality_score: 0, issues: ["验证失败"] };
}

// Agent 9: Extract all information from Business Plan
export async function extractFromBP(fileUris, model) {
    if (!fileUris || fileUris.length === 0) {
        return "无商业计划书";
    }
    
    const contentParts = [
        { text: `你是一位专业的商业计划书分析专家。请详细提取以下商业计划书中的所有信息，不要有任何遗漏或缩写。` }
    ];
    
    contentParts.push({ text: '\n\n请分析以下商业计划书：' });
    fileUris.forEach(file => {
        contentParts.push({
            fileData: {
                mimeType: file.mimeType,
                fileUri: file.uri
            }
        });
    });
    
    contentParts.push({ text: `

提取要求：
1. 提取所有章节的完整内容
2. 保留所有数字、数据、图表信息
3. 记录所有人名、公司名、产品名
4. 提取所有财务数据和预测
5. 保留所有技术描述和业务模式说明
6. 记录所有市场分析和竞争分析
7. 提取所有团队成员信息
8. 保留所有里程碑和发展计划
9. 不要总结或缩写，保持原始详细程度
10. 如果有图表，描述图表内容

输出格式：
【执行摘要】
[完整内容]

【公司介绍】
[完整内容]

【市场分析】
[完整内容]

【产品与服务】
[完整内容]

【商业模式】
[完整内容]

【营销策略】
[完整内容]

【管理团队】
[完整内容]

【财务计划】
[完整内容]

【融资需求】
[完整内容]

【风险分析】
[完整内容]

【附录】
[如有]` });

    const result = await model.generateContent({ contents: [{ parts: contentParts }] });
    return result.response.text();
}

// Agent 10: Apply enrichments to create final report
export async function applyEnrichments(report, enrichmentData, model) {
    const prompt = `你是一位专业的报告编辑专家。请根据增强数据更新报告。

原始报告：
${report}

增强数据：
${JSON.stringify(enrichmentData, null, 2)}

任务：
1. 将所有enriched_text替换对应的original_text
2. 在适当位置添加new_sections中的内容
3. 为所有新增的重要数据添加来源标注，格式：（数据来源：xxx）
4. 保持报告的整体格式和结构
5. 确保信息流畅自然

输出完整的增强后报告。`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}