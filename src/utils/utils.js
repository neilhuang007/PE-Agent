// Utility functions

// Chunk transcript into smaller pieces - optimized for parallel processing
export function chunkTranscript(transcript, maxChunks = 6) {
    const paragraphs = transcript.split(/\n\n+/).filter(p => p.trim());
    
    // Optimize chunk size based on content length and desired parallelism
    const optimalChunkSize = Math.max(2, Math.ceil(paragraphs.length / maxChunks));
    const chunks = [];
    
    for (let i = 0; i < paragraphs.length; i += optimalChunkSize) {
        chunks.push(paragraphs.slice(i, i + optimalChunkSize).join('\n\n'));
    }
    
    // chunks.length should already be <= maxChunks based on optimalChunkSize
    // Return all chunks so no content is dropped
    return chunks;
}

// Update progress UI
export function updateProgress(percentage, message, details = '', validationInfo = null) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const chunkDetails = document.getElementById('chunkDetails');
    const validationStatus = document.getElementById('validationStatus');
    
    progressFill.style.width = percentage + '%';
    progressText.textContent = message;
    
    if (details) {
        chunkDetails.style.display = 'block';
        chunkDetails.innerHTML = details;
    }
    
    if (validationInfo) {
        validationStatus.classList.add('active');
        validationStatus.innerHTML = `
            <div>质量评分: <span class="quality-score">${validationInfo.score}/100</span></div>
            <div>验证状态: ${validationInfo.pass ? '✅ 通过' : '🔄 优化中...'}</div>
            ${validationInfo.issues ? `<div>发现问题: ${validationInfo.issues}</div>` : ''}
        `;
    }
}

// Get API key from local storage or input
export function getApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }
    return apiKeyInput.value;
}

// Save API key to local storage
export function saveApiKey(apiKey) {
    localStorage.setItem('gemini_api_key', apiKey);
}

// Download report as markdown file
export function downloadReport(report) {
    const companyName = document.getElementById('companyName').value;
    const date = new Date().toISOString().split('T')[0];
    const filename = `${companyName}访谈纪要_${date}.md`;
    
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Build a raw draft from extracted information and file analyses
export function assembleRawDraft(extractedChunks, fileAnalyses = '') {
    const parts = [];
    if (Array.isArray(extractedChunks)) {
        parts.push(extractedChunks.join('\n\n'));
    } else if (extractedChunks) {
        parts.push(String(extractedChunks));
    }
    if (fileAnalyses) {
        parts.push(String(fileAnalyses));
    }
    return parts.filter(Boolean).join('\n\n');
}