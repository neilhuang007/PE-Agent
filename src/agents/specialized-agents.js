// Specialized Sub-Agents for Deep Topic Extraction

// Data Processing Specialist Agent
export async function extractDataSpecialization(content, model) {
    const prompt = `你是一位数据工程和数据科学专家，专门分析企业的数据处理能力。

内容分析：
${content}

专业提取任务（数据处理专项）：

1. **数据来源与类型**
   - 数据来源：内部系统、外部接口、第三方数据供应商
   - 数据类型：结构化、半结构化、非结构化数据
   - 数据格式：JSON、XML、CSV、API等
   - 数据量级：具体数据量（TB、GB、条数等）

2. **数据处理流程**
   - 数据采集方式和频率
   - 数据清洗和预处理方法
   - 数据存储架构（数据库类型、分布式存储等）
   - 数据处理工具和技术栈

3. **数据分析与应用**
   - 数据分析方法和算法
   - 机器学习模型应用
   - 数据可视化工具
   - 数据驱动的业务决策案例

4. **数据安全与合规**
   - 数据加密方法
   - 访问控制机制
   - 数据备份和恢复策略
   - 隐私保护措施和合规标准

响应风格：
- 提取具体的技术名称、数据量、处理速度
- 关注数据流转的具体环节和时间周期
- 识别数据团队规模和专业背景
- 量化数据处理能力和业务价值

输出格式：
【数据基础设施】
- 数据存储：具体容量和架构
- 处理能力：具体性能指标
- 技术栈：具体工具和平台

【数据业务应用】
- 应用场景：具体业务用途
- 价值创造：量化业务收益
- 客户服务：数据驱动的服务提升`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error in data specialization:', error);
        return `数据专项提取失败: ${error.message}`;
    }
}

// Technology Architecture Specialist Agent
export async function extractTechnologySpecialization(content, model) {
    const prompt = `你是一位首席技术官(CTO)级别的技术架构专家，专门评估企业技术实力。

内容分析：
${content}

技术架构专项提取：

1. **核心技术栈**
   - 开发语言和框架选择及原因
   - 数据库类型和版本
   - 云服务平台和基础设施
   - 系统架构模式（微服务、单体等）

2. **技术团队与能力**
   - 技术负责人背景和经验
   - 开发团队规模和技能分布
   - 技术招聘需求和人才策略
   - 技术培训和能力建设投入

3. **技术创新与研发**
   - 研发投入占比和绝对金额
   - 专利申请数量和技术领域
   - 技术创新项目和突破点
   - 开源贡献和技术影响力

4. **系统性能与扩展性**
   - 系统处理能力和并发量
   - 系统可用性和稳定性指标
   - 扩展性设计和未来规划
   - 技术债务和优化计划

响应风格：
- 提取具体的技术指标和性能数据
- 关注技术选型的商业逻辑和成本考量
- 评估技术团队的实际交付能力
- 识别技术壁垒和竞争优势

输出格式：
【技术实力评估】
- 核心技术：具体技术和应用深度
- 团队能力：人员规模和技能等级
- 创新能力：研发投入和创新成果`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error in technology specialization:', error);
        return `技术专项提取失败: ${error.message}`;
    }
}

// Financial Analysis Specialist Agent
export async function extractFinancialSpecialization(content, model) {
    const prompt = `你是一位资深的财务分析师和投资银行家，专门进行企业财务尽调。

内容分析：
${content}

财务专项深度提取：

1. **收入分析**
   - 总收入及增长趋势（具体数字和增长率）
   - 收入来源构成和占比
   - 客户集中度和大客户依赖风险
   - 收入确认政策和季节性波动

2. **成本结构分析**
   - 成本构成详细分解
   - 毛利率变化趋势和驱动因素
   - 可变成本与固定成本比例
   - 成本控制措施和效果

3. **盈利能力分析**
   - 毛利率、营业利润率、净利率
   - EBITDA和调整后EBITDA
   - 盈利质量和现金流匹配度
   - 盈利能力同行对比

4. **财务健康度**
   - 资产负债结构和杠杆率
   - 现金流状况和现金覆盖倍数
   - 应收账款周转和坏账风险
   - 财务风险控制措施

响应风格：
- 提取所有具体财务数字和时间节点
- 计算关键财务比率和趋势分析
- 识别财务风险点和预警信号
- 对比行业标准和竞争对手表现

输出格式：
【财务表现总览】
- 收入规模：具体金额和增长率
- 盈利水平：关键利润指标
- 现金状况：现金流和资金安全性

【财务风险评估】
- 风险点：具体财务风险
- 缓解措施：风险控制策略`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error in financial specialization:', error);
        return `财务专项提取失败: ${error.message}`;
    }
}

// Customer Analysis Specialist Agent  
export async function extractCustomerSpecialization(content, model) {
    const prompt = `你是一位客户成功和市场研究专家，专门分析企业的客户价值和市场表现。

内容分析：
${content}

客户专项深度分析：

1. **客户构成分析**
   - 客户总数和活跃客户数
   - 客户分类和分层结构
   - 大客户名单和收入贡献
   - 客户地域分布和行业分布

2. **客户获取与增长**
   - 新客户获取速度和成本
   - 客户获取渠道和效果
   - 客户推荐和口碑传播
   - 市场营销投入和ROI

3. **客户留存与价值**
   - 客户留存率和流失率
   - 客户生命周期价值(LTV)
   - 客户满意度和NPS评分
   - 续约率和增购率

4. **客户服务与支持**
   - 客户服务团队规模和结构
   - 服务响应时间和解决率
   - 客户反馈处理机制
   - 客户成功案例和效果

响应风格：
- 提取所有客户相关的具体数据和指标
- 关注客户质量而非仅仅数量
- 分析客户价值创造的具体路径
- 识别客户风险和增长机会

输出格式：
【客户价值分析】
- 客户规模：数量和质量指标
- 客户贡献：收入占比和增长贡献
- 客户粘性：留存和忠诚度指标`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error in customer specialization:', error);
        return `客户专项提取失败: ${error.message}`;
    }
}