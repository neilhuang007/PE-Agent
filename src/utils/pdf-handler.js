// PDF handling functions

// Load PDF.js library dynamically
export async function loadPDFJS() {
    if (window.pdfjsLib) return window.pdfjsLib;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Extract text from PDF file
export async function extractTextFromPDF(file) {
    try {
        const pdfjsLib = await loadPDFJS();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        const numPages = pdf.numPages;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        
        return fullText;
    } catch (error) {
        console.error('Error extracting PDF text:', error);
        return '';
    }
}

// Read multiple PDF files and combine their content
export async function readPDFs(files) {
    if (!files || files.length === 0) {
        return '';
    }
    
    const pdfTexts = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`正在读取PDF文件: ${file.name}`);
        
        const text = await extractTextFromPDF(file);
        if (text) {
            pdfTexts.push(`\n--- ${file.name} ---\n${text}`);
        }
    }
    
    return pdfTexts.join('\n\n');
}