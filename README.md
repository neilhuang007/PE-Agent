# PE Interview Report Generator / 私募股权访谈报告生成器

A client-side web application for generating professional Private Equity interview assessment reports in Chinese.

## Features

- **100% Client-Side**: No server required, runs entirely in the browser
- **Multi-Agent Architecture**: Uses 5 specialized AI agents for comprehensive report generation
- **Real-time Progress Tracking**: Visual feedback showing each processing stage
- **Chinese Report Format**: Generates reports following PE industry standards
- **Secure API Key Storage**: API keys stored locally in browser, never sent to any server
- **PDF Support**: Uses Gemini Files API for native PDF processing - PDFs are uploaded and analyzed directly by AI
- **Automatic File Cleanup**: Uploaded files are automatically deleted after 5 minutes

## How to Use

1. Open `index.html` in your web browser (must be served via HTTP for module imports to work)
   - Use a local server like `python -m http.server 8000` or VS Code Live Server
2. Enter your [Gemini API Key](https://makersuite.google.com/app/apikey)
3. Fill in the form:
   - Company name (公司名称)
   - Interviewee role (受访者职位)
   - Interview transcript (访谈记录)
   - Optional: Upload PDF documents (will be extracted and included in analysis)
4. Click "生成报告" to generate the report
5. Download the completed report as a text file

## File Structure

- `index.html` - Main HTML page
- `styles.css` - All styling
- `main.js` - Core application logic
- `agents.js` - AI agent functions (summarize, organize, compose, verify)
- `pdf-handler.js` - PDF extraction using PDF.js
- `utils.js` - Utility functions

## Report Structure

The generated reports include:
- 【公司简介】Company Overview
- 【行业情况】Industry Analysis
- 【主营业务】Core Business
- 【财务情况】Financial Status
- 【融资情况】Funding History

## Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Gemini API Key from Google AI Studio
- Internet connection for API calls

## Example Report

The tool generates professional PE interview assessment reports following Chinese business standards with proper hierarchical formatting.