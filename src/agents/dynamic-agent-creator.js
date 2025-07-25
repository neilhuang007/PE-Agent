// Dynamic Sub-Agent Creator - Creates specialized agents based on content analysis

export async function createDynamicSpecialists(content, model) {
    const prompt = `你是一位顶级的企业分析专家和智能代理架构师。请分析以下内容，动态创建最适合的专业分析代理。

内容分析：
${content.substring(0, 6000)}...

任务：基于内容的实际特点，设计专门的分析代理来进行深度提取。

分析维度：
1. 识别内容中的核心主题领域（不限于预定义类别）
2. 评估每个主题的信息密度和商业重要性
3. 确定需要专业洞察的具体分析角度
4. 设计相应的专家代理规格

代理设计原则：
- 基于内容实际情况动态生成，而非套用模板
- 每个代理都应该有明确的专业领域和分析重点
- 代理应该能够提供深度洞察而非表面信息
- 重点关注对投资决策有价值的专业分析

输出JSON格式：
{
  "dynamic_specialists": [
    {
      "agent_name": "具体的专家代理名称",
      "expertise_domain": "专业领域描述",
      "analysis_focus": "具体分析重点和目标",
      "key_extraction_points": ["提取要点1", "提取要点2", "提取要点3"],
      "business_value": "对投资决策的价值",
      "content_relevance": "内容相关性评分(1-10)",
      "professional_angle": "专业分析角度"
    }
  ],
  "content_themes": "内容主要主题总结",
  "analysis_strategy": "整体分析策略"
}

注意：只创建真正能提供深度洞察的专家代理，避免重复或表面的分析。`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        console.error('Error in dynamic specialist creation:', error);
        return null;
    }
}

export async function executeDynamicSpecialist(specialistConfig, content, fileUris, model) {
    const professionalStyle = `
**专业分析风格要求：**
通过专业、精确的方式，提供具有深度洞察的行业和企业分析报告。

**分析标准：**
- 采用投资银行级别的专业分析框架
- 提供具有商业价值的深度洞察
- 确保分析的准确性和可操作性
- 关注对投资决策的实际影响
- 使用行业标准的专业术语和分析方法`;

    const contentParts = [
        { text: `你是一位${specialistConfig.expertise_domain}的顶级专家，拥有20年以上的专业经验。

${professionalStyle}

**你的专业使命：**
${specialistConfig.analysis_focus}

**分析目标：**
${specialistConfig.key_extraction_points.join('\n- ')}

**商业价值导向：**
${specialistConfig.business_value}

**专业分析角度：**
${specialistConfig.professional_angle}

**待分析内容：**
${content}` }
    ];

    // Add file references if available
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n**参考文档：**' });
        fileUris.forEach(file => {
            if (file.content) {
                contentParts.push({ text: `\n文档：${file.displayName}\n${file.content.substring(0, 2000)}...` });
            } else {
                contentParts.push({
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri
                    }
                });
            }
        });
    }

    contentParts.push({ text: `

**专业分析要求：**
1. 提供深度的专业洞察，而非表面信息整理
2. 识别关键的商业模式、竞争优势、风险因素
3. 量化重要指标和性能数据
4. 评估行业地位和发展潜力
5. 提供投资决策相关的关键判断依据

**输出格式：**
【${specialistConfig.agent_name}专业分析】

**核心发现**
- 关键洞察1：具体分析和数据支撑
- 关键洞察2：具体分析和数据支撑
- 关键洞察3：具体分析和数据支撑

**深度分析**
[基于专业框架的详细分析，包含具体数据、对比分析、趋势判断]

**商业价值评估**
- 投资亮点：具体价值点和量化指标
- 关注要点：需要重点关注的风险或机会
- 决策建议：基于专业判断的具体建议

**数据验证**
- 关键数据：具体数字和来源
- 验证状态：数据可信度评估
- 补充需求：需要进一步验证的信息点

请严格按照专业标准进行分析，确保提供有价值的深度洞察。` });

    try {
        const result = await model.generateContent(contentParts);
        return {
            agent_name: specialistConfig.agent_name,
            expertise_domain: specialistConfig.expertise_domain,
            analysis: result.response.text(),
            business_value: specialistConfig.business_value
        };
    } catch (error) {
        console.error(`Error in dynamic specialist execution for ${specialistConfig.agent_name}:`, error);
        return {
            agent_name: specialistConfig.agent_name,
            expertise_domain: specialistConfig.expertise_domain,
            analysis: `${specialistConfig.agent_name}分析失败: ${error.message}`,
            business_value: specialistConfig.business_value
        };
    }
}

export async function orchestrateDynamicAnalysis(content, fileUris, model) {
    console.log('🎯 启动动态专家代理创建系统...');
    
    // Step 1: Create dynamic specialists based on content
    const specialistConfigs = await createDynamicSpecialists(content, model);
    
    if (!specialistConfigs || !specialistConfigs.dynamic_specialists) {
        console.log('未能创建动态专家代理');
        return [];
    }

    console.log('=== DYNAMIC SPECIALISTS CREATED ===');
    console.log(`Content themes: ${specialistConfigs.content_themes}`);
    console.log(`Analysis strategy: ${specialistConfigs.analysis_strategy}`);
    console.log('Specialists:');
    specialistConfigs.dynamic_specialists.forEach((specialist, i) => {
        console.log(`${i + 1}. ${specialist.agent_name} (相关性: ${specialist.content_relevance}/10)`);
        console.log(`   专业领域: ${specialist.expertise_domain}`);
        console.log(`   分析重点: ${specialist.analysis_focus}`);
    });
    console.log('=== END SPECIALISTS ===\n');

    // Step 2: Filter and prioritize specialists (relevance >= 7)
    const highValueSpecialists = specialistConfigs.dynamic_specialists.filter(
        specialist => specialist.content_relevance >= 7
    );

    if (highValueSpecialists.length === 0) {
        console.log('未发现高价值分析主题');
        return [];
    }

    console.log(`🔬 执行 ${highValueSpecialists.length} 个高价值专家分析...`);

    // Step 3: Execute specialists in parallel
    const analysisPromises = highValueSpecialists.map(specialist => 
        executeDynamicSpecialist(specialist, content, fileUris, model)
    );

    const results = await Promise.all(analysisPromises);

    console.log('=== DYNAMIC ANALYSIS RESULTS ===');
    results.forEach(result => {
        console.log(`\n--- ${result.agent_name} ---`);
        console.log(`专业领域: ${result.expertise_domain}`);
        console.log(`商业价值: ${result.business_value}`);
        console.log(`分析结果: ${result.analysis.substring(0, 300)}...`);
    });
    console.log('=== END DYNAMIC ANALYSIS ===\n');

    return results;
}