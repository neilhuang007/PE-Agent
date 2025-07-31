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
import { chunkTranscript, updateProgress, getApiKey, saveApiKey, downloadReport, assembleRawDraft } from './src/utils/utils.js';
import { finalReportFormatter, quickFinalFormatter, formatForDisplay } from './src/agents/final-formatter.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.2.0/+esm';

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

// Note: SubAgent animation now handled in modal step details

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
            // Add processing spinner to status
            addSpinnerToTaskStatus(stepId, 'processing');
            statusElement.textContent = '';
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
            // Add check icon to status and remove spinner
            addCheckToTaskStatus(stepId);
            statusElement.textContent = '';
            stepperData[stepId].endTime = now;
            const duration = stepperData[stepId].startTime ? 
                Math.round((now.getTime() - stepperData[stepId].startTime.getTime()) / 1000) : 0;
            timeElement.textContent = `完成于 ${now.toLocaleTimeString()} (${duration}秒)`;
            break;
        case 'pending':
        default:
            step.classList.add('stepper-pending');
            // Add waiting spinner to status
            addSpinnerToTaskStatus(stepId, 'waiting');
            statusElement.textContent = '';
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
        // Remove any existing spinners/checks before resetting
        removeSpinnerFromTaskStatus(stepId);
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

// Spinner functions for processing text - adds <div class="spinner"></div> before text
function addSpinnerToProgressText() {
    const progressText = document.getElementById('progressText');
    if (progressText && !progressText.querySelector('.spinner')) {
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        progressText.insertBefore(spinner, progressText.firstChild);
    }
}

function removeSpinnerFromProgressText() {
    const progressText = document.getElementById('progressText');
    if (progressText) {
        const spinner = progressText.querySelector('.spinner');
        if (spinner) {
            spinner.remove();
        }
    }
}

function addSpinnerToText(elementId) {
    const element = document.getElementById(elementId);
    if (element && !element.querySelector('.spinner')) {
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        element.insertBefore(spinner, element.firstChild);
    }
}

function removeSpinnerFromText(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const spinner = element.querySelector('.spinner');
        if (spinner) {
            spinner.remove();
        }
    }
}

// Dynamic spinner management functions
function addSpinnerToTaskStatus(containerId, state = 'waiting') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Remove existing spinner/check
    removeSpinnerFromTaskStatus(containerId);
    
    const spinner = document.createElement('div');
    spinner.className = `spinner-small spinner-${state}`;
    spinner.setAttribute('data-spinner', 'true');
    
    // Find the status text element and prepend spinner
    const statusText = container.querySelector('.task-status, .stepper-status');
    if (statusText) {
        statusText.insertBefore(spinner, statusText.firstChild);
    } else {
        container.insertBefore(spinner, container.firstChild);
    }
}

function removeSpinnerFromTaskStatus(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const spinner = container.querySelector('[data-spinner="true"]');
    if (spinner) {
        spinner.remove();
    }
}

function addCheckToTaskStatus(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Remove existing spinner/check
    removeSpinnerFromTaskStatus(containerId);
    
    const checkIcon = document.createElement('div');
    checkIcon.innerHTML = `<svg class="check-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path>
    </svg>`;
    checkIcon.setAttribute('data-spinner', 'true');
    
    // Find the status text element and prepend check
    const statusText = container.querySelector('.task-status, .stepper-status');
    if (statusText) {
        statusText.insertBefore(checkIcon, statusText.firstChild);
    } else {
        container.insertBefore(checkIcon, container.firstChild);
    }
}

function getStatusIcon(status) {
    switch(status) {
        case 'pending':
            return '<div class="spinner-small spinner-waiting"></div>';
        case 'processing':
            return '<div class="spinner-small spinner-processing"></div>';
        case 'completed':
            return '<svg class="check-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path></svg>';
        default:
            return '';
    }
}

function updateTaskStatusWithSpinner(taskId, status) {
    const statusElement = document.getElementById(`${taskId}-status`);
    if (!statusElement) return;
    
    switch(status) {
        case 'pending':
            addSpinnerToTaskStatus(`${taskId}-status`, 'waiting');
            statusElement.textContent = '';
            break;
        case 'processing':
            addSpinnerToTaskStatus(`${taskId}-status`, 'processing');
            statusElement.textContent = '';
            break;
        case 'completed':
            addCheckToTaskStatus(`${taskId}-status`);
            statusElement.textContent = '';
            break;
        case 'error':
            removeSpinnerFromTaskStatus(`${taskId}-status`);
            statusElement.innerHTML = '错误 处理失败';
            break;
    }
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

    if (currentStepId === 'step-enhancement' && stepInfo.subCards.length > 0 && typeof stepInfo.subCards[0] === 'object') {
        totalCards = stepInfo.subCards.length + 1; // master page + each task
        const index = currentCardIndex;

        if (index === 0) {
            // Add orbital animation to the master page
            cardContent = renderEnhancementMasterWithAnimation(stepInfo.subCards);
        } else {
            const taskObj = stepInfo.subCards[index - 1];
            cardContent = renderEnhancementTask(taskObj, index, stepInfo.subCards.length);
        }
    } else if (stepInfo.subCards.length > 0) {
        const currentCard = stepInfo.subCards[currentCardIndex];
        cardContent = formatTaskContent(currentCard, currentCardIndex + 1);
    } else {
        // Show general step data or status message
        if (stepInfo.data) {
            cardContent = `<div class="step-card-content">
                <h4>总体信息</h4>
                <div class="markdown-content">${marked.parse(stepInfo.data)}</div>
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

// Helper function to format task content with modern styling
function formatTaskContent(cardData, cardIndex) {
    // Parse the card data to extract components
    const lines = cardData.split('\n');
    let headerLine = lines[0] || '';
    
    // Determine the type of card based on header content
    let isCompleted = headerLine.includes('完成');
    let isProcessing = headerLine.includes('执行中') || headerLine.includes('处理中');
    let isStarted = headerLine.includes('开始');
    
    // Check if this is a substitution result (has original and enhanced content)
    let hasSubstitution = cardData.includes('原始内容') && cardData.includes('增强内容');
    
    if (hasSubstitution) {
        return formatSubstitutionContent(cardData, cardIndex);
    } else {
        return formatSimpleTaskContent(cardData, cardIndex, isCompleted, isProcessing, isStarted);
    }
}

function formatSubstitutionContent(cardData, cardIndex) {
    const lines = cardData.split('\n');
    let taskName = '';
    let priority = '';
    let status = '';
    let originalContent = '';
    let enhancedContent = '';
    let error = '';
    
    let currentSection = '';
    let originalStart = false;
    let enhancedStart = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('子任务') && line.includes('完成')) {
            status = line;
        } else if (line.startsWith('研究任务:')) {
            taskName = line.replace('研究任务:', '').trim();
        } else if (line.startsWith('优先级:')) {
            priority = line.replace('优先级:', '').trim();
        } else if (line.includes('原始内容')) {
            originalStart = true;
            enhancedStart = false;
            continue;
        } else if (line.includes('增强内容')) {
            originalStart = false;
            enhancedStart = true;
            continue;
        } else if (line.includes('错误:')) {
            error = line.replace('错误:', '').trim();
        } else if (originalStart && line.trim()) {
            originalContent += (originalContent ? '\n' : '') + line;
        } else if (enhancedStart && line.trim() && !line.includes('错误:')) {
            enhancedContent += (enhancedContent ? '\n' : '') + line;
        }
    }
    
    const isChanged = originalContent.trim() !== enhancedContent.trim();
    const charDiff = enhancedContent.length - originalContent.length;
    const statusClass = isChanged ? 'completed' : 'processing';
    const changeClass = charDiff > 0 ? 'positive' : charDiff < 0 ? 'negative' : 'neutral';
    
    return `
        <div class="step-card-content">
            <div class="task-status-header ${statusClass}">
                <span class="status-icon">${isChanged ? '<svg class="check-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path></svg>' : '<div class="spinner-small"></div>'}</span>
                子任务 ${cardIndex} - ${taskName}
            </div>
            
            <div class="task-metadata">
                <div class="metadata-row">
                    <span class="metadata-label">优先级:</span>
                    <span class="metadata-value"><span class="priority-badge ${priority.toLowerCase()}">${priority}</span></span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">状态:</span>
                    <span class="metadata-value">${isChanged ? '已增强' : '保持原样'}</span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">字符变化:</span>
                    <span class="metadata-value">
                        <span class="change-indicator ${changeClass}">
                            ${charDiff > 0 ? '+' : ''}${charDiff}
                        </span>
                    </span>
                </div>
            </div>
            
            <div class="substitution-container">
                <div class="substitution-section original-content">
                    <div class="content-label">
                        <span class="label-icon">原始</span>
                        原始内容
                    </div>
                    <div class="content-text">${marked.parse(originalContent)}</div>
                    <div class="content-stats">
                        <span class="char-count">${originalContent.length} 字符</span>
                    </div>
                </div>
                
                <div class="substitution-section ${isChanged ? 'enhanced-content' : 'unchanged-content'}">
                    <div class="content-label">
                        <span class="label-icon">${isChanged ? '增强' : '<div class="spinner-small"></div>'}</span>
                        ${isChanged ? '增强内容' : '保持内容'}
                    </div>
                    <div class="content-text">${marked.parse(enhancedContent)}</div>
                    <div class="content-stats">
                        <span class="char-count">${enhancedContent.length} 字符</span>
                    </div>
                </div>
            </div>
            
            ${error ? `<div class="task-metadata" style="background: rgba(244, 67, 54, 0.1); border-color: #f44336;">
                <div class="metadata-row">
                    <span class="metadata-label">错误:</span>
                    <span class="metadata-value" style="color: #f44336;">${error}</span>
                </div>
            </div>` : ''}
        </div>
    `;
}

function formatSimpleTaskContent(cardData, cardIndex, isCompleted, isProcessing, isStarted) {
    const lines = cardData.split('\n');
    let taskName = '';
    let priority = '';
    let status = '';
    let description = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (i === 0) {
            status = line;
        } else if (line.startsWith('研究任务:')) {
            taskName = line.replace('研究任务:', '').trim();
        } else if (line.startsWith('优先级:')) {
            priority = line.replace('优先级:', '').trim();
        } else if (line.startsWith('状态:')) {
            description = line.replace('状态:', '').trim();
        } else if (line.trim() && !line.startsWith('原始片段:') && !line.startsWith('目标片段:')) {
            description += (description ? '\n' : '') + line;
        }
    }
    
    const statusClass = isCompleted ? 'completed' : isProcessing ? 'processing' : 'started';
    const statusIcon = isCompleted ? '<svg class="check-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path></svg>' : isProcessing ? '<div class="spinner-small"></div>' : '开始';
    
    return `
        <div class="step-card-content">
            <div class="task-status-header ${statusClass}">
                <span class="status-icon">${statusIcon}</span>
                ${status}
            </div>
            
            ${taskName ? `<div class="task-metadata">
                <div class="metadata-row">
                    <span class="metadata-label">任务:</span>
                    <span class="metadata-value">${taskName}</span>
                </div>
                ${priority ? `<div class="metadata-row">
                    <span class="metadata-label">优先级:</span>
                    <span class="metadata-value"><span class="priority-badge ${priority.toLowerCase()}">${priority}</span></span>
                </div>` : ''}
            </div>` : ''}
            
            ${isProcessing ? '<div class="processing-indicator"><div class="spinner"></div></div>' : ''}

        <div class="content-text" style="margin-top: 15px;">${marked.parse(description)}</div>
        </div>
    `;
}

function renderEnhancementMaster(tasks) {
    let rows = tasks.map((t, i) => {
        return `<div class="master-task-row">
            <span class="task-index">任务 ${i + 1}</span>
            <span class="task-name">${t.task.research_task}</span>
            <span class="task-status-badge ${t.status}">${getStatusIcon(t.status)}</span>
        </div>`;
    }).join('');
    return `<div class="step-card-content">
        <h4>子任务进度</h4>
        ${rows}
    </div>`;
}

function renderEnhancementMasterWithAnimation(tasks) {
    const taskCount = tasks.length;
    
    // Generate dynamic orbiting dots distributed across different orbits
    let orbitalRings = '';
    const maxDotsPerOrbit = 4; // Maximum dots per orbit ring
    const orbitSizes = [80, 100, 120]; // Different orbit radii
    
    for (let i = 0; i < Math.min(taskCount, 12); i++) { // Limit to 12 total dots
        const orbitIndex = Math.floor(i / maxDotsPerOrbit) % orbitSizes.length;
        const dotInOrbit = i % maxDotsPerOrbit;
        const angleStep = 360 / Math.min(maxDotsPerOrbit, taskCount - (orbitIndex * maxDotsPerOrbit));
        const angle = angleStep * dotInOrbit;
        const orbitRadius = orbitSizes[orbitIndex];
        const task = tasks[i];
        const dotStatus = task ? task.status : 'pending';
        
        orbitalRings += `<div class="subagent-dot dynamic-dot orbit-${orbitIndex + 1} ${dotStatus}" 
                             style="--angle: ${angle}deg; --delay: ${i * 0.15}s; --orbit-radius: ${orbitRadius}px;">
                         </div>`;
    }
    
    let rows = tasks.map((t, i) => {
        return `<div class="master-task-row">
            <span class="task-index">任务 ${i + 1}</span>
            <span class="task-name">${t.task.research_task}</span>
            <span class="task-status-badge ${t.status}">${getStatusIcon(t.status)}</span>
        </div>`;
    }).join('');
    
    // Calculate completion progress
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progressPercent = taskCount > 0 ? (completedTasks / taskCount) * 100 : 0;
    
    return `<div class="step-card-content">
        <div class="subagent-loading-container-modal">
            <div class="subagent-loading-title">主-子代理增强系统</div>
            <div class="subagent-loading-animation">
                <div class="master-agent-circle">主代理</div>
                <div class="subagent-orbits-container">
                    ${orbitalRings}
                </div>
            </div>
            <div class="subagent-progress-bar">
                <div class="subagent-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="subagent-status-text">
                <div>${completedTasks} / ${taskCount} 任务完成</div>
            </div>
        </div>
        
        <h4>详细任务列表</h4>
        ${rows}
    </div>`;
}

function renderEnhancementTask(taskObj, cardIndex, total) {
    let header = `子任务 ${cardIndex} - ${taskObj.status}`;
    if (taskObj.status === 'completed') {
        const isChanged = taskObj.result.enhanced_content !== taskObj.result.original_quote;
        const diff = taskObj.result.enhanced_content.length - taskObj.result.original_quote.length;
        let card = `${isChanged ? '已增强' : '保持原样'} 子任务 ${cardIndex} 完成\n研究任务: ${taskObj.task.research_task}\n优先级: ${taskObj.task.priority}\n状态: 完成 (${diff >= 0 ? '+' : ''}${diff} 字符)\n\n原始内容 (${taskObj.result.original_quote.length} 字符):\n${taskObj.result.original_quote}\n\n增强内容 (${taskObj.result.enhanced_content.length} 字符):\n${taskObj.result.enhanced_content}${taskObj.result.error ? '\n\n错误: ' + taskObj.result.error : ''}`;
        return formatTaskContent(card, cardIndex);
    } else {
        let card = `任务 ${cardIndex}/${total} 开始\n研究任务: ${taskObj.task.research_task}\n优先级: ${taskObj.task.priority}\n状态: ${taskObj.status}`;
        return formatTaskContent(card, cardIndex);
    }
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
        console.log('Gemini client initialized for file uploads');
    } catch (error) {
        console.error('Failed to initialize Gemini client:', error);
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
            updateProgress(20, `正在深度分析 ${allUploadedFiles.length} 个文档（每个文档独立处理）...`);
            try {
                // Create callback to update stepper as files complete
                const fileAnalysisCallback = (fileIndex, fileName, analysis) => {
                    const fileAnalysis = `文件: ${fileName}\n分析结果: 已成功处理\n类型: ${allUploadedFiles[fileIndex]?.mimeType || 'unknown'}\n\n提取内容:\n${analysis}`;
                    updateStepper('step-document-analysis', 'active', '', fileAnalysis);
                    console.log(`文件 ${fileIndex + 1} 分析完成: ${fileName} - ${analysis.length} 字符`);
                };
                
                const bpResult = await comprehensiveBPAnalysis(allUploadedFiles, model, genAI, fileAnalysisCallback);
                combinedAnalyses = bpResult.combinedAnalyses;
                fileSummaries = bpResult.fileSummaries;
                updateProgress(25, `文档分析完成 - 提取了 ${combinedAnalyses.length} 字符的结构化数据`);
                
                updateStepper('step-document-analysis', 'completed', `已分析 ${allUploadedFiles.length} 个文档，提取了 ${combinedAnalyses.length} 字符的结构化数据`);
                
                // Display business plan analysis if visualization is enabled
                if (showProcessDetails && combinedAnalyses) {
                    displayBusinessPlanData(combinedAnalyses, businessPlanDataDiv);
                }
                
                // Add delay to show this step completion before moving to next
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error('商业计划书分析失败:', error);
                updateProgress(25, '商业计划书分析失败，继续处理');
                updateStepper('step-document-analysis', 'completed', `文档分析遇到错误: ${error.message}`);
            }
        } else {
            updateStepper('step-document-analysis', 'completed', '无上传文档，跳过分析步骤');
        }
        
        // Step 3: NOW chunk and extract with BP context available
        updateStepper('step-chunk-extraction', 'active');
        updateProgress(30, isSpeedMode ? '快速模式：优化处理流程...' : '开始深度分析访谈内容...');
        const chunks = chunkTranscript(transcript);
        updateProgress(35, `已将访谈内容分成${chunks.length}个片段`,
            chunks.map((c, i) => `片段${i+1}: ${c}`).join('<br>'));
        
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
            
            updateProgress(40, '快速并行信息提取...');
            
            // Use faster extraction method with BP context and fast model - process individually for immediate results
            extractedChunks = [];
            const fastExtractionPromises = chunks.map(async (chunk, i) => {
                try {
                    const result = await fastExtractChunk(chunk, i, combinedAnalyses, fastModel);
                    extractedChunks[i] = result;
                    
                    // Add chunk result immediately when it completes
                    const chunkData = `片段 ${i + 1}:\n原始内容: ${chunk}\n\n提取结果:\n${result}`;
                    updateStepper('step-chunk-extraction', 'active', '', chunkData);
                    
                    console.log(`片段 ${i + 1} 提取完成 - ${result.length} 字符`);
                    return result;
                } catch (error) {
                    console.error(`Error in fast processing chunk ${i + 1}:`, error);
                    const errorResult = `片段 ${i + 1} 快速处理失败: ${error.message}`;
                    extractedChunks[i] = errorResult;
                    return errorResult;
                }
            });
            
            await Promise.all(fastExtractionPromises);
            updateProgress(55, `快速提取完成 (${chunks.length}个片段并行处理)`);
            
            
            updateStepper('step-chunk-extraction', 'completed', `已快速提取 ${chunks.length} 个片段的内容`);
            
            // Display extracted information if visualization is enabled
            if (showProcessDetails) {
                displayExtractedInfo(extractedChunks, extractedInfoDiv);
            }
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Fast report generation directly from extracted chunks
            updateStepper('step-report-generation', 'active');
            updateProgress(60, '快速报告生成...');
            
            // Generate report directly from raw data (no intermediate organization step)
            const rawData = extractedChunks.join('\n\n') + (combinedAnalyses ? `\n\n${combinedAnalyses}` : '');
            localReport = await fastComposeReport(rawData, companyName, fastModel);
            
            // Add report generation details as sub-card
            const reportGenData = `快速报告生成:\n公司名称: ${companyName}\n原始数据长度: ${rawData.length} 字符\n生成的报告长度: ${localReport.length} 字符\n\n生成的报告:\n${localReport}`;
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
            updateProgress(85, '快速质量检查和格式化...');
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
            updateProgress(95, '最终格式化...');
            const finalFormattedReport = await quickFinalFormatter(localReport, fastModel);
            
            // Add final formatting details as sub-card
            const finalData = `最终格式化 (快速模式):\n格式化前长度: ${localReport.length} 字符\n格式化后长度: ${finalFormattedReport?.length || localReport.length} 字符\n处理类型: 快速最终格式化\n\n格式化结果预览:\n${(finalFormattedReport || localReport)}`;
            updateStepper('step-finalization', 'active', '', finalData);
            
            if (finalFormattedReport && typeof finalFormattedReport === 'string') {
                localReport = finalFormattedReport;
            }
            updateStepper('step-finalization', 'completed', `最终格式化完成，报告长度: ${localReport.length} 字符`);
            
            architecturedInfo = organizedInfo; // Set for technical terms
            updateProgress(98, `快速模式完成 - 质量评分: ${qualityResult?.score || 'N/A'}/100`);
            
        } else {
            // ENHANCED MODE: Full quality pipeline with dynamic analysis
            updateProgress(40, '深度分析处理...');
            
            // Process chunks individually for immediate results display
            extractedChunks = [];
            const extractionPromises = chunks.map(async (chunk, i) => {
                try {
                    const result = await deepExtractChunk(chunk, i, transcript, combinedAnalyses, allUploadedFiles, model);
                    extractedChunks[i] = result;
                    
                    // Add chunk result immediately when it completes
                    const chunkData = `片段 ${i + 1}:\n原始内容: ${chunk}\n\n提取结果:\n${result}`;
                    updateStepper('step-chunk-extraction', 'active', '', chunkData);
                    
                    console.log(`片段 ${i + 1} 深度提取完成 - ${result.length} 字符`);
                    return result;
                } catch (error) {
                    console.error(`Error processing chunk ${i + 1}:`, error);
                    const errorResult = `片段 ${i + 1} 处理失败: ${error.message}`;
                    extractedChunks[i] = errorResult;
                    return errorResult;
                }
            });
            
            await Promise.all(extractionPromises);
            updateProgress(55, `深度分析完成`);
            
            
            updateStepper('step-chunk-extraction', 'completed', `已深度提取 ${chunks.length} 个片段的内容`);
            
            // Display extracted information if visualization is enabled
            if (showProcessDetails) {
                displayExtractedInfo(extractedChunks, extractedInfoDiv);
            }
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Generate report directly from extracted chunks (no need for architect step)
            updateStepper('step-report-generation', 'active');
            updateProgress(58, '直接生成报告...');
            rawDraft = assembleRawDraft(extractedChunks, combinedAnalyses);
            localReport = await finalReportFormatter(rawDraft, model);
            
            // Add report generation details as sub-card
            const reportGenData = `深度报告生成:\n原始草稿长度: ${rawDraft.length} 字符\n格式化后报告长度: ${localReport.length} 字符\n\n生成的报告:\n${localReport}`;
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
            updateProgress(65, '启动主-子代理深度增强...');
            
            // Add spinner to progress text
            addSpinnerToProgressText();
            
            // Create visualization callback to capture subagent data for stepper
            const visualizationCallback = (type, data) => {
                if (type === 'tasks') {
                    if (data && data.enhancement_tasks) {
                        stepperData['step-enhancement'].subCards = data.enhancement_tasks.map(task => ({
                            task,
                            status: 'pending',
                            result: null
                        }));
                        
                        // Tasks are now tracked in stepperData for modal display
                    }

                    if (showProcessDetails) {
                        displaySubagentTasks(data, subagentTasksDiv);
                    }
                    if (currentStepId === 'step-enhancement') {
                        currentCardIndex = 0;
                        updateStepDetailsContent();
                    }
                } else if (type === 'task_started') {
                    // Update unified display with processing status
                    if (data && data.index !== undefined && showProcessDetails) {
                        updateTaskProcessingStatus(data.index, 'processing');
                    }

                    if (stepperData['step-enhancement'].subCards[data.index]) {
                        stepperData['step-enhancement'].subCards[data.index].status = 'processing';
                    }
                    if (currentStepId === 'step-enhancement') updateStepDetailsContent();
                } else if (type === 'subtask_started') {
                    // Subtask started - update with processing status
                    if (stepperData['step-enhancement'].subCards[data.index]) {
                        stepperData['step-enhancement'].subCards[data.index].status = 'processing';
                    }
                    if (currentStepId === 'step-enhancement') updateStepDetailsContent();
                } else if (type === 'subtask_completed') {
                    // Update unified display with individual task completion
                    if (data && data.result && showProcessDetails) {
                        updateTaskWithEnhancement(data.index, data.result);
                    }
                    
                    // Update completion status for modal display refresh
                    const isChanged = data.result.enhanced_content !== data.result.original_quote;
                    console.log(`任务 ${data.index + 1} 完成 - ${isChanged ? '已增强' : '保持原样'}`);
                    
                    // Subtask completed - show immediate result with original vs enhanced comparison
                    const charDiff = data.result.enhanced_content.length - data.result.original_quote.length;
                    const diffText = charDiff > 0 ? `(+${charDiff} 字符)` : charDiff < 0 ? `(${charDiff} 字符)` : '(无变化)';
                    
                    if (stepperData['step-enhancement'].subCards[data.index]) {
                        stepperData['step-enhancement'].subCards[data.index].status = 'completed';
                        stepperData['step-enhancement'].subCards[data.index].result = data.result;
                    }
                    // Refresh modal animation if user is viewing enhancement step
                    if (currentStepId === 'step-enhancement' && currentCardIndex === 0) {
                        updateStepDetailsContent();
                    }
                } else if (type === 'enhancements') {
                    if (data && Array.isArray(data)) {
                        data.forEach((result, index) => {
                            if (stepperData['step-enhancement'].subCards[index]) {
                                stepperData['step-enhancement'].subCards[index].status = 'completed';
                                stepperData['step-enhancement'].subCards[index].result = result;
                            }
                        });
                    }

                    if (currentStepId === 'step-enhancement') updateStepDetailsContent();

                    // Also display in old visualization if enabled
                    if (showProcessDetails) {
                        displayEnhancementDetails(data, enhancementDetailsDiv);
                    }
                }
            };
            
            const enhancedReport = await orchestrateMasterSubAgentSystem(localReport, transcript, allUploadedFiles, model, visualizationCallback);
            
            // Remove spinner from progress text
            removeSpinnerFromProgressText();
            
            if (enhancedReport && typeof enhancedReport === 'string') {
                localReport = enhancedReport;
                updateProgress(75, '增强报告生成完成', `报告长度：${localReport.length} 字符`);
                updateStepper('step-enhancement', 'completed', `主-子代理增强完成，报告长度: ${localReport.length} 字符`);
            } else {
                console.warn('深度增强失败，保持原报告');
                updateProgress(75, '深度增强跳过，保持原报告', `报告长度：${localReport.length} 字符`);
                updateStepper('step-enhancement', 'completed', `深度增强失败，保持原报告长度: ${localReport.length} 字符`);
            }
            
            // Add delay to show this step completion before moving to next
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Set architecturedInfo for technical terms (empty since we removed architect step)
            architecturedInfo = {};
            
            // Quality Control (skipping datapoint existence check per optimization)
            updateProgress(80, '质量控制...');
            try {
                // Citation Verification with all data sources
                const citationVerification = await verifyCitations(localReport, transcript, combinedAnalyses, fileSummaries, allUploadedFiles, model);
                if (!citationVerification.verified && citationVerification.issues?.length > 0) {
                    console.warn('引用验证发现问题:', citationVerification.issues);
                }

                // Excellence Validation with comprehensive data
                const excellenceValidation = await validateExcellence(localReport, transcript, combinedAnalyses, allUploadedFiles, model);
                if (excellenceValidation.score < 80) {
                    console.warn('质量评分较低:', excellenceValidation.score);
                }
                
                // Add quality control details as sub-card for finalization step
                const qualityControlData = `质量控制验证:\n引用验证状态: ${citationVerification.verified ? '通过' : '存在问题'}\n${citationVerification.issues?.length > 0 ? '发现的问题:\n' + citationVerification.issues.join('\n') + '\n' : ''}卓越性评分: ${excellenceValidation.score || 'N/A'}/100\n验证数据源: ${allUploadedFiles.length} 个文件\n转录文本长度: ${transcript.length} 字符`;
                updateStepper('step-finalization', 'active', '', qualityControlData);
                
                updateProgress(85, `验证完成 - 质量评分: ${excellenceValidation.score || 'N/A'}/100`);
            } catch (error) {
                console.error('验证过程出错:', error);
                updateProgress(85, '验证过程出错，继续处理');
                
                // Add error details as sub-card
                const errorData = `质量控制错误:\n错误信息: ${error.message}\n堆栈跟踪: ${error.stack || '无'}`;
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
                    console.warn('偏向性检测失败，保持原报告');
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
            updateProgress(95, '最终专业格式化...');
            try {
                const finalFormattedReport = await finalReportFormatter(localReport, model);
                
                // Add final formatting details as sub-card
                const finalFormattingData = `最终专业格式化 (深度模式):\n格式化前长度: ${localReport.length} 字符\n格式化后长度: ${finalFormattedReport?.length || localReport.length} 字符\n格式化状态: ${finalFormattedReport ? '成功完成专业格式化' : '格式化失败，保持原报告'}\n处理类型: 深度专业格式化\n\n最终报告:\n${finalFormattedReport || localReport}`;
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
            updateProgress(98, '报告生成失败', 'localReport无效');
            reportOutput.innerHTML = `<div class="error">报告生成失败：内部错误，请重试</div>`;
            return;
        }

        // Final steps - Add technical terms if available
        updateProgress(98, '报告生成完成!', 
            isSpeedMode ? '快速模式大幅提升了处理速度' : '完整模式确保最高质量');
        
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
    // Render markdown content using marked
    modalBody.innerHTML = marked.parse(content);
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
                <div class="markdown-content">${marked.parse(chunk)}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayBusinessPlanData(businessPlanAnalysis, container) {
    if (!businessPlanAnalysis || businessPlanAnalysis.length === 0) {
        container.innerHTML = '<h3>商业计划书分析</h3><p>无商业计划书数据</p>';
        return;
    }
    
    // Store full content
    window.fullContentStore.businessPlanData = businessPlanAnalysis;
    
    const html = `
        <h3>商业计划书分析结果</h3>
        <p class="clickable-hint">点击卡片查看完整内容</p>
        <div class="stats">
            <span class="stat-item">数据长度: ${businessPlanAnalysis.length} 字符</span>
            <span class="stat-item">处理时间: ${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="info-item" onclick="showModal('商业计划书分析 - 完整内容', window.fullContentStore.businessPlanData)">
            <h4>提取的商业计划书内容</h4>
            <div class="markdown-content">${marked.parse(businessPlanAnalysis)}</div>
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
            ${formatForDisplay(report)}
            ${report.length > 2000 ? '<p style="text-align: right; color: #007bff; font-size: 0.9em; margin-top: 10px;">点击查看完整报告 →</p>' : ''}
        </div>
    `;
    
    container.innerHTML = html;
}

function displaySubagentTasks(tasks, container) {
    // Store full content
    window.fullContentStore.subagentTasks = tasks;
    
    let html = '<h3>主-子代理增强系统</h3>';
    
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
        <div id="unified-task-display">
    `;
    
    // Create unified task list with processing states
    tasks.enhancement_tasks.forEach((task, index) => {
        const taskId = `task-${index}`;
        html += `
            <div class="unified-task-item" id="${taskId}">
                <div class="task-header">
                    <h4>任务 ${index + 1}: ${task.research_task}</h4>
                    <span class="task-status pending" id="${taskId}-status"></span>
                </div>
                
                <div class="task-details">
                    <div class="task-meta">
                        <span class="priority-badge ${task.priority}">${task.priority.toUpperCase()}</span>
                        <span class="agent-role">🤖 专业数据分析师</span>
                        <span class="task-progress" id="${taskId}-progress" style="display: none;">
                            <div class="spinner-small spinner-processing"></div>
                        </span>
                    </div>
                    
                    <div class="task-description">
                        <div class="description-grid">
                            <div class="description-item">
                                <strong>增强重点:</strong> 
                                <span class="description-value">${task.enhancement_focus}</span>
                            </div>
                            <div class="description-item">
                                <strong>期望改进:</strong> 
                                <span class="description-value">${task.expected_improvement}</span>
                            </div>
                            <div class="description-item">
                                <strong>数据源需求:</strong> 
                                <span class="description-value">${task.data_sources_needed ? task.data_sources_needed.join(', ') : '不适用'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="original-content">
                        <div class="content-label">
                            <span class="label-icon">原始</span>
                            原始内容
                            <span class="content-length">(${task.original_quote.length} 字符)</span>
                        </div>
                        <div class="content-text">${marked.parse(task.original_quote)}</div>
                    </div>
                    
                    <div class="enhanced-content" id="${taskId}-enhanced" style="display: none;">
                        <div class="content-label">
                            <span class="label-icon">增强</span>
                            增强后内容
                            <span class="content-length" id="${taskId}-enhanced-length"></span>
                        </div>
                        <div class="content-text" id="${taskId}-enhanced-text"></div>
                        <div class="improvement-stats" id="${taskId}-stats"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Add initial waiting spinners to all tasks
    tasks.enhancement_tasks.forEach((task, index) => {
        const taskId = `task-${index}`;
        addSpinnerToTaskStatus(`${taskId}-status`, 'waiting');
    });
    
    // Store task data for dynamic updates
    window.subagentTasksData = tasks;
}

// Update individual task with enhancement result
function updateTaskWithEnhancement(taskIndex, enhancementResult) {
    const taskId = `task-${taskIndex}`;
    const statusElement = document.getElementById(`${taskId}-status`);
    const enhancedSection = document.getElementById(`${taskId}-enhanced`);
    const enhancedText = document.getElementById(`${taskId}-enhanced-text`);
    const statsElement = document.getElementById(`${taskId}-stats`);
    const enhancedLength = document.getElementById(`${taskId}-enhanced-length`);
    const taskElement = document.getElementById(taskId);
    
    if (!statusElement || !enhancedSection || !enhancedText || !statsElement) {
        console.warn(`Task elements not found for task ${taskIndex}`);
        return;
    }
    
    // Update status with enhanced styling using dynamic spinner system
    const isChanged = enhancementResult.enhanced_content !== enhancementResult.original_quote;
    addCheckToTaskStatus(`${taskId}-status`);
    statusElement.textContent = '';
    statusElement.className = 'task-status completed';
    
    // Add visual feedback for task completion
    if (taskElement) {
        taskElement.classList.remove('task-processing');
        taskElement.classList.add('task-completed');
    }
    
    // Show enhanced content with animation
    enhancedSection.style.display = 'block';
    enhancedText.innerHTML = marked.parse(enhancementResult.enhanced_content);
    
    // Update enhanced content length indicator
    if (enhancedLength) {
        enhancedLength.textContent = `(${enhancementResult.enhanced_content.length} 字符)`;
    }
    
    // Calculate and show improvement stats with enhanced visuals
    const improvement = enhancementResult.enhanced_content.length - enhancementResult.original_quote.length;
    const improvementPercent = ((improvement / enhancementResult.original_quote.length) * 100).toFixed(1);
    const changeType = improvement > 0 ? 'positive' : improvement < 0 ? 'negative' : 'neutral';
    const changeIcon = improvement > 0 ? '📈' : improvement < 0 ? '📉' : '➖';
    
    statsElement.innerHTML = `
        <div class="stats-row">
            <div class="stat-item">
                <span class="stat-label">原始长度:</span>
                <span class="stat-value">${enhancementResult.original_quote.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">增强后:</span>
                <span class="stat-value">${enhancementResult.enhanced_content.length}</span>
            </div>
            <div class="stat-item improvement-${changeType}">
                <span class="stat-icon">${changeIcon}</span>
                <span class="stat-label">变化:</span>
                <span class="stat-value">${improvement >= 0 ? '+' : ''}${improvement} 字符 (${improvementPercent}%)</span>
            </div>
            ${enhancementResult.error ? `<div class="stat-item error">
                <span class="stat-icon">错误</span>
                <span class="stat-label">错误:</span>
                <span class="stat-value">${enhancementResult.error}</span>
            </div>` : ''}
        </div>
    `;
}

// Update task processing status with dynamic spinners
function updateTaskProcessingStatus(taskIndex, status) {
    const taskId = `task-${taskIndex}`;
    const statusElement = document.getElementById(`${taskId}-status`);
    const taskElement = document.getElementById(taskId);
    const progressElement = document.getElementById(`${taskId}-progress`);
    
    if (statusElement) {
        // Use the new dynamic spinner system
        updateTaskStatusWithSpinner(taskId, status);
        
        // Update CSS classes
        switch(status) {
            case 'processing':
                statusElement.className = 'task-status processing';
                if (taskElement) taskElement.classList.add('task-processing');
                if (progressElement) progressElement.style.display = 'inline-block';
                break;
            case 'error':
                statusElement.className = 'task-status error';
                if (taskElement) taskElement.classList.remove('task-processing');
                if (progressElement) progressElement.style.display = 'none';
                break;
            case 'completed':
                statusElement.className = 'task-status completed';
                if (taskElement) {
                    taskElement.classList.remove('task-processing');
                    taskElement.classList.add('task-completed');
                }
                if (progressElement) progressElement.style.display = 'none';
                break;
            default:
                statusElement.className = 'task-status pending';
                if (taskElement) taskElement.classList.remove('task-processing', 'task-completed');
                if (progressElement) progressElement.style.display = 'none';
        }
    }
}

function displayEnhancementDetails(enhancementResults, container) {
    // This function is now integrated into the unified display
    // Just store the results for reference
    window.fullContentStore.enhancementDetails = enhancementResults;
    
    // Update each task with its enhancement result
    if (enhancementResults && Array.isArray(enhancementResults)) {
        enhancementResults.forEach((result, index) => {
            updateTaskWithEnhancement(index, result);
        });
    }
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load saved API key if exists
    const savedKey = getApiKey();
    
    // If we have a saved API key, initialize the client immediately
    if (savedKey) {
        try {
            initGeminiClient(savedKey);
            console.log('Gemini client initialized with saved API key');
        } catch (error) {
            console.error('Failed to initialize Gemini client with saved key:', error);
        }
    }
    
    // API key input listener - initialize client when user enters/changes API key
    document.getElementById('apiKey').addEventListener('blur', () => {
        const apiKey = document.getElementById('apiKey').value.trim();
        if (apiKey) {
            saveApiKey(apiKey);
            try {
                initGeminiClient(apiKey);
                console.log('Gemini client initialized with new API key');
            } catch (error) {
                console.error('Failed to initialize Gemini client:', error);
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