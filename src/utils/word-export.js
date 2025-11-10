// Word Document Export Utility
// Creates formatted Word documents with hierarchical Chinese formatting
// Based on comprehensive document formatting template

import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';

/**
 * Convert inches to twips (1 inch = 1440 twips)
 */
const inchesToTwips = (inches) => Math.round(inches * 1440);

/**
 * Formatting configuration based on template specifications
 */
const FORMATTING_CONFIG = {
    // Font settings
    font: {
        family: "Times New Roman",      // ASCII font
        eastAsia: "华文楷体",             // Chinese font (STKaiti)
        size: 24                         // 12pt = 24 half-points
    },

    // Page setup
    page: {
        width: inchesToTwips(8.27),   // A4 width
        height: inchesToTwips(11.69), // A4 height
        margins: {
            top: inchesToTwips(1),
            bottom: inchesToTwips(1),
            left: inchesToTwips(1),
            right: inchesToTwips(1)
        }
    },

    // Hierarchy levels
    levels: {
        // Level 0: Document Header
        documentHeader: {
            title: { size: 28, bold: true, spacing: { after: 120 } },      // 14pt
            date: { size: 24, bold: false, spacing: { after: 120 } },       // 12pt
            metadata: { size: 24, bold: false, spacing: { after: 480 } }    // 12pt, 2 blank lines after
        },

        // Level 1: Main Section 【】
        mainSection: {
            size: 28,                    // 14pt
            bold: true,
            spacing: { before: 480, after: 240 },  // 2 blank lines before, 1 after
            indent: 0
        },

        // Level 2: Subsection Header
        subsection: {
            size: 26,                    // 13pt
            bold: true,
            spacing: { before: 240, after: 120 },  // 1 blank line before, 6pt after
            indent: 0
        },

        // Level 3: Numbered Items (1. 2. 3.)
        numbered: {
            size: 24,                    // 12pt
            bold: false,
            spacing: { after: 120 },     // 6pt after
            indent: inchesToTwips(0),
            hanging: inchesToTwips(0.25)
        },

        // Level 4: Body Paragraph
        body: {
            size: 24,                    // 12pt
            bold: false,
            spacing: { after: 120 },     // 6pt after
            indent: 0
        },

        // Level 5: Sub-items (a. b. c.)
        subitem: {
            size: 24,                    // 12pt
            bold: false,
            spacing: { after: 120 },     // 6pt after
            indent: inchesToTwips(0.5),
            hanging: inchesToTwips(0.25)
        },

        // Level 6: Bullet Points
        bullet: {
            size: 24,                    // 12pt
            bold: false,
            spacing: { after: 120 },     // 6pt after
            indent: inchesToTwips(0.25),
            hanging: inchesToTwips(0.25)
        }
    }
};

/**
 * Pattern detection functions
 */
const Patterns = {
    // Level 1: Main Section 【】
    isMainSection: (line) => /^【.*】$/.test(line.trim()),

    // Level 3: Numbered items (1. 2. 3.)
    isNumbered: (line) => /^\d+\.\s+/.test(line.trim()),

    // Level 5: Sub-items (a. b. c.)
    isSubitem: (line) => /^[a-z]\.\s+/i.test(line.trim()),

    // Level 6: Bullet points (• - –)
    isBullet: (line) => /^[•\-–]\s+/.test(line.trim()),

    // Mixed formatting (Label: Description or Label - Description)
    isMixedFormat: (line) => {
        const trimmed = line.trim();
        return /^[^:：\-–—]+[:：\-–—]\s*.+/.test(trimmed);
    },

    // Detect if line is a subsection header (short, no special markers)
    isSubsectionHeader: (line, nextLine) => {
        const trimmed = line.trim();
        // Must be short (< 50 chars), not contain special markers, and followed by longer content
        if (trimmed.length === 0 || trimmed.length > 50) return false;
        if (Patterns.isMainSection(trimmed) ||
            Patterns.isNumbered(trimmed) ||
            Patterns.isSubitem(trimmed) ||
            Patterns.isBullet(trimmed)) return false;

        // Check if next line is longer (body text)
        if (nextLine && nextLine.trim().length > trimmed.length) {
            return true;
        }
        return false;
    },

    // Extract mixed format parts (returns {bold, regular})
    splitMixedFormat: (line) => {
        const trimmed = line.trim();
        // Try to split on colon or dash
        const match = trimmed.match(/^([^:：\-–—]+)([:：\-–—]\s*.*)$/);
        if (match) {
            return {
                bold: match[1],
                regular: match[2]
            };
        }
        return null;
    }
};

/**
 * Parse markdown content and identify formatting levels
 * @param {string} markdown - Markdown content
 * @returns {Array} Array of parsed elements with formatting info
 */
function parseContent(markdown) {
    const elements = [];
    const lines = markdown.split('\n');

    let i = 0;
    let inDocumentHeader = true;
    let headerLineCount = 0;

    while (i < lines.length) {
        const line = lines[i];
        const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            i++;
            continue;
        }

        // Handle markdown headings (convert to appropriate levels)
        if (line.startsWith('# ')) {
            // Main title - treat as document header title
            elements.push({
                type: 'documentHeader',
                subtype: 'title',
                text: line.replace(/^#\s+/, '').trim()
            });
            inDocumentHeader = false;
            i++;
            continue;
        }

        if (line.startsWith('## ')) {
            // Subtitle - treat as main section or convert to 【】
            let text = line.replace(/^##\s+/, '').trim();
            // If text contains underline markdown or bold, clean it
            text = text.replace(/\*\*\[(.*?)\]\{\.underline\}\*\*/g, '$1')
                      .replace(/\[(.*?)\]\{\.underline\}/g, '$1')
                      .replace(/\*\*(.*?)\*\*/g, '$1');

            // Check if it already has 【】, if not add them
            if (!Patterns.isMainSection(text)) {
                text = `【${text}】`;
            }

            elements.push({
                type: 'mainSection',
                text: text
            });
            i++;
            continue;
        }

        if (line.startsWith('### ')) {
            // Sub-subtitle - treat as subsection header
            elements.push({
                type: 'subsection',
                text: line.replace(/^###\s+/, '').trim()
            });
            i++;
            continue;
        }

        // Level 0: Document header detection (first 3 lines if not markdown)
        if (inDocumentHeader && headerLineCount < 3 && !line.startsWith('#')) {
            let subtype = 'metadata';
            if (headerLineCount === 0) subtype = 'title';
            else if (headerLineCount === 1 && /\d{4}/.test(trimmed)) subtype = 'date';

            elements.push({
                type: 'documentHeader',
                subtype: subtype,
                text: trimmed
            });
            headerLineCount++;

            if (headerLineCount >= 3) {
                inDocumentHeader = false;
            }
            i++;
            continue;
        }

        // Level 1: Main Section 【】
        if (Patterns.isMainSection(trimmed)) {
            elements.push({
                type: 'mainSection',
                text: trimmed
            });
            i++;
            continue;
        }

        // Level 3: Numbered items
        if (Patterns.isNumbered(trimmed)) {
            elements.push({
                type: 'numbered',
                text: trimmed
            });
            i++;
            continue;
        }

        // Level 5: Sub-items
        if (Patterns.isSubitem(trimmed)) {
            elements.push({
                type: 'subitem',
                text: trimmed
            });
            i++;
            continue;
        }

        // Level 6: Bullet points
        if (Patterns.isBullet(trimmed)) {
            elements.push({
                type: 'bullet',
                text: trimmed
            });
            i++;
            continue;
        }

        // Level 2: Subsection headers (heuristic detection)
        if (Patterns.isSubsectionHeader(trimmed, nextLine)) {
            elements.push({
                type: 'subsection',
                text: trimmed
            });
            i++;
            continue;
        }

        // Mixed formatting detection
        if (Patterns.isMixedFormat(trimmed)) {
            const parts = Patterns.splitMixedFormat(trimmed);
            if (parts) {
                elements.push({
                    type: 'mixedFormat',
                    bold: parts.bold,
                    regular: parts.regular
                });
                i++;
                continue;
            }
        }

        // Level 4: Body paragraph (default)
        elements.push({
            type: 'body',
            text: trimmed
        });
        i++;
    }

    return elements;
}

/**
 * Create a paragraph with proper formatting based on element type
 * @param {Object} element - Parsed element
 * @returns {Paragraph} Formatted paragraph
 */
function createParagraph(element) {
    const config = FORMATTING_CONFIG.levels;
    const fontConfig = FORMATTING_CONFIG.font;

    switch (element.type) {
        case 'documentHeader':
            const headerConfig = config.documentHeader[element.subtype];
            return new Paragraph({
                children: [
                    new TextRun({
                        text: element.text,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: headerConfig.size,
                        bold: headerConfig.bold
                    })
                ],
                spacing: headerConfig.spacing,
                alignment: element.subtype === 'title' ? AlignmentType.LEFT : AlignmentType.LEFT
            });

        case 'mainSection':
            return new Paragraph({
                children: [
                    new TextRun({
                        text: element.text,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: config.mainSection.size,
                        bold: config.mainSection.bold
                    })
                ],
                spacing: config.mainSection.spacing,
                indent: { left: config.mainSection.indent }
            });

        case 'subsection':
            return new Paragraph({
                children: [
                    new TextRun({
                        text: element.text,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: config.subsection.size,
                        bold: config.subsection.bold
                    })
                ],
                spacing: config.subsection.spacing,
                indent: { left: config.subsection.indent }
            });

        case 'numbered':
            // Remove the number prefix and create properly indented paragraph
            let numberedText = element.text.replace(/^\d+\.\s+/, '');
            const numberMatch = element.text.match(/^(\d+)\.\s+/);
            const number = numberMatch ? numberMatch[1] : '';

            return new Paragraph({
                children: [
                    new TextRun({
                        text: `${number}. ${numberedText}`,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: config.numbered.size,
                        bold: config.numbered.bold
                    })
                ],
                spacing: config.numbered.spacing,
                indent: {
                    left: config.numbered.indent,
                    hanging: config.numbered.hanging
                }
            });

        case 'subitem':
            // Remove the letter prefix
            let subitemText = element.text.replace(/^[a-z]\.\s+/i, '');
            const letterMatch = element.text.match(/^([a-z])\.\s+/i);
            const letter = letterMatch ? letterMatch[1] : '';

            return new Paragraph({
                children: [
                    new TextRun({
                        text: `${letter}. ${subitemText}`,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: config.subitem.size,
                        bold: config.subitem.bold
                    })
                ],
                spacing: config.subitem.spacing,
                indent: {
                    left: config.subitem.indent,
                    hanging: config.subitem.hanging
                }
            });

        case 'bullet':
            // Remove the bullet character
            const bulletText = element.text.replace(/^[•\-–]\s+/, '');

            return new Paragraph({
                children: [
                    new TextRun({
                        text: `• ${bulletText}`,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: config.bullet.size,
                        bold: config.bullet.bold
                    })
                ],
                spacing: config.bullet.spacing,
                indent: {
                    left: config.bullet.indent,
                    hanging: config.bullet.hanging
                }
            });

        case 'mixedFormat':
            // Create paragraph with multiple runs (bold + regular)
            return new Paragraph({
                children: [
                    new TextRun({
                        text: element.bold,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: fontConfig.size,
                        bold: true
                    }),
                    new TextRun({
                        text: element.regular,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: fontConfig.size,
                        bold: false
                    })
                ],
                spacing: config.body.spacing
            });

        case 'body':
        default:
            // Clean markdown formatting from body text
            let bodyText = element.text
                .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
                .replace(/\*(.*?)\*/g, '$1')      // Remove italic
                .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Remove links

            return new Paragraph({
                children: [
                    new TextRun({
                        text: bodyText,
                        font: {
                            name: fontConfig.family,
                            eastAsia: fontConfig.eastAsia
                        },
                        size: config.body.size,
                        bold: config.body.bold
                    })
                ],
                spacing: config.body.spacing,
                indent: { left: config.body.indent }
            });
    }
}

/**
 * Export report to Word document with hierarchical formatting
 * @param {string} report - Report content in markdown format
 * @param {string} companyName - Company name for filename
 * @returns {Promise<void>}
 */
export async function exportToWord(report, companyName) {
    try {
        console.log('📄 Creating Word document with hierarchical formatting...');

        // Parse content into formatted elements
        const elements = parseContent(report);

        console.log(`📊 Parsed ${elements.length} elements:`,
            elements.reduce((acc, el) => {
                acc[el.type] = (acc[el.type] || 0) + 1;
                return acc;
            }, {})
        );

        // Create document paragraphs
        const documentChildren = elements.map(element => createParagraph(element));

        // Create the document
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        width: FORMATTING_CONFIG.page.width,
                        height: FORMATTING_CONFIG.page.height,
                        margin: FORMATTING_CONFIG.page.margins
                    }
                },
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
        console.log(`📋 Document structure validated:
  - Document Header: ${elements.filter(e => e.type === 'documentHeader').length}
  - Main Sections 【】: ${elements.filter(e => e.type === 'mainSection').length}
  - Subsections: ${elements.filter(e => e.type === 'subsection').length}
  - Numbered Items: ${elements.filter(e => e.type === 'numbered').length}
  - Body Paragraphs: ${elements.filter(e => e.type === 'body').length}
  - Sub-items: ${elements.filter(e => e.type === 'subitem').length}
  - Bullet Points: ${elements.filter(e => e.type === 'bullet').length}
  - Mixed Format: ${elements.filter(e => e.type === 'mixedFormat').length}`);

    } catch (error) {
        console.error('❌ Error exporting to Word:', error);
        throw error;
    }
}
