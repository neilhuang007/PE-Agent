// Enhanced agents with thinking mode for highest quality reports
// This file contains the complete enhanced agent architecture for generating
// world-class private equity interview reports using Gemini Pro's thinking capabilities

import { generateWithThinking, generateWithFilesAndThinking } from '../config/gemini-config.js';

// Load prompts from centralized JSON files
let enhancedPrompts = null;

async function loadEnhancedPrompts() {
    if (!enhancedPrompts) {
        try {
            const response = await fetch('./prompts/enhanced-agents-prompts.json');
            enhancedPrompts = await response.json();
        } catch (error) {
            console.error('Failed to load enhanced prompts:', error);
            // Fallback to empty object if loading fails
            enhancedPrompts = {};
        }
    }
    return enhancedPrompts;
}

// Enhanced Agent 10: Comprehensive Business Plan Analyzer
export async function comprehensiveBPAnalysis(fileUris, model) {
    if (!fileUris || fileUris.length === 0) {
        return "无商业计划书可供分析";
    }
    
    try {
        const prompts = await loadEnhancedPrompts();
        const bpPrompt = prompts.comprehensiveBPAnalysis;
        
        if (!bpPrompt) {
            console.warn('BP analysis prompt not found, using fallback');
            // Fallback to basic prompt if JSON loading fails
            bpPrompt = {
                role: "你是一位世界顶级的商业计划书分析专家，拥有20年分析经验，曾为数百家PE机构进行BP深度分析。",
                taskIntro: "请对以下商业计划书进行最深度、最全面的分析：",
                taskDetails: "分析任务：深度分析商业计划书",
                outputFormat: "输出格式：结构化分析报告",
                thinkingPrompt: "分析思路：系统性商业计划书分析"
            };
        }
        
        const contentParts = [
            { text: bpPrompt.role }
        ];
        
        contentParts.push({ text: `\n\n${bpPrompt.taskIntro}` });
        fileUris.forEach(file => {
            contentParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            });
        });
        
        contentParts.push({ text: `\n\n${bpPrompt.taskDetails}\n\n${bpPrompt.outputFormat}` });
        
        return await generateWithFilesAndThinking(model, contentParts, 'VERY_HIGH');
        
    } catch (error) {
        console.error('BP analysis error:', error);
        return "商业计划书分析失败：" + error.message;
    }
}
1. 逐页、逐章节完整解读所有内容，特别关注表格和图表
2. **重点提取所有数字数据**：收入、用户数、市场规模、竞争对手数据等
3. **详细提取竞争分析部分**：竞争对手名称、市场份额、收入数据、业务指标
4. **提取所有财务数据**：历史财务、预测数据、关键比率
5. 识别所有具体的商业信息和运营数据
6. 提取团队背景的具体信息（教育、工作经历、具体成就）
7. 识别所有时间节点、里程碑和具体事件
8. 提取所有引用和数据来源
9. **专门关注行业数据和市场研究结果**
10. 确保不遗漏任何表格、图表中的具体数值

输出格式（必须包含BP中的每一个细节）：

【执行摘要深度分析】
- 核心价值主张：[详细描述]
- 市场机会：[具体数据和分析]
- 商业模式：[完整描述]
- 竞争优势：[具体分析]
- 财务亮点：[关键数字]
- 融资需求：[详细说明]

【公司分析】
- 公司历史：[完整发展历程]
- 组织架构：[详细结构]
- 企业文化：[文化特点]
- 地理分布：[具体位置]

【市场分析深度解读】
- 市场规模：[具体数据、增长率、预测]
- 细分市场：[详细分类和机会]
- 目标客户：[完整画像和分析]
- 市场趋势：[趋势分析和影响]
- 进入壁垒：[详细分析]

【竞争分析详解】
- 主要竞争对手：[公司名称、具体收入数据、市场份额、用户数等具体指标]
- 竞争对手财务表现：[具体收入、利润、增长率等数字]
- 市场排名和地位：[具体排名、市场份额百分比]
- 产品对比：[具体功能、价格、用户数据对比]

【产品/服务深度分析】
- 产品线：[完整产品组合]
- 技术特点：[技术细节]
- 开发路线图：[发展计划]
- 知识产权：[专利、商标等]

【商业模式详解】
- 收入模式：[收入来源分析]
- 成本结构：[成本分析]
- 价值链：[完整价值链]
- 合作伙伴：[合作关系]

【营销策略分析】
- 营销策略：[策略详解]
- 销售渠道：[渠道分析]
- 推广计划：[推广策略]
- 客户获取：[获客策略]

【管理团队深度分析】
- 核心团队：[详细背景、经验、能力]
- 组织架构：[完整架构图]
- 激励机制：[激励体系]
- 顾问团队：[顾问背景]

【财务分析详解】
- 历史财务：[详细财务数据]
- 财务预测：[预测模型和假设]
- 关键指标：[所有财务指标]
- 敏感性分析：[风险分析]
- 资金用途：[详细用途规划]

【融资分析】
- 融资历史：[历史融资记录]
- 本轮融资：[详细需求和用途]
- 估值分析：[估值方法和依据]
- 投资亮点：[投资价值点]
- 退出策略：[退出计划]

【风险评估】
- 市场风险：[具体风险点]
- 技术风险：[技术挑战]
- 财务风险：[财务挑战]
- 管理风险：[管理挑战]
- 缓解策略：[应对措施]

【关键假设和依据】
- 市场假设：[关键假设]
- 财务假设：[财务模型假设]
- 运营假设：[运营假设]
- 数据来源：[所有引用来源]

注意：必须提取BP中的每一个数据点、每一个图表、每一个重要信息，不得有任何遗漏。` });

    const result = await generateWithFilesAndThinking(model, contentParts, 'VERY_HIGH');
    return result.text;
}

// Enhanced Agent 1: Deep Information Extraction with Cross-Reference
export async function deepExtractChunk(chunk, index, transcript, fileUris, model) {
    const contentParts = [
        { text: `你是一位顶级的私募股权投资分析师，具有30年行业经验。请对以下访谈片段进行深度分析和完整信息提取。

访谈片段 ${index + 1}:
${chunk}

完整访谈上下文（用于理解背景）:
${transcript.substring(0, 5000)}...

任务要求（必须极其详细）：
1. 提取所有明确提及的事实、数据、观点、背景信息
2. 识别所有隐含的信息和未直接表达的含义
3. 分析每个数据点的上下文和重要性
4. 记录所有时间线信息和因果关系
5. 识别所有利益相关者和关系网络
6. 提取所有技术细节、业务流程、操作模式
7. 分析所有风险因素和机会点
8. 记录所有量化指标和定性描述
9. 识别需要进一步验证的信息点
10. 将口语转换为专业表述但保持完整性

特别关注：
- 财务数据的完整性和准确性
- 业务模式的详细描述
- 竞争优势的具体表现
- 团队能力的具体证据
- 市场机会的量化分析

输出格式：
【核心信息】
- [完整详细的信息点1，包含数据、背景、影响]
- [完整详细的信息点2，包含数据、背景、影响]

【量化数据】
- [数值1：具体数字，时间，单位，上下文，可信度]
- [数值2：具体数字，时间，单位，上下文，可信度]

【关键关系】
- [人物/组织关系，包括具体互动和影响]

【业务洞察】
- [深层次的业务分析和行业洞察]

【待验证信息】
- [需要在其他资料中核实的信息点]

【技术术语与专有名词】
- [术语：详细解释和应用场景]` }
    ];
    
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n请同时参考以下文档进行交叉验证：' });
        fileUris.forEach(file => {
            contentParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            });
        });
    }

    const result = await generateWithFilesAndThinking(model, contentParts, 'HIGH');
    return result.text;
}

// Enhanced Agent 2: Comprehensive Information Architecture
export async function architectInformation(extractedChunks, businessPlan, fileUris, model) {
    const contentParts = [
        { text: `你是一位顶级的信息架构师和私募股权分析专家。请将以下深度提取的信息构建成完整的知识图谱。

提取的详细信息：
${extractedChunks.join('\n\n===片段分隔===\n\n')}

商业计划书内容：
${businessPlan}` }
    ];
    
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

任务要求：
1. 构建完整的信息知识图谱，识别所有信息间的关联
2. 进行深度的信息整合和去重，但保持完整性
3. 识别信息的重要性层级和可信度等级
4. 发现信息空白点和需要补充的领域
5. 建立时间线和因果关系链
6. 交叉验证不同来源的信息一致性

输出超详细的JSON格式（确保每个信息点都包含足够细节）：
{
  "公司简介": {
    "基本信息": [
      {
        "内容": "完整详细的描述",
        "来源": "具体来源（访谈第X段/BP第Y页）",
        "可信度": "高/中/低",
        "关联信息": ["相关的其他信息点"],
        "量化数据": {"具体数字": "值", "时间": "时间点", "单位": "单位"}
      }
    ],
    "发展历程": [...],
    "核心团队": [...],
    "企业文化": [...]
  },
  "行业情况": {
    "市场规模": [...],
    "竞争格局": [...],
    "发展趋势": [...],
    "政策环境": [...]
  },
  "主营业务": {
    "产品服务": [...],
    "商业模式": [...],
    "核心技术": [...],
    "客户结构": [...],
    "供应链": [...]
  },
  "财务情况": {
    "收入结构": [...],
    "成本分析": [...],
    "盈利能力": [...],
    "现金流": [...],
    "财务预测": [...]
  },
  "融资情况": {
    "历史融资": [...],
    "股权结构": [...],
    "估值情况": [...],
    "未来规划": [...]
  },
  "风险机会": {
    "主要风险": [...],
    "机会点": [...],
    "应对策略": [...]
  },
  "信息空白": ["需要进一步补充的信息点"],
  "待验证": ["需要交叉验证的信息点"],
  "技术术语": {"术语": "完整解释"}
}` });

    const result = await generateWithFilesAndThinking(model, contentParts, 'VERY_HIGH');
    const text = result.text;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse architecture JSON:', e);
            return null;
        }
    }
    return null;
}

// Enhanced Agent 3: Master Report Composer
export async function masterComposeReport(architecturedInfo, companyName, fileUris, model) {
    const contentParts = [
        { text: `你是一位世界顶级的私募股权投资报告撰写专家，曾为全球顶级PE机构撰写过数百份投资分析报告。

公司名称：${companyName}

完整信息架构：
${JSON.stringify(architecturedInfo, null, 2)}` }
    ];
    
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n请参考原始文档确保准确性：' });
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

任务：撰写一份极其详细、专业、全面的私募股权投资访谈纪要。

要求标准（必须全部满足）：
1. 包含架构化信息中的每一个细节，不得遗漏
2. 每个数据点都要有具体的数值、时间、单位
3. 每个判断都要有充分的事实支撑
4. 保持专业的私募股权投资视角
5. 展现深度的行业洞察和分析
6. 确保逻辑清晰、结构完整
7. 重要信息需要有来源标注

报告结构要求：
【公司简介】
- 必须包含：公司概述、历史沿革、核心团队、企业文化等子章节
- 每个子章节都要有丰富的细节和具体数据

【行业情况】  
- 必须包含：市场机遇、竞争格局、发展趋势等子章节
- 深度分析行业动态和公司定位

【主营业务】
- 必须包含：产品与服务、商业模式、技术架构、核心优势等子章节
- 详细描述业务细节和差异化优势

【财务情况】
- 必须包含：收入情况、成本结构、盈利能力、财务预测等子章节
- 提供完整的财务分析和趋势判断

【融资情况】
- 必须包含：融资历史、股权结构、估值分析等子章节
- 详细的资本运作和股权变化分析

注意：这是内容生成阶段，请最大化信息密度和深度，格式化将在后续步骤完成。` });

    const result = await generateWithFilesAndThinking(model, contentParts, 'VERY_HIGH');
    return result.text;
}

// Enhanced Agent 4: Multi-Source Citation Verifier
export async function verifyCitations(report, transcript, fileUris, model) {
    const contentParts = [
        { text: `你是一位严格的事实核查专家和引用验证师。请对以下报告进行全面的事实核查和引用验证。

报告内容：
${report}

原始访谈记录：
${transcript}` }
    ];
    
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n原始文档：' });
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

验证任务（重点关注有实际引用价值的信息）：
1. 识别报告中所有具体的数字、日期、人名、公司名等关键事实
2. 验证这些关键事实在原始资料中的准确来源
3. 检查重要商业信息（收入、用户数、市场规模等）的准确性
4. 验证关键时间节点和发展历程信息
5. 确认重要的业务数据和财务信息
6. 重点验证可能影响投资决策的关键信息

注意：如果原始资料信息有限，重点验证现有信息的准确性，而不是寻找不存在的信息。

输出JSON格式：
{
  "verification_summary": {
    "total_facts_checked": 数量,
    "verified_facts": 数量,
    "unverified_facts": 数量,
    "contradictions_found": 数量,
    "overall_accuracy": "百分比"
  },
  "fact_checks": [
    {
      "claim": "报告中的具体陈述",
      "verification_status": "verified/unverified/contradicted",
      "source_found": "具体来源位置",
      "evidence": "支持证据",
      "confidence": "high/medium/low",
      "notes": "验证说明"
    }
  ],
  "missing_citations": [
    {
      "statement": "需要引用的陈述",
      "suggested_source": "建议的来源",
      "importance": "high/medium/low"
    }
  ],
  "contradictions": [
    {
      "report_claim": "报告中的声明",
      "source_evidence": "原始资料中的证据",
      "resolution": "建议的解决方案"
    }
  ],
  "recommendations": ["改进建议列表"]
}` });

    const result = await generateWithFilesAndThinking(model, contentParts, 'HIGH');
    const text = result.text;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse citation verification:', e);
            return null;
        }
    }
    return null;
}

// Enhanced Agent 5: Quality Excellence Validator
export async function validateExcellence(report, verificationResults, architecturedInfo, model) {
    const prompt = `你是一位世界顶级的投资报告质量评估专家，曾为KKR、黑石、红杉等顶级机构制定报告标准。

报告内容：
${report}

事实验证结果：
${JSON.stringify(verificationResults, null, 2)}

原始信息架构：
${JSON.stringify(architecturedInfo, null, 2)}

评估任务：
请按照最高标准评估这份报告的质量，评分标准极其严格。

评估维度：
1. 信息完整性（25分）- 是否包含所有重要信息
2. 分析深度（25分）- 洞察是否深入和专业
3. 事实准确性（25分）- 数据和事实的准确程度
4. 逻辑结构（15分）- 报告结构和逻辑的清晰度
5. 专业水准（10分）- 是否达到顶级PE机构标准

通过标准：总分90分以上，且各项都不低于80%

输出JSON格式：
{
  "overall_score": 总分（0-100）,
  "pass": true/false,
  "dimension_scores": {
    "completeness": 25,
    "depth": 25, 
    "accuracy": 25,
    "structure": 15,
    "professionalism": 10
  },
  "critical_issues": [
    {
      "category": "问题类别",
      "description": "具体问题描述",
      "severity": "critical/major/minor",
      "impact": "对报告质量的影响",
      "solution": "建议的解决方案"
    }
  ],
  "missing_elements": ["缺失的重要元素"],
  "excellence_gaps": ["距离卓越标准的差距"],
  "recommendations": ["具体改进建议"],
  "next_iteration_focus": ["下轮迭代的重点"]
}`;

    const result = await generateWithThinking(model, prompt, 'HIGH');
    const text = result.text;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse excellence validation:', e);
            return { pass: false, overall_score: 0, critical_issues: ["解析失败"] };
        }
    }
    return { pass: false, overall_score: 0, critical_issues: ["验证失败"] };
}

// Enhanced Agent 6: Intelligent Report Enricher
export async function intelligentEnrichment(report, architecturedInfo, verificationResults, transcript, fileUris, model) {
    const contentParts = [
        { text: `你是一位顶级的信息增强专家，专门负责在原始资料中深度挖掘遗漏信息并补充到报告中。

当前报告：
${report}

信息架构：
${JSON.stringify(architecturedInfo, null, 2)}

验证结果：
${JSON.stringify(verificationResults, null, 2)}

原始访谈：
${transcript}` }
    ];
    
    if (fileUris && fileUris.length > 0) {
        contentParts.push({ text: '\n\n请在以下原始文档中搜索补充信息：' });
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

增强任务：
1. 基于验证结果中的缺失元素，在原始资料中搜索相关信息
2. 深度挖掘隐含信息和未充分利用的数据点
3. 寻找支持现有论断的更多证据
4. 发现潜在的风险点和机会点
5. 补充行业对比和benchmarking信息
6. 加强数据的上下文说明
7. 提供更深层次的业务洞察

输出JSON格式：
{
  "content_additions": [
    {
      "section": "目标章节",
      "subsection": "子章节（如有）",
      "new_content": "要添加的详细内容",
      "insertion_point": "插入位置描述",
      "source": "信息来源",
      "importance": "high/medium/low",
      "evidence_strength": "strong/moderate/weak"
    }
  ],
  "content_enhancements": [
    {
      "original_text": "原文段落",
      "enhanced_text": "增强后的段落",
      "enhancements_made": ["具体的增强内容"],
      "sources_added": ["新增的信息来源"]
    }
  ],
  "new_insights": [
    {
      "insight": "新发现的洞察",
      "supporting_evidence": ["支持证据"],
      "business_impact": "商业影响分析",
      "recommended_section": "建议放置的章节"
    }
  ],
  "data_enrichment": [
    {
      "data_point": "数据点",
      "additional_context": "补充的上下文",
      "benchmarking": "行业对比信息",
      "trend_analysis": "趋势分析"
    }
  ]
}` });

    const result = await generateWithFilesAndThinking(model, contentParts, 'VERY_HIGH');
    const text = result.text;
    
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

// Enhanced Agent 7: Master Content Integrator
export async function integrateEnhancements(report, enrichmentData, model) {
    const prompt = `你是一位顶级的内容整合专家。请将增强数据无缝整合到报告中，确保内容流畅自然。

原始报告：
${report}

增强数据：
${JSON.stringify(enrichmentData, null, 2)}

整合要求：
1. 将所有content_additions按重要性和逻辑顺序插入到合适位置
2. 应用所有content_enhancements，确保文本流畅
3. 整合所有new_insights，放置到最合适的章节
4. 丰富所有数据点的上下文说明
5. 为所有新增重要信息添加来源标注（格式：（来源：XXX））
6. 确保整体报告的逻辑连贯性和专业性
7. 保持原有的章节结构，但可以新增子章节

请输出完整的整合后报告。`;

    const result = await generateWithThinking(model, prompt, 'HIGH');
    return result.text;
}

// Enhanced Agent 8: Professional Formatter with Excellence Standards
export async function excellenceFormatter(report, model) {
    const prompt = `你是一位顶级的专业报告格式化专家，专门为全球顶级PE机构制作投资报告。

报告内容：
${report}

格式化要求（必须严格遵循）：

1) 章节结构标准：
- 主章节：【章节名称】前空2行，后空1行
- 一级子章节：直接写标题（如：公司概述），前后各空1行
- 二级子章节：可以使用缩进或编号

2) 内容组织标准：
- 每个段落聚焦一个主题
- 段落之间空1行
- 重要数据用（）标注来源
- 时间信息要准确完整
- 数字要包含单位和时间点

3) 专业表达标准：
- 使用规范的商业术语
- 避免口语化表达
- 保持客观、专业的语调
- 确保逻辑清晰、层次分明

4) 数据呈现标准：
- 财务数据要完整（金额+时间+增长率）
- 市场数据要有对比和背景
- 关键指标要突出显示
- 趋势分析要有数据支撑

5) 质量检查标准：
- 确保没有重复内容
- 验证数据的一致性
- 检查专业术语的准确性
- 保证引用的完整性

请输出格式化后的完整报告，确保达到顶级PE机构的标准。`;

    const result = await generateWithThinking(model, prompt, 'MEDIUM');
    return result.text;
}

// Enhanced Agent 9: Final Quality Assurance Inspector
export async function finalQualityInspection(report, originalTranscript, architecturedInfo, model) {
    const prompt = `你是一位资深的质量保证总监，负责确保报告达到出版级别的质量标准。

最终报告：
${report}

原始访谈：
${originalTranscript.substring(0, 10000)}...

信息架构：
${JSON.stringify(architecturedInfo, null, 2)}

最终检查任务：
1. 全面质量审核 - 检查内容完整性、准确性、专业性
2. 一致性验证 - 确保报告内数据和表述的一致性
3. 逻辑完整性 - 验证报告结构和论证逻辑
4. 专业标准 - 确保达到顶级PE机构标准
5. 可读性优化 - 确保报告易读且专业

输出JSON格式：
{
  "final_score": 总分（0-100），
  "quality_assessment": {
    "content_completeness": 分数,
    "accuracy": 分数,
    "professionalism": 分数,
    "structure": 分数,
    "readability": 分数
  },
  "approval_status": "approved/needs_revision",
  "critical_findings": [
    {
      "issue": "问题描述",
      "severity": "critical/major/minor",
      "location": "问题位置",
      "fix_required": "是否必须修复"
    }
  ],
  "recommendations": ["最终建议"],
  "executive_summary": "报告质量的执行摘要",
  "sign_off": true/false
}`;

    const result = await generateWithThinking(model, prompt, 'HIGH');
    const text = result.text;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse final inspection:', e);
            return { sign_off: false, final_score: 0, approval_status: "needs_revision" };
        }
    }
    return { sign_off: false, final_score: 0, approval_status: "needs_revision" };
}