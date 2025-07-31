import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';
import { initGeminiClient, generateWithRetry, convertContentParts } from './src/utils/gemini-wrapper.js';
import { uploadFile, deleteFile } from './src/utils/gemini-wrapper.js';
import { 
    deepExtractChunk, 
    verifyCitations,
    validateExcellence,
    comprehensiveBPAnalysis
} from './src/agents/enhanced-agents.js';
import { 
    fastExtractChunk, 
    fastComposeReport, 
    fastQualityCheck, 
    fastFormatReport 
} from './src/agents/fast-agents.js';
import { detectAndRemoveBias } from './src/agents/bias-detection-agent.js';
import { orchestrateMasterSubAgentSystem } from './master-subagent-system.js';
import { chunkTranscript, updateProgress, getApiKey, saveApiKey, downloadReport, compactChineseBullets, assembleRawDraft } from './src/utils/utils.js';
import { finalReportFormatter, quickFinalFormatter, formatForDisplay } from './src/agents/final-formatter.js';

let currentReport = '';
let allUploadedFiles = []; // Store all uploaded files across multiple sessions
let isUploadInProgress = false; // Track upload status

// Progress stepper data storage with sub-cards support
let stepperData = {
    'step-document-analysis': {
        title: '文档分析',
        data: '',
        subCards: [], // Array of data for each sub-step (e.g., each document analyzed)
        startTime: null,
        endTime: null
    },
    'step-chunk-extraction': {
        title: '内容提取',
        data: '',
        subCards: [], // Array of data for each chunk extracted
        startTime: null,
        endTime: null
    },
    'step-report-generation': {
        title: '报告生成',
        data: '',
        subCards: [], // Array of data for each generation phase
        startTime: null,
        endTime: null
    },
    'step-enhancement': {
        title: '内容增强',
        data: '',
        subCards: [], // Array of data for each enhancement task
        startTime: null,
        endTime: null
    },
    'step-finalization': {
        title: '最终处理',
        data: '',
        subCards: [], // Array of data for each finalization step
        startTime: null,
        endTime: null
    }
};

// Step details modal state
let currentStepId = '';
let currentCardIndex = 0;

// Progress stepper control functions
function updateStepper(stepId, status, data = '', subCardData = null) {
    const step = document.getElementById(stepId);
    const circle = step.querySelector('.stepper-circle');
    const statusElement = step.querySelector('.stepper-status');
    const timeElement = step.querySelector('.stepper-time');
    
    // Remove existing status classes
    step.classList.remove('stepper-pending', 'stepper-active', 'stepper-completed');
    
    // Store data for this step
    if (data) {
        stepperData[stepId].data = data;
    }
    
    // Add sub-card data if provided
    if (subCardData) {
        stepperData[stepId].subCards.push(subCardData);
    }
    
    const now = new Date();
    
    switch (status) {
        case 'active':
            step.classList.add('stepper-active');
            statusElement.textContent = '处理中';
            timeElement.textContent = `开始时间: ${now.toLocaleTimeString()}`;
            stepperData[stepId].startTime = now;
            break;
        case 'completed':
            step.classList.add('stepper-completed');
            circle.innerHTML = `
                <svg viewBox="0 0 16 16" class="bi bi-check-lg" fill="currentColor" height="16" width="16">
                    <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path>
                </svg>
            `;
            statusElement.textContent = '已完成';
            stepperData[stepId].endTime = now;
            const duration = stepperData[stepId].startTime ? 
                Math.round((now.getTime() - stepperData[stepId].startTime.getTime()) / 1000) : 0;
            timeElement.textContent = `完成于 ${now.toLocaleTimeString()} (${duration}秒)`;
            break;
        case 'pending':
        default:
            step.classList.add('stepper-pending');
            statusElement.textContent = '待处理';
            timeElement.textContent = '等待开始...';
            break;
    }
}

function showStepperCard() {
    document.getElementById('progressStepperCard').style.display = 'block';
}

function hideStepperCard() {
    document.getElementById('progressStepperCard').style.display = 'none';
}

function resetStepper() {
    const steps = ['step-document-analysis', 'step-chunk-extraction', 'step-report-generation', 'step-enhancement', 'step-finalization'];
    steps.forEach(stepId => {
        updateStepper(stepId, 'pending');
        stepperData[stepId].data = '';
        stepperData[stepId].subCards = [];
        stepperData[stepId].startTime = null;
        stepperData[stepId].endTime = null;
        // Reset circle content for all steps
        const circle = document.getElementById(stepId).querySelector('.stepper-circle');
        const stepNumber = steps.indexOf(stepId) + 1;
        circle.textContent = stepNumber;
    });
}

// Step details modal functions
window.showStepDetails = function(stepId) {
    const stepInfo = stepperData[stepId];
    if (!stepInfo) return;
    
    currentStepId = stepId;
    currentCardIndex = 0;
    
    const modal = document.getElementById('stepDetailsModal');
    const title = document.getElementById('stepDetailsTitle');
    
    title.textContent = `${stepInfo.title} - 详细信息`;
    
    updateStepDetailsContent();
    modal.style.display = 'block';
}

window.closeStepDetailsModal = function() {
    document.getElementById('stepDetailsModal').style.display = 'none';
}

window.navigateStepCards = function(direction) {
    const stepInfo = stepperData[currentStepId];
    if (!stepInfo) return;
    
    const totalCards = Math.max(1, stepInfo.subCards.length);
    currentCardIndex += direction;
    
    // Wrap around
    if (currentCardIndex < 0) {
        currentCardIndex = totalCards - 1;
    } else if (currentCardIndex >= totalCards) {
        currentCardIndex = 0;
    }
    
    updateStepDetailsContent();
}

function updateStepDetailsContent() {
    const stepInfo = stepperData[currentStepId];
    if (!stepInfo) return;
    
    const content = document.getElementById('stepDetailsContent');
    const indicator = document.getElementById('stepCardIndicator');
    const prevBtn = document.getElementById('prevStepCard');
    const nextBtn = document.getElementById('nextStepCard');
    
    let cardContent = '';
    let totalCards = Math.max(1, stepInfo.subCards.length);
    
    if (stepInfo.subCards.length > 0) {
        const currentCard = stepInfo.subCards[currentCardIndex];
        cardContent = `<div class="step-card-content">
            <h4>子任务 ${currentCardIndex + 1}</h4>
            <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 8px; border: 1px solid #ddd; max-height: 400px; overflow-y: auto;">${currentCard}</pre>
        </div>`;
    } else {
        // Show general step data or status message
        if (stepInfo.data) {
            cardContent = `<div class="step-card-content">
                <h4>总体信息</h4>
                <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 8px; border: 1px solid #ddd; max-height: 400px; overflow-y: auto;">${stepInfo.data}</pre>
            </div>`;
        } else {
            cardContent = `<div class="step-card-content">
                <h4>状态信息</h4>
                <p style="padding: 20px; text-align: center; color: #666;">该步骤暂无详细数据</p>
            </div>`;
        }
    }
    
    content.innerHTML = cardContent;
    indicator.textContent = `${currentCardIndex + 1} / ${totalCards}`;
    
    // Enable/disable navigation buttons
    prevBtn.disabled = totalCards <= 1;
    nextBtn.disabled = totalCards <= 1;
}

// Placeholder functions for file upload/delete until proper implementation
async function uploadFileToGemini(file, apiKey) {
    // Delegate to the wrapper helper and reformat the return value.
    const uploaded = await uploadFile(file);
    return {
        displayName: file.name,
        mimeType: file.type,
        uri: uploaded.uri,
        name: uploaded.name,
        // state is optional but returned from the wrapper
        state: uploaded.state
    };
}


async function deleteFileFromGemini(name, apiKey) {
    await deleteFile(name);
    return true;
}



// Initialize Gemini AI
function initializeGemini() {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('请输入您的 Gemini API Key');
        return null;
    }
    saveApiKey(apiKey);
    
    // Initialize the TypeScript Gemini client for file uploads if not already done
    try {
        initGeminiClient(apiKey);
        console.log('✅ Gemini client initialized for file uploads');
    } catch (error) {
        console.error('❌ Failed to initialize Gemini client:', error);
    }
    
    return new GoogleGenerativeAI(apiKey);
}

// Generate report
async function generateReport(e) {
    e.preventDefault();
    
    // Check if uploads are still in progress
    if (isUploadInProgress) {
        alert('文件正在上传中，请等待上传完成后再生成报告');
        return;
    }
    
    const genAI = initializeGemini();
    if (!genAI) return;
    
    // Gemini client is already initialized in initializeGemini() or on API key input
    
    const generateBtn = document.getElementById('generateBtn');
    const progressContainer = document.getElementById('progressContainer');
    const reportOutput = document.getElementById('reportOutput');
    const downloadBtn = document.getElementById('downloadBtn');
    
    generateBtn.disabled = true;
    progressContainer.style.display = 'block';
    
    // Show and reset stepper
    showStepperCard();
    resetStepper();
    
    try {
        // Use Gemini 2.5 Pro with native thinking support
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: {
                thinkingConfig: {
                    thinkingBudget: -1, // Dynamic thinking
                    includeThoughts: false // We don't need thought summaries for better performance
                }
            }
        });
        
        const companyName = document.getElementById('companyName').value;
        const transcript = document.getElementById('transcript').value;
        const isSpeedMode = document.getElementById('speedMode').checked;
        const showProcessDetails = document.getElementById('showProcessDetails').checked;
        
        // Visualization elements
        const processVisualization = document.getElementById('processVisualization');
        const businessPlanDataDiv = document.getElementById('businessPlanData');
        const extractedInfoDiv = document.getElementById('extractedInfo');
        const initialDraftDiv = document.getElementById('initialDraft');
        const subagentTasksDiv = document.getElementById('subagentTasks');
        const enhancementDetailsDiv = document.getElementById('enhancementDetails');
        
        // Hide old process visualization since we now use the stepper
        processVisualization.style.display = 'none';
        
        // Step 1: Use already uploaded files (files are processed immediately when selected)
        updateProgress(10, `使用已上传的 ${allUploadedFiles.length} 个文档开始分析...`);
        
        // Step 2: Document Analysis FIRST (wait for completion before chunk extraction)
        updateStepper('step-document-analysis', 'active');
        let combinedAnalyses = '';
        let fileSummaries = [];
        if (allUploadedFiles.length > 0) {
            console.log('📁 传递给BP分析的文件:', allUploadedFiles.map(f => f.displayName));
            updateProgress(20, `📄 正在深度分析 ${allUploadedFiles.length} 个文档（每个文档独立处理）...`);
            try {
                // Create callback to update stepper as files complete
                const fileAnalysisCallback = (fileIndex, fileName, analysis) => {
                    const fileAnalysis = `文件: ${fileName}\n分析结果: 已成功处理\n类型: ${allUploadedFiles[fileIndex]?.mimeType || 'unknown'}\n\n提取内容预览:\n${analysis.substring(0, 500)}...`;
                    updateStepper('step-document-analysis', 'active', '', fileAnalysis);
                    console.log(`✅ 文件 ${fileIndex + 1} 分析完成: ${fileName} - ${analysis.length} 字符`);
                };
                
                const bpResult = await comprehensiveBPAnalysis(allUploadedFiles, model, genAI, fileAnalysisCallback);
                combinedAnalyses = bpResult.combinedAnalyses;
                fileSummaries = bpResult.fileSummaries;
                updateProgress(25, `✅ 文档分析完成 - 提取了 ${combinedAnalyses.length} 字符的结构化数据`);
                
                updateStepper('step-document-analysis', 'completed', `已分析 ${allUploadedFiles.length} 个文档，提取了 ${combinedAnalyses.length} 字符的结构化数据`);
                
                // Display business plan analysis if visualization is enabled
                if (showProcessDetails && combinedAnalyses) {
                    displayBusinessPlanData(combinedAnalyses, businessPlanDataDiv);
                }
                
                // Add delay to show this step completion before moving to next
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error('商业计划书分析失败:', error);
                updateProgress(25, '⚠️ 商业计划书分析失败，继续处理');
                updateStepper('step-document-analysis', 'completed', `文档分析遇到错误: ${error.message}`);
            }
        } else {
            updateStepper('step-document-analysis', 'completed', '无上传文档，跳过分析步骤');
        }
        
        // Step 3: NOW chunk and extract with BP context available
        updateStepper('step-chunk-extraction', 'active');
        updateProgress(30, isSpeedMode ? '⚡ 快速模式：优化处理流程...' : '🔍 开始深度分析访谈内容...');
        const chunks = chunkTranscript(transcript);
        updateProgress(35, `已将访谈内容分成${chunks.length}个片段`, 
            chunks.map((c, i) => `片段${i+1}: ${c.substring(0, 50)}...`).join('<br>'));
        
        let extractedChunks, organizedInfo, localReport, architecturedInfo, rawDraft;
        
        if (isSpeedMode) {
            // FAST MODE: Use gemini-2.5-flash-lite with thinking budget 0 for speed
            const fastModel = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash-lite",
                generationConfig: {
                    thinkingConfig: {
                        thinkingBudget: 0, // No thinking for maximum speed
                        includeThoughts: false
                    }
                }
            });
            
            updateProgress(40, '⚡ 快速并行信息提取...');
            
            // Use faster extraction method with BP context and fast model - process individually for immediate results
            extractedChunks = [];
            const fastExtractionPromises = chunks.map(async (chunk, i) => {
                try {
                    const result = await fastExtractChunk(chunk, i, combinedAnalyses, fastModel);
                    extractedChunks[i] = result;
                    
                    // Add chunk result immediately when it completes
                    const chunkData = `片段 ${i + 1}:\n原始内容: ${chunk.substring(0, 200)}...\n\n提取结果:\n${result}`;
                    updateStepper('step-chunk-extraction', 'active', '', chunkData);
                    
                    console.log(`✅ 片段 ${i + 1} 提取完成 - ${result.length} 字符`);
                    return result;
                } catch (error) {
                    console.error(`Error in fast processing chunk ${i + 1}:`, error);
                    const errorResult = `片段 ${i + 1} 快速处理失败: ${error.message}`;
                    extractedChunks[i] = errorResult;
                    return errorResult;
                }
            });
            
            await Promise.all(fastExtractionPromises);
            updateProgress(55, `✅ 快速提取完成 (${chunks.length}个片段并行处理)`);
            
            
            updateStepper('step-chunk-extraction', 'completed', `已快速提取 ${chunks.length} 个片段的内容`);
            
            // Display extracted information if visualization is enabled
            if (showProcessDetails) {
                displayExtractedInfo(extractedChunks, extractedInfoDiv);
            }
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Fast report generation directly from extracted chunks
            updateStepper('step-report-generation', 'active');
            updateProgress(60, '⚡ 快速报告生成...');
            
            // Generate report directly from raw data (no intermediate organization step)
            const rawData = extractedChunks.join('\n\n') + (combinedAnalyses ? `\n\n${combinedAnalyses}` : '');
            localReport = await fastComposeReport(rawData, companyName, fastModel);
            
            // Add report generation details as sub-card
            const reportGenData = `快速报告生成:\n公司名称: ${companyName}\n原始数据长度: ${rawData.length} 字符\n生成的报告长度: ${localReport.length} 字符\n\n生成的报告:\n${localReport}...`;
            updateStepper('step-report-generation', 'active', '', reportGenData);
            updateStepper('step-report-generation', 'completed', `已生成初始报告，长度: ${localReport.length} 字符`);
            
            // Set empty organizedInfo since we're not using organize step
            organizedInfo = {};
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Display initial draft if visualization is enabled
            if (showProcessDetails) {
                displayInitialDraft(localReport, initialDraftDiv);
            }
            
            // Fast quality and formatting pipeline (no subagent enhancement for speed)
            updateStepper('step-enhancement', 'active');
            updateProgress(85, '⚡ 快速质量检查和格式化...');
            const [qualityResult, formattedReport] = await Promise.all([
                fastQualityCheck(localReport, transcript, combinedAnalyses, fastModel),
                detectAndRemoveBias(localReport, fastModel).then(debiased => 
                    fastFormatReport(debiased, fastModel)
                )
            ]);
            
            // Add quality check details as sub-card
            const qualityData = `快速质量检查:\n质量评分: ${qualityResult?.score || 'N/A'}/100\n检查项目: 内容完整性、引用准确性\n状态: 快速模式，跳过深度增强\n\n质量报告详情:\n${JSON.stringify(qualityResult, null, 2)}`;
            updateStepper('step-enhancement', 'active', '', qualityData);
            
            // Add bias detection details as sub-card
            const biasData = `偏向性检测:\n原始报告长度: ${localReport.length} 字符\n检测结果: 已检查并移除潜在偏向性内容\n处理模式: 快速模式`;
            updateStepper('step-enhancement', 'active', '', biasData);
            
            updateStepper('step-enhancement', 'completed', `快速模式跳过深度增强，质量评分: ${qualityResult?.score || 'N/A'}/100`);
            
            if (formattedReport && typeof formattedReport === 'string') {
                localReport = formattedReport;
            }
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Final formatting for fast mode
            updateStepper('step-finalization', 'active');
            updateProgress(95, '📝 最终格式化...');
            const finalFormattedReport = await quickFinalFormatter(localReport, fastModel);
            
            // Add final formatting details as sub-card
            const finalData = `最终格式化 (快速模式):\n格式化前长度: ${localReport.length} 字符\n格式化后长度: ${finalFormattedReport?.length || localReport.length} 字符\n处理类型: 快速最终格式化\n\n格式化结果预览:\n${(finalFormattedReport || localReport).substring(0, 300)}...`;
            updateStepper('step-finalization', 'active', '', finalData);
            
            if (finalFormattedReport && typeof finalFormattedReport === 'string') {
                localReport = finalFormattedReport;
            }
            updateStepper('step-finalization', 'completed', `最终格式化完成，报告长度: ${localReport.length} 字符`);
            
            architecturedInfo = organizedInfo; // Set for technical terms
            updateProgress(98, `✅ 快速模式完成 - 质量评分: ${qualityResult?.score || 'N/A'}/100`);
            
        } else {
            // ENHANCED MODE: Full quality pipeline with dynamic analysis
            updateProgress(40, '🔍 深度分析处理...');
            
            // Process chunks individually for immediate results display
            extractedChunks = [];
            const extractionPromises = chunks.map(async (chunk, i) => {
                try {
                    const result = await deepExtractChunk(chunk, i, transcript, combinedAnalyses, allUploadedFiles, model);
                    extractedChunks[i] = result;
                    
                    // Add chunk result immediately when it completes
                    const chunkData = `片段 ${i + 1}:\n原始内容: ${chunk.substring(0, 200)}...\n\n提取结果:\n${result}`;
                    updateStepper('step-chunk-extraction', 'active', '', chunkData);
                    
                    console.log(`✅ 片段 ${i + 1} 深度提取完成 - ${result.length} 字符`);
                    return result;
                } catch (error) {
                    console.error(`Error processing chunk ${i + 1}:`, error);
                    const errorResult = `片段 ${i + 1} 处理失败: ${error.message}`;
                    extractedChunks[i] = errorResult;
                    return errorResult;
                }
            });
            
            await Promise.all(extractionPromises);
            updateProgress(55, `✅ 深度分析完成`);
            
            
            updateStepper('step-chunk-extraction', 'completed', `已深度提取 ${chunks.length} 个片段的内容`);
            
            // Display extracted information if visualization is enabled
            if (showProcessDetails) {
                displayExtractedInfo(extractedChunks, extractedInfoDiv);
            }
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Generate report directly from extracted chunks (no need for architect step)
            updateStepper('step-report-generation', 'active');
            updateProgress(58, '📊 直接生成报告...');
            rawDraft = assembleRawDraft(extractedChunks, combinedAnalyses);
            localReport = await finalReportFormatter(rawDraft, model);
            
            // Add report generation details as sub-card
            const reportGenData = `深度报告生成:\n原始草稿长度: ${rawDraft.length} 字符\n格式化后报告长度: ${localReport.length} 字符\n\n生成的报告预览:\n${localReport.substring(0, 500)}...`;
            updateStepper('step-report-generation', 'active', '', reportGenData);
            updateStepper('step-report-generation', 'completed', `已生成深度分析报告，长度: ${localReport.length} 字符`);
            
            // Set empty organizedInfo since we're not using architect step
            organizedInfo = {};
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Display initial draft if visualization is enabled
            if (showProcessDetails) {
                displayInitialDraft(localReport, initialDraftDiv);
            }
            
            // Master-SubAgent enhancement 
            updateStepper('step-enhancement', 'active');
            updateProgress(65, '🎯 启动主-子代理深度增强...');
            
            // Create visualization callback to capture subagent data for stepper
            const visualizationCallback = (type, data) => {
                if (type === 'tasks') {
                    // Store subagent tasks as sub-cards
                    if (data && data.enhancement_tasks) {
                        data.enhancement_tasks.forEach((task, index) => {
                            const taskData = `任务 ${index + 1}: ${task.research_task}\n优先级: ${task.priority}\n增强重点: ${task.enhancement_focus}\n期望改进: ${task.expected_improvement}\n\n原始片段:\n${task.original_quote}`;
                            updateStepper('step-enhancement', 'active', '', taskData);
                        });
                    }
                    
                    // Also display in old visualization if enabled
                    if (showProcessDetails) {
                        displaySubagentTasks(data, subagentTasksDiv);
                    }
                } else if (type === 'enhancements') {
                    // Store enhancement results as additional sub-cards
                    if (data && Array.isArray(data)) {
                        data.forEach((result, index) => {
                            const enhancementData = `增强结果 ${index + 1}:\n任务: ${result.research_task}\n优先级: ${result.priority}\n\n原始内容 (${result.original_quote.length} 字符):\n${result.original_quote}\n\n增强内容 (${result.enhanced_content.length} 字符):\n${result.enhanced_content}${result.error ? '\n\n错误: ' + result.error : ''}`;
                            updateStepper('step-enhancement', 'active', '', enhancementData);
                        });
                    }
                    
                    // Also display in old visualization if enabled
                    if (showProcessDetails) {
                        displayEnhancementDetails(data, enhancementDetailsDiv);
                    }
                }
            };
            
            const enhancedReport = await orchestrateMasterSubAgentSystem(localReport, transcript, allUploadedFiles, model, visualizationCallback);
            if (enhancedReport && typeof enhancedReport === 'string') {
                localReport = enhancedReport;
                updateProgress(75, '📊 增强报告生成完成', `报告长度：${localReport.length} 字符`);
                updateStepper('step-enhancement', 'completed', `主-子代理增强完成，报告长度: ${localReport.length} 字符`);
            } else {
                console.warn('⚠️ 深度增强失败，保持原报告');
                updateProgress(75, '⚠️ 深度增强跳过，保持原报告', `报告长度：${localReport.length} 字符`);
                updateStepper('step-enhancement', 'completed', `深度增强失败，保持原报告长度: ${localReport.length} 字符`);
            }
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Set architecturedInfo for technical terms (empty since we removed architect step)
            architecturedInfo = {};
            
            // Quality Control (skipping datapoint existence check per optimization)
            updateProgress(80, '🔍 质量控制...');
            try {
                // Citation Verification with all data sources
                const citationVerification = await verifyCitations(localReport, transcript, combinedAnalyses, fileSummaries, allUploadedFiles, model);
                if (!citationVerification.verified && citationVerification.issues?.length > 0) {
                    console.warn('⚠️ 引用验证发现问题:', citationVerification.issues);
                }

                // Excellence Validation with comprehensive data
                const excellenceValidation = await validateExcellence(localReport, transcript, combinedAnalyses, allUploadedFiles, model);
                if (excellenceValidation.score < 80) {
                    console.warn('⚠️ 质量评分较低:', excellenceValidation.score);
                }
                
                // Add quality control details as sub-card for finalization step
                const qualityControlData = `质量控制验证:\n引用验证状态: ${citationVerification.verified ? '通过' : '存在问题'}\n${citationVerification.issues?.length > 0 ? '发现的问题:\n' + citationVerification.issues.join('\n') + '\n' : ''}卓越性评分: ${excellenceValidation.score || 'N/A'}/100\n验证数据源: ${allUploadedFiles.length} 个文件\n转录文本长度: ${transcript.length} 字符`;
                updateStepper('step-finalization', 'active', '', qualityControlData);
                
                updateProgress(85, `✅ 验证完成 - 质量评分: ${excellenceValidation.score || 'N/A'}/100`);
            } catch (error) {
                console.error('验证过程出错:', error);
                updateProgress(85, '⚠️ 验证过程出错，继续处理');
                
                // Add error details as sub-card
                const errorData = `质量控制错误:\n错误信息: ${error.message}\n堆栈跟踪: ${error.stack?.substring(0, 500) || '无'}`;
                updateStepper('step-finalization', 'active', '', errorData);
            }
            
            // Bias Detection and Professional Formatting
            updateProgress(90, '正在进行偏向性检测和专业格式化...');
            try {
                const debiasedReport = await detectAndRemoveBias(localReport, model);
                
                // Add bias detection details as sub-card
                const biasDetectionData = `偏向性检测 (深度模式):\n原始报告长度: ${localReport.length} 字符\n处理后长度: ${debiasedReport?.length || localReport.length} 字符\n检测状态: ${debiasedReport ? '成功检测并移除偏向性' : '检测失败，保持原报告'}\n处理模式: 深度分析模式`;
                updateStepper('step-finalization', 'active', '', biasDetectionData);
                
                if (debiasedReport && typeof debiasedReport === 'string') {
                    localReport = debiasedReport;
                } else {
                    console.warn('⚠️ 偏向性检测失败，保持原报告');
                }
                
                // Note: Formatting will be done in final step to avoid redundancy
            } catch (error) {
                console.error('格式化过程出错:', error);
                console.log('保持原报告继续');
                
                // Add error details as sub-card
                const biasErrorData = `偏向性检测错误:\n错误信息: ${error.message}\n状态: 保持原报告继续处理`;
                updateStepper('step-finalization', 'active', '', biasErrorData);
            }
            
            // Final professional formatting
            updateProgress(95, '📝 最终专业格式化...');
            try {
                const finalFormattedReport = await finalReportFormatter(localReport, model);
                
                // Add final formatting details as sub-card
                const finalFormattingData = `最终专业格式化 (深度模式):\n格式化前长度: ${localReport.length} 字符\n格式化后长度: ${finalFormattedReport?.length || localReport.length} 字符\n格式化状态: ${finalFormattedReport ? '成功完成专业格式化' : '格式化失败，保持原报告'}\n处理类型: 深度专业格式化\n\n最终报告预览:\n${(finalFormattedReport || localReport).substring(0, 400)}...`;
                updateStepper('step-finalization', 'active', '', finalFormattingData);
                
                if (finalFormattedReport && typeof finalFormattedReport === 'string') {
                    localReport = finalFormattedReport;
                }
                updateStepper('step-finalization', 'completed', `最终专业格式化完成，报告长度: ${localReport.length} 字符`);
            } catch (error) {
                console.error('最终格式化出错:', error);
                console.log('保持当前报告继续');
                
                // Add error details as sub-card
                const finalErrorData = `最终格式化错误:\n错误信息: ${error.message}\n状态: 保持当前报告继续\n最终报告长度: ${localReport.length} 字符`;
                updateStepper('step-finalization', 'active', '', finalErrorData);
                updateStepper('step-finalization', 'completed', `格式化出错但已保持报告: ${error.message}`);
            }
            
        }
        
        // Safety check for localReport
        if (!localReport || typeof localReport !== 'string') {
            console.error('报告生成失败: localReport is undefined or invalid');
            updateProgress(98, '❌ 报告生成失败', 'localReport无效');
            reportOutput.innerHTML = `<div class="error">报告生成失败：内部错误，请重试</div>`;
            return;
        }

        // Final steps - Add technical terms if available
        updateProgress(98, '✅ 报告生成完成!', 
            isSpeedMode ? '⚡ 快速模式大幅提升了处理速度' : '🔥 完整模式确保最高质量');
        
        const finalReport = localReport;
        
        // Add technical terms if any
        let reportWithTerms = finalReport;
        try {
            if (architecturedInfo && architecturedInfo.技术术语) {
                if (typeof architecturedInfo.技术术语 === 'object' && Object.keys(architecturedInfo.技术术语).length > 0) {
                    reportWithTerms += `\n\n\n【技术术语说明】\n`;
                    for (const [term, explanation] of Object.entries(architecturedInfo.技术术语)) {
                        reportWithTerms += `${term}: ${explanation}\n`;
                    }
                } else if (Array.isArray(architecturedInfo.技术术语) && architecturedInfo.技术术语.length > 0) {
                    reportWithTerms += `\n\n\n【技术术语说明】\n${architecturedInfo.技术术语.join('\n')}`;
                }
            }
        } catch (error) {
            console.log('Technical terms processing skipped:', error);
            // Continue without technical terms if there's an error
        }
        
        // Display report with proper HTML formatting
        updateProgress(100, '报告生成完成！');
        currentReport = reportWithTerms;
        
        // Format for display with proper HTML
        const htmlFormattedReport = formatForDisplay(reportWithTerms);
        reportOutput.innerHTML = htmlFormattedReport;
        downloadBtn.style.display = 'block';
        
        // Clean up uploaded files after 10 minutes (increased time for multiple sessions)
        if (allUploadedFiles.length > 0) {
            setTimeout(async () => {
                for (const file of allUploadedFiles) {
                    if (file.uri && !file.uri.startsWith('local_')) {
                        await deleteFileFromGemini(file.uri, getApiKey());
                    }
                }
                console.log('已清理上传的文件');
                allUploadedFiles = []; // Clear the array
                updateFilesList(); // Update UI
            }, 600000); // 10 minutes
        }
        
    } catch (error) {
        console.error('Error:', error);
        reportOutput.innerHTML = `<div class="error">生成报告时出错：${error.message}</div>`;
    } finally {
        generateBtn.disabled = false;
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);
    }
}

// Update files list display
function updateFilesList() {
    const filesList = document.getElementById('uploadedFilesList');
    if (allUploadedFiles.length === 0) {
        filesList.innerHTML = '';
        return;
    }
    
    filesList.innerHTML = `
        <h4>已上传文件 (${allUploadedFiles.length}):</h4>
        <ul style="margin: 10px 0; padding-left: 20px;">
            ${allUploadedFiles.map((file, index) => `
                <li style="margin: 5px 0;">
                    ${file.displayName} (${file.mimeType === 'text/plain' ? 'TXT' : 'PDF'})
                    <button onclick="removeFile(${index})" style="margin-left: 10px; color: red; border: none; background: none; cursor: pointer;">✕</button>
                </li>
            `).join('')}
        </ul>
    `;
}

// Remove a file from the uploaded files list
window.removeFile = async function (index) {
    const file = allUploadedFiles[index];
    if (file && file.uri && !file.uri.startsWith('local_') && file.name) {
        try {
            await deleteFileFromGemini(file.name, getApiKey());
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    }
    allUploadedFiles.splice(index, 1);
    updateFilesList();
};

// Process selected files immediately when chosen
async function processSelectedFiles(files) {
    const fileUploadStatus = document.getElementById('fileUploadStatus');
    const generateBtn = document.getElementById('generateBtn');
    
    // Set upload in progress and disable generate button
    isUploadInProgress = true;
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = '文件上传中...';
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        fileUploadStatus.innerHTML = `正在处理 ${file.name}...`;
        
        try {
            const uploadedFile = await uploadFileToGemini(file, getApiKey());
            allUploadedFiles.push(uploadedFile);
            console.log(`成功上传: ${file.name} (${file.type})`);
            console.log(`当前文件数组大小: ${allUploadedFiles.length}`);
        } catch (error) {
            console.error(`上传失败 ${file.name}:`, error);
            // For TXT files, we could read them directly as fallback
            if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                try {
                    const text = await file.text();
                    allUploadedFiles.push({
                        uri: `local_txt_${Date.now()}`,
                        mimeType: 'text/plain',
                        displayName: file.name,
                        content: text // Store content directly for local TXT files
                    });
                    console.log(`TXT文件本地处理: ${file.name}`);
                } catch (txtError) {
                    console.error(`TXT文件处理失败: ${file.name}`, txtError);
                }
            }
        }
    }
    
    updateFilesList();
    
    // Mark upload as complete and re-enable generate button
    isUploadInProgress = false;
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = '生成报告';
    }
    
    fileUploadStatus.innerHTML = `已处理 ${files.length} 个文件 - 可以开始生成报告`;
    setTimeout(() => {
        fileUploadStatus.innerHTML = '';
    }, 3000);
}

// Add more files function
function addMoreFiles() {
    document.getElementById('pdfs').click();
}

// Store full content for modal display
window.fullContentStore = {
    extractedInfo: [],
    businessPlanData: '',
    initialDraft: '',
    subagentTasks: null,
    enhancementDetails: []
};

// Modal functions
window.showModal = function(title, content) {
    const modal = document.getElementById('contentModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = title;
    // Properly escape HTML content
    const pre = document.createElement('pre');
    pre.textContent = content;
    modalBody.innerHTML = '';
    modalBody.appendChild(pre);
    modal.style.display = 'block';
}

window.closeModal = function() {
    const modal = document.getElementById('contentModal');
    modal.style.display = 'none';
}

window.copyModalContent = function() {
    const modalBody = document.getElementById('modalBody');
    const content = modalBody.textContent;
    
    navigator.clipboard.writeText(content).then(() => {
        alert('内容已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('contentModal');
    const stepModal = document.getElementById('stepDetailsModal');
    if (event.target === modal) {
        closeModal();
    } else if (event.target === stepModal) {
        closeStepDetailsModal();
    }
}

// Visualization functions
function displayExtractedInfo(extractedChunks, container) {
    // Store full content
    window.fullContentStore.extractedInfo = extractedChunks;
    
    let html = '<h3>📋 提取的信息详情</h3>';
    html += '<p class="clickable-hint">点击任何卡片查看完整内容</p>';
    
    extractedChunks.forEach((chunk, index) => {
        html += `
            <div class="info-item" onclick="showModal('片段 ${index + 1} - 完整内容', window.fullContentStore.extractedInfo[${index}])">
                <h4>片段 ${index + 1}</h4>
                <pre>${chunk.substring(0, 800)}${chunk.length > 800 ? '...' : ''}</pre>
                ${chunk.length > 800 ? '<p style="text-align: right; color: #007bff; font-size: 0.9em;">点击查看全部 →</p>' : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayBusinessPlanData(businessPlanAnalysis, container) {
    if (!businessPlanAnalysis || businessPlanAnalysis.length === 0) {
        container.innerHTML = '<h3>📄 商业计划书分析</h3><p>无商业计划书数据</p>';
        return;
    }
    
    // Store full content
    window.fullContentStore.businessPlanData = businessPlanAnalysis;
    
    const html = `
        <h3>📄 商业计划书分析结果</h3>
        <p class="clickable-hint">点击卡片查看完整内容</p>
        <div class="stats">
            <span class="stat-item">数据长度: ${businessPlanAnalysis.length} 字符</span>
            <span class="stat-item">处理时间: ${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="info-item" onclick="showModal('商业计划书分析 - 完整内容', window.fullContentStore.businessPlanData)">
            <h4>提取的商业计划书内容</h4>
            <pre>${businessPlanAnalysis.substring(0, 2000)}${businessPlanAnalysis.length > 2000 ? '...\n\n[显示前2000字符，完整内容已用于报告生成]' : ''}</pre>
            ${businessPlanAnalysis.length > 2000 ? '<p style="text-align: right; color: #007bff; font-size: 0.9em;">点击查看全部 →</p>' : ''}
        </div>
    `;
    
    container.innerHTML = html;
}

function displayInitialDraft(report, container) {
    // Store full content
    window.fullContentStore.initialDraft = report;
    
    const html = `
        <h3>📝 初始报告草稿</h3>
        <p class="clickable-hint">点击查看完整报告</p>
        <div class="stats">
            <span class="stat-item">长度: ${report.length} 字符</span>
            <span class="stat-item">生成时间: ${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="process-content info-item" onclick="showModal('初始报告草稿 - 完整内容', window.fullContentStore.initialDraft)" style="cursor: pointer;">
            ${formatForDisplay(report.substring(0, 2000) + (report.length > 2000 ? '...' : ''))}
            ${report.length > 2000 ? '<p style="text-align: right; color: #007bff; font-size: 0.9em; margin-top: 10px;">点击查看完整报告 →</p>' : ''}
        </div>
    `;
    
    container.innerHTML = html;
}

function displaySubagentTasks(tasks, container) {
    // Store full content
    window.fullContentStore.subagentTasks = tasks;
    
    let html = '<h3>🎯 子代理任务详情</h3>';
    html += '<p class="clickable-hint">点击任务卡片查看完整内容</p>';
    
    if (!tasks || !tasks.enhancement_tasks) {
        html += '<p>暂无子代理任务</p>';
        container.innerHTML = html;
        return;
    }
    
    html += `
        <div class="stats">
            <span class="stat-item">总任务数: ${tasks.total_tasks}</span>
            <span class="stat-item">策略: ${tasks.overall_strategy}</span>
        </div>
    `;
    
    tasks.enhancement_tasks.forEach((task, index) => {
        html += `
            <div class="task-item" onclick="showModal('任务 ${index + 1}: ${task.research_task}', JSON.stringify(window.fullContentStore.subagentTasks.enhancement_tasks[${index}], null, 2))">
                <h4>任务 ${index + 1}: ${task.research_task}</h4>
                <p><strong>优先级:</strong> ${task.priority}</p>
                <p><strong>增强重点:</strong> ${task.enhancement_focus}</p>
                <p><strong>期望改进:</strong> ${task.expected_improvement}</p>
                <div class="original-quote">
                    <div class="quote-label">原始片段:</div>
                    ${task.original_quote.substring(0, 200)}${task.original_quote.length > 200 ? '...' : ''}
                </div>
                ${task.original_quote.length > 200 ? '<p style="text-align: right; color: #007bff; font-size: 0.9em;">点击查看全部 →</p>' : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayEnhancementDetails(enhancementResults, container) {
    // Store full content
    window.fullContentStore.enhancementDetails = enhancementResults;
    
    let html = '<h3>🔄 增强替换详情</h3>';
    html += '<p class="clickable-hint">点击对比卡片查看完整内容</p>';
    
    if (!enhancementResults || enhancementResults.length === 0) {
        html += '<p>暂无增强详情</p>';
        container.innerHTML = html;
        return;
    }
    
    let totalReplacements = 0;
    enhancementResults.forEach((result, index) => {
        const improvement = result.enhanced_content.length - result.original_quote.length;
        const improvementClass = improvement > 0 ? 'improvement-positive' : 'improvement-neutral';
        
        if (result.enhanced_content !== result.original_quote) {
            totalReplacements++;
        }
        
        // Create a function to show the comparison
        window[`showComparison${index}`] = function() {
            const fullComparison = `原始内容 (${result.original_quote.length} 字符):\n${'-'.repeat(50)}\n${result.original_quote}\n\n增强内容 (${result.enhanced_content.length} 字符):\n${'-'.repeat(50)}\n${result.enhanced_content}\n\n改进详情:\n${'-'.repeat(50)}\n研究任务: ${result.research_task}\n优先级: ${result.priority}\n字符变化: ${improvement > 0 ? '+' : ''}${improvement}${result.error ? '\n错误: ' + result.error : ''}`;
            showModal(`增强任务 ${index + 1}: ${result.research_task}`, fullComparison);
        };
        
        html += `
            <div class="quote-comparison" onclick="showComparison${index}()">
                <h4>增强任务 ${index + 1}: ${result.research_task}</h4>
                
                <div class="original-quote">
                    <div class="quote-label">原始内容 (${result.original_quote.length} 字符):</div>
                    ${result.original_quote.substring(0, 300)}${result.original_quote.length > 300 ? '...' : ''}
                </div>
                
                <div class="enhanced-quote">
                    <div class="quote-label">增强内容 (${result.enhanced_content.length} 字符):</div>
                    ${result.enhanced_content.substring(0, 300)}${result.enhanced_content.length > 300 ? '...' : ''}
                </div>
                
                <div class="stats">
                    <span class="stat-item ${improvementClass}">
                        变化: ${improvement > 0 ? '+' : ''}${improvement} 字符
                    </span>
                    <span class="stat-item">优先级: ${result.priority}</span>
                    ${result.error ? `<span class="stat-item" style="background-color: #f8d7da; color: #721c24;">错误: ${result.error}</span>` : ''}
                </div>
                ${(result.original_quote.length > 300 || result.enhanced_content.length > 300) ? '<p style="text-align: right; color: #007bff; font-size: 0.9em;">点击查看完整对比 →</p>' : ''}
            </div>
        `;
    });
    
    html = `
        <div class="stats">
            <span class="stat-item improvement-positive">成功替换: ${totalReplacements}/${enhancementResults.length}</span>
        </div>
    ` + html;
    
    container.innerHTML = html;
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load saved API key if exists
    const savedKey = getApiKey();
    
    // If we have a saved API key, initialize the client immediately
    if (savedKey) {
        try {
            initGeminiClient(savedKey);
            console.log('✅ Gemini client initialized with saved API key');
        } catch (error) {
            console.error('❌ Failed to initialize Gemini client with saved key:', error);
        }
    }
    
    // API key input listener - initialize client when user enters/changes API key
    document.getElementById('apiKey').addEventListener('blur', () => {
        const apiKey = document.getElementById('apiKey').value.trim();
        if (apiKey) {
            saveApiKey(apiKey);
            try {
                initGeminiClient(apiKey);
                console.log('✅ Gemini client initialized with new API key');
            } catch (error) {
                console.error('❌ Failed to initialize Gemini client:', error);
                alert('无法初始化 Gemini 客户端。请检查您的 API Key。');
            }
        }
    });
    
    // Event listeners
    document.getElementById('reportForm').addEventListener('submit', generateReport);
    document.getElementById('downloadBtn').addEventListener('click', () => {
        downloadReport(currentReport);
    });
    document.getElementById('addMoreFiles').addEventListener('click', addMoreFiles);
    
    // File input change listener for immediate processing
    document.getElementById('pdfs').addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            await processSelectedFiles(files);
            // Clear the input after processing so user can add more
            event.target.value = '';
        }
    });
});