// Word Document Export Utility
// Creates formatted Word documents with Chinese font support

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

/**
 * Parse markdown content and extract sections with titles
 * @param {string} markdown - Markdown content
 * @returns {Array} Array of sections with titles and content
 */
function parseMarkdownSections(markdown) {
    const sections = [];
    const lines = markdown.split('\n');

    let currentSection = null;
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for main title (# Title)
        if (line.startsWith('# ')) {
            if (currentSection) {
                currentSection.content = currentContent.join('\n');
                sections.push(currentSection);
            }
            currentSection = {
                type: 'title',
                text: line.replace(/^#\s+/, '').trim(),
                content: ''
            };
            currentContent = [];
        }
        // Check for subtitle (## Subtitle)
        else if (line.startsWith('## ')) {
            if (currentSection) {
                currentSection.content = currentContent.join('\n');
                sections.push(currentSection);
            }
            currentSection = {
                type: 'subtitle',
                text: line.replace(/^##\s+/, '').trim(),
                content: ''
            };
            currentContent = [];
        }
        // Check for sub-subtitle (### Sub-subtitle)
        else if (line.startsWith('### ')) {
            if (currentSection) {
                currentSection.content = currentContent.join('\n');
                sections.push(currentSection);
            }
            currentSection = {
                type: 'subsubtitle',
                text: line.replace(/^###\s+/, '').trim(),
                content: ''
            };
            currentContent = [];
        }
        // Regular content
        else {
            currentContent.push(line);
        }
    }

    // Push the last section
    if (currentSection) {
        currentSection.content = currentContent.join('\n');
        sections.push(currentSection);
    }

    return sections;
}

/**
 * Create formatted paragraphs from text with proper spacing
 * @param {string} text - Text content
 * @param {boolean} isBold - Whether text should be bold
 * @param {boolean} isTitle - Whether this is a title
 * @returns {Array} Array of Paragraph objects
 */
function createFormattedParagraphs(text, isBold = false, isTitle = false) {
    const paragraphs = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Remove markdown formatting
        let cleanLine = line
            .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
            .replace(/\*(.*?)\*/g, '$1')      // Remove italic
            .replace(/^[-*+]\s+/, '')         // Remove bullet points
            .replace(/^\d+\.\s+/, '');        // Remove numbered lists

        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: cleanLine,
                        font: {
                            name: "Times New Roman",      // ASCII font
                            eastAsia: "华文楷体"            // Chinese font (STKaiti)
                        },
                        size: 24,  // 12pt = 24 half-points
                        bold: isBold
                    })
                ],
                spacing: {
                    after: 120,  // 6pt after paragraph (120 twips = 6pt)
                }
            })
        );
    }

    return paragraphs;
}

/**
 * Export report to Word document
 * @param {string} report - Report content in markdown format
 * @param {string} companyName - Company name for filename
 * @returns {Promise<void>}
 */
export async function exportToWord(report, companyName) {
    try {
        console.log('📄 Creating Word document...');

        // Parse markdown into sections
        const sections = parseMarkdownSections(report);

        // Create document paragraphs
        const documentChildren = [];

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];

            // Add blank line before subtitle (except for the first section)
            if (section.type === 'subtitle' && i > 0) {
                documentChildren.push(
                    new Paragraph({
                        text: "",
                        spacing: { after: 240 }  // 1 blank line (12pt = 240 twips)
                    })
                );
            }

            // Add the title/subtitle
            if (section.type === 'title') {
                // Main title - bold and larger
                documentChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: section.text,
                                font: {
                                    name: "Times New Roman",
                                    eastAsia: "华文楷体"
                                },
                                size: 32,  // 16pt for main title
                                bold: true
                            })
                        ],
                        spacing: {
                            after: 240  // 1 blank line after title
                        },
                        alignment: AlignmentType.CENTER
                    })
                );
            } else if (section.type === 'subtitle') {
                // Subtitle - bold
                documentChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: section.text,
                                font: {
                                    name: "Times New Roman",
                                    eastAsia: "华文楷体"
                                },
                                size: 28,  // 14pt for subtitle
                                bold: true
                            })
                        ],
                        spacing: {
                            after: 120  // 6pt after subtitle
                        }
                    })
                );
            } else if (section.type === 'subsubtitle') {
                // Sub-subtitle - bold
                documentChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: section.text,
                                font: {
                                    name: "Times New Roman",
                                    eastAsia: "华文楷体"
                                },
                                size: 24,  // 12pt for sub-subtitle
                                bold: true
                            })
                        ],
                        spacing: {
                            after: 120  // 6pt after sub-subtitle
                        }
                    })
                );
            }

            // Add the content paragraphs
            if (section.content && section.content.trim()) {
                const contentParagraphs = createFormattedParagraphs(section.content);
                documentChildren.push(...contentParagraphs);
            }

            // Add blank line after each section (except the last one)
            if (i < sections.length - 1) {
                documentChildren.push(
                    new Paragraph({
                        text: "",
                        spacing: { after: 240 }  // 1 blank line (12pt = 240 twips)
                    })
                );
            }
        }

        // Create the document
        const doc = new Document({
            sections: [{
                properties: {},
                children: documentChildren
            }]
        });

        // Generate blob
        const blob = await Packer.toBlob(doc);

        // Create filename
        const date = new Date().toISOString().split('T')[0];
        const filename = `${companyName}访谈纪要_${date}.docx`;

        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        console.log(`✅ Word document exported: ${filename}`);

    } catch (error) {
        console.error('❌ Error exporting to Word:', error);
        throw error;
    }
}
