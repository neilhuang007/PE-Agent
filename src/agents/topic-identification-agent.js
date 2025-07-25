// Topic Identification Agent - Identifies key topics and spawns specialized sub-agents

export async function identifyTopics(content, model) {
    const prompt = `你是一位顶级的信息分析专家。请分析以下内容，识别需要深度提取的关键主题领域。

内容分析：
${content.substring(0, 5000)}...

任务：识别内容中提到的重要主题，为每个主题评估信息丰富程度和重要性。

主题识别范围：
1. **数据相关**：数据处理、数据类型、数据来源、数据分析、数据安全
2. **技术相关**：技术架构、开发团队、技术优势、研发投入、专利技术
3. **财务相关**：收入结构、成本分析、盈利模式、融资历史、财务预测
4. **竞争相关**：竞争对手、市场份额、竞争优势、行业地位
5. **客户相关**：客户结构、客户获取、客户留存、客户满意度
6. **运营相关**：业务流程、运营模式、供应链、合作伙伴
7. **市场相关**：目标市场、市场规模、市场趋势、营销策略
8. **团队相关**：核心团队、组织架构、人才结构、企业文化
9. **产品相关**：产品线、产品特性、产品开发、用户体验
10. **风险相关**：业务风险、技术风险、市场风险、合规风险

输出JSON格式：
{
  "identified_topics": [
    {
      "topic": "数据处理",
      "importance": "high/medium/low",
      "information_richness": "rich/moderate/sparse",
      "key_mentions": ["具体提及的相关内容"],
      "requires_specialized_extraction": true/false,
      "specialized_focus": "需要专门提取的具体方面"
    }
  ],
  "content_summary": "内容整体概述",
  "extraction_priority": ["按重要性排序的主题列表"]
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        console.error('Error in topic identification:', error);
        return null;
    }
}

// Sub-agent spawner based on identified topics
export async function spawnSpecializedAgents(identifiedTopics, content, model) {
    const results = [];
    
    for (const topic of identifiedTopics.identified_topics) {
        if (topic.requires_specialized_extraction) {
            console.log(`Spawning specialized agent for: ${topic.topic}`);
            
            const specializedResult = await extractSpecializedTopic(
                topic.topic, 
                topic.specialized_focus, 
                content, 
                model
            );
            
            results.push({
                topic: topic.topic,
                extraction: specializedResult,
                importance: topic.importance
            });
        }
    }
    
    return results;
}

// Generic specialized topic extractor
async function extractSpecializedTopic(topicName, focus, content, model) {
    const styleDefinitions = getTopicStyle(topicName);
    
    const prompt = `你是一位${topicName}领域的专业分析师。请从以下内容中深度提取所有相关信息。

内容：
${content}

专业提取重点：${focus}

${styleDefinitions}

输出要求：
1. 只提取明确的事实和数据
2. 包含具体数字、时间、地点、人名
3. 避免推测和主观判断
4. 按重要性排序信息点
5. 标注信息来源（如果可识别）

输出格式：
【${topicName}核心信息】
- 关键信息点1：具体详情
- 关键信息点2：具体详情
...

【${topicName}数据指标】
- 数据点1：具体数值（时间、单位）
- 数据点2：具体数值（时间、单位）
...

【${topicName}重要细节】
- 详细信息1
- 详细信息2
...`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error(`Error in specialized extraction for ${topicName}:`, error);
        return `${topicName}专项提取失败: ${error.message}`;
    }
}

// Get specific style definitions for different topics
function getTopicStyle(topicName) {
    const styles = {
        "数据处理": `
响应风格定义：
- 重点关注数据量级（TB、GB等）、处理速度、数据源类型
- 提取数据流程的具体步骤和技术细节
- 识别数据安全和隐私保护措施
- 关注数据分析工具和算法应用`,
        
        "技术架构": `
响应风格定义：
- 详细描述技术栈、开发语言、框架选择
- 提取系统架构图、技术指标、性能数据
- 关注技术团队规模、技术负责人背景
- 识别技术创新点和专利申请情况`,
        
        "财务分析": `
响应风格定义：
- 精确提取所有财务数字：收入、成本、利润、现金流
- 按时间序列整理财务数据（年度、季度）
- 关注收入增长率、毛利率、净利率等关键比率
- 识别收入来源构成和商业模式细节`,
        
        "竞争分析": `
响应风格定义：
- 列出所有竞争对手名称、市场地位、收入规模
- 提取市场份额数据、排名信息
- 对比产品功能、价格、用户规模
- 分析竞争优势的具体表现和量化指标`,
        
        "客户分析": `
响应风格定义：
- 详细描述客户类型、客户数量、客户分布
- 提取客户获取成本、客户生命周期价值
- 关注大客户名单、合作案例、续约率
- 分析客户满意度数据和反馈信息`
    };
    
    return styles[topicName] || `
响应风格定义：
- 提取具体事实和可验证数据
- 关注数量、时间、地点、人物等具体信息
- 避免主观判断和推测性语言
- 按逻辑结构组织信息`;
}