import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';
import { 
    deepExtractChunk, 
    architectInformation, 
    masterComposeReport, 
    verifyCitations, 
    validateExcellence, 
    intelligentEnrichment, 
    integrateEnhancements, 
    excellenceFormatter, 
    finalQualityInspection,
    comprehensiveBPAnalysis 
} from './src/agents/enhanced-agents.js';
import { 
    fastExtractChunk, 
    fastOrganizeInformation, 
    fastComposeReport, 
    fastQualityCheck, 
    fastFormatReport 
} from './src/agents/fast-agents.js';
import { detectAndRemoveBias } from './src/agents/bias-detection-agent.js';
import { findRevenuePatterns } from './competitor-data-extractor.js';
import { orchestrateMasterSubAgentSystem } from './master-subagent-system.js';
import { createModelConfig } from './src/config/gemini-config.js';
import { readPDFs } from './src/utils/pdf-handler.js';
import { uploadFileToGemini, deleteFileFromGemini } from './src/utils/gemini-files.js';
import { chunkTranscript, updateProgress, getApiKey, saveApiKey, downloadReport } from './src/utils/utils.js';
import { finalReportFormatter, quickFinalFormatter, formatForDisplay } from './src/agents/final-formatter.js';

let currentReport = '';
let allUploadedFiles = []; // Store all uploaded files across multiple sessions

// Initialize Gemini AI
function initializeGemini() {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('请输入您的 Gemini API Key');
        return null;
    }
    saveApiKey(apiKey);
    return new GoogleGenerativeAI(apiKey);
}

// Generate report
async function generateReport(e) {
    e.preventDefault();
    
    const genAI = initializeGemini();
    if (!genAI) return;
    
    const generateBtn = document.getElementById('generateBtn');
    const progressContainer = document.getElementById('progressContainer');
    const reportOutput = document.getElementById('reportOutput');
    const downloadBtn = document.getElementById('downloadBtn');
    
    generateBtn.disabled = true;
    progressContainer.style.display = 'block';
    
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
        const extractedInfoDiv = document.getElementById('extractedInfo');
        const initialDraftDiv = document.getElementById('initialDraft');
        const subagentTasksDiv = document.getElementById('subagentTasks');
        const enhancementDetailsDiv = document.getElementById('enhancementDetails');
        
        // Show process visualization if requested
        if (showProcessDetails) {
            processVisualization.style.display = 'grid';
        }
        
        // Step 1: Use already uploaded files (files are processed immediately when selected)
        updateProgress(10, `使用已上传的 ${allUploadedFiles.length} 个文档开始分析...`);
        
        // Step 2: Document Analysis (parallel with transcript processing)
        let businessPlanAnalysisPromise = null;
        if (allUploadedFiles.length > 0) {
            updateProgress(20, '正在启动文档分析...');
            // Start BP analysis
            businessPlanAnalysisPromise = comprehensiveBPAnalysis(allUploadedFiles, model);
        }
        
        // Step 3: Choose workflow based on mode
        updateProgress(30, isSpeedMode ? '⚡ 快速模式：优化处理流程...' : '🔍 开始深度分析访谈内容...');
        const chunks = chunkTranscript(transcript);
        updateProgress(35, `已将访谈内容分成${chunks.length}个片段`, 
            chunks.map((c, i) => `片段${i+1}: ${c.substring(0, 50)}...`).join('<br>'));
        
        let extractedChunks, organizedInfo, currentReport, architecturedInfo;
        
        if (isSpeedMode) {
            // FAST MODE: Streamlined workflow for speed while maintaining accuracy
            updateProgress(40, '⚡ 快速并行信息提取...');
            
            // Use faster extraction method with focus on key information
            const fastExtractionPromises = chunks.map(async (chunk, i) => {
                try {
                    return await fastExtractChunk(chunk, i, model);
                } catch (error) {
                    console.error(`Error in fast processing chunk ${i + 1}:`, error);
                    return `片段 ${i + 1} 快速处理失败: ${error.message}`;
                }
            });
            
            extractedChunks = await Promise.all(fastExtractionPromises);
            updateProgress(55, `✅ 快速提取完成 (${chunks.length}个片段并行处理)`);
            
            // Display extracted information if visualization is enabled
            if (showProcessDetails) {
                displayExtractedInfo(extractedChunks, extractedInfoDiv);
            }
            
            // Fast organization and report generation
            updateProgress(60, '⚡ 快速信息整理...');
            const businessPlanText = businessPlanAnalysisPromise ? await businessPlanAnalysisPromise : '';
            const combinedDocumentInfo = businessPlanText || '';
            
            organizedInfo = await fastOrganizeInformation(extractedChunks, combinedDocumentInfo, model);
            updateProgress(70, '⚡ 生成初始报告...');
            currentReport = await fastComposeReport(organizedInfo, companyName, model);
            
            // Display initial draft if visualization is enabled
            if (showProcessDetails) {
                displayInitialDraft(currentReport, initialDraftDiv);
            }
            
            // Fast quality and formatting pipeline (no subagent enhancement for speed)
            updateProgress(85, '⚡ 快速质量检查和格式化...');
            const [qualityResult, formattedReport] = await Promise.all([
                fastQualityCheck(currentReport, model),
                detectAndRemoveBias(currentReport, model).then(debiased => 
                    fastFormatReport(debiased, model)
                )
            ]);
            
            if (formattedReport && typeof formattedReport === 'string') {
                currentReport = formattedReport;
            }
            
            // Final formatting for fast mode
            updateProgress(95, '📝 最终格式化...');
            const finalFormattedReport = await quickFinalFormatter(currentReport, model);
            if (finalFormattedReport && typeof finalFormattedReport === 'string') {
                currentReport = finalFormattedReport;
            }
            
            architecturedInfo = organizedInfo; // Set for technical terms
            updateProgress(98, `✅ 快速模式完成 - 质量评分: ${qualityResult?.score || 'N/A'}/100`);
            
        } else {
            // ENHANCED MODE: Full quality pipeline with dynamic analysis
            updateProgress(40, '🔍 深度分析处理...');
            
            const extractionPromises = chunks.map(async (chunk, i) => {
                try {
                    return await deepExtractChunk(chunk, i, transcript, allUploadedFiles, model);
                } catch (error) {
                    console.error(`Error processing chunk ${i + 1}:`, error);
                    return `片段 ${i + 1} 处理失败: ${error.message}`;
                }
            });
            
            extractedChunks = await Promise.all(extractionPromises);
            updateProgress(55, `✅ 深度分析完成`);
            
            // Display extracted information if visualization is enabled
            if (showProcessDetails) {
                displayExtractedInfo(extractedChunks, extractedInfoDiv);
            }
            
            // Generate initial enhanced report
            updateProgress(58, '📊 生成增强模式初始报告...');
            const businessPlanAnalysis = businessPlanAnalysisPromise ? await businessPlanAnalysisPromise : '';
            const enhancedInfoSources = [businessPlanAnalysis].filter(Boolean).join('\n\n');
            
            organizedInfo = await architectInformation(extractedChunks, enhancedInfoSources, allUploadedFiles, model);
            currentReport = await masterComposeReport(organizedInfo, companyName, allUploadedFiles, model);
            
            // Display initial draft if visualization is enabled
            if (showProcessDetails) {
                displayInitialDraft(currentReport, initialDraftDiv);
            }
            
            // Master-SubAgent enhancement 
            updateProgress(65, '🎯 启动主-子代理深度增强...');
            
            // Create visualization callback if process details are enabled
            const visualizationCallback = showProcessDetails ? (type, data) => {
                if (type === 'tasks') {
                    displaySubagentTasks(data, subagentTasksDiv);
                } else if (type === 'enhancements') {
                    displayEnhancementDetails(data, enhancementDetailsDiv);
                }
            } : null;
            
            const enhancedReport = await orchestrateMasterSubAgentSystem(currentReport, transcript, allUploadedFiles, model, visualizationCallback);
            if (enhancedReport && typeof enhancedReport === 'string') {
                currentReport = enhancedReport;
                updateProgress(75, '📊 增强报告生成完成', `报告长度：${currentReport.length} 字符`);
            } else {
                console.warn('⚠️ 深度增强失败，保持原报告');
                updateProgress(75, '⚠️ 深度增强跳过，保持原报告', `报告长度：${currentReport.length} 字符`);
            }
            
            // Set architecturedInfo for technical terms
            architecturedInfo = organizedInfo;
            
            // Bias Detection and Professional Formatting
            updateProgress(90, '正在进行偏向性检测和专业格式化...');
            try {
                const debiasedReport = await detectAndRemoveBias(currentReport, model);
                if (debiasedReport && typeof debiasedReport === 'string') {
                    currentReport = debiasedReport;
                } else {
                    console.warn('⚠️ 偏向性检测失败，保持原报告');
                }
                
                const formattedReport = await excellenceFormatter(currentReport, model);
                if (formattedReport && typeof formattedReport === 'string') {
                    currentReport = formattedReport;
                } else {
                    console.warn('⚠️ 专业格式化失败，保持原报告');
                }
            } catch (error) {
                console.error('格式化过程出错:', error);
                console.log('保持原报告继续');
            }
            
            // Final professional formatting
            updateProgress(97, '📝 最终专业格式化...');
            try {
                const finalFormattedReport = await finalReportFormatter(currentReport, model);
                if (finalFormattedReport && typeof finalFormattedReport === 'string') {
                    currentReport = finalFormattedReport;
                }
            } catch (error) {
                console.error('最终格式化出错:', error);
                console.log('保持当前报告继续');
            }
            
            updateProgress(98, '✅ 增强模式处理完成');
        }
        
        // Safety check for currentReport
        if (!currentReport || typeof currentReport !== 'string') {
            console.error('报告生成失败: currentReport is undefined or invalid');
            updateProgress(98, '❌ 报告生成失败', 'currentReport无效');
            reportOutput.innerHTML = `<div class="error">报告生成失败：内部错误，请重试</div>`;
            return;
        }

        // Final steps - Add technical terms if available
        updateProgress(98, '✅ 报告生成完成!', 
            isSpeedMode ? '⚡ 快速模式大幅提升了处理速度' : '🔥 完整模式确保最高质量');
        
        const finalReport = currentReport;
        
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
window.removeFile = async function(index) {
    const file = allUploadedFiles[index];
    if (file && file.uri && !file.uri.startsWith('local_')) {
        try {
            await deleteFileFromGemini(file.uri, getApiKey());
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    }
    allUploadedFiles.splice(index, 1);
    updateFilesList();
}

// Process selected files immediately when chosen
async function processSelectedFiles(files) {
    const fileUploadStatus = document.getElementById('fileUploadStatus');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        fileUploadStatus.innerHTML = `正在处理 ${file.name}...`;
        
        try {
            const uploadedFile = await uploadFileToGemini(file, getApiKey());
            allUploadedFiles.push(uploadedFile);
            console.log(`成功上传: ${file.name} (${file.type})`);
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
    fileUploadStatus.innerHTML = `已处理 ${files.length} 个文件`;
    setTimeout(() => {
        fileUploadStatus.innerHTML = '';
    }, 3000);
}

// Add more files function
function addMoreFiles() {
    document.getElementById('pdfs').click();
}

// Visualization functions
function displayExtractedInfo(extractedChunks, container) {
    let html = '<h3>📋 提取的信息详情</h3>';
    
    extractedChunks.forEach((chunk, index) => {
        html += `
            <div class="info-item">
                <h4>片段 ${index + 1}</h4>
                <pre>${chunk.substring(0, 800)}${chunk.length > 800 ? '...' : ''}</pre>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayInitialDraft(report, container) {
    const html = `
        <h3>📝 初始报告草稿</h3>
        <div class="stats">
            <span class="stat-item">长度: ${report.length} 字符</span>
            <span class="stat-item">生成时间: ${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="process-content">
            ${formatForDisplay(report)}
        </div>
    `;
    
    container.innerHTML = html;
}

function displaySubagentTasks(tasks, container) {
    let html = '<h3>🎯 子代理任务详情</h3>';
    
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
            <div class="task-item">
                <h4>任务 ${index + 1}: ${task.research_task}</h4>
                <p><strong>优先级:</strong> ${task.priority}</p>
                <p><strong>增强重点:</strong> ${task.enhancement_focus}</p>
                <p><strong>期望改进:</strong> ${task.expected_improvement}</p>
                <div class="original-quote">
                    <div class="quote-label">原始片段:</div>
                    ${task.original_quote}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayEnhancementDetails(enhancementResults, container) {
    let html = '<h3>🔄 增强替换详情</h3>';
    
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
        
        html += `
            <div class="quote-comparison">
                <h4>增强任务 ${index + 1}: ${result.research_task}</h4>
                
                <div class="original-quote">
                    <div class="quote-label">原始内容 (${result.original_quote.length} 字符):</div>
                    ${result.original_quote}
                </div>
                
                <div class="enhanced-quote">
                    <div class="quote-label">增强内容 (${result.enhanced_content.length} 字符):</div>
                    ${result.enhanced_content}
                </div>
                
                <div class="stats">
                    <span class="stat-item ${improvementClass}">
                        变化: ${improvement > 0 ? '+' : ''}${improvement} 字符
                    </span>
                    <span class="stat-item">优先级: ${result.priority}</span>
                    ${result.error ? `<span class="stat-item" style="background-color: #f8d7da; color: #721c24;">错误: ${result.error}</span>` : ''}
                </div>
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
    getApiKey();
    
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