// Utility to load prompts from JSON files
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded prompts
const promptCache = {};

/**
 * Load prompts from a JSON file
 * @param {string} fileName - Name of the JSON file (without extension)
 * @returns {Object} Parsed JSON content
 */
export function loadPrompts(fileName) {
    if (promptCache[fileName]) {
        return promptCache[fileName];
    }

    try {
        const filePath = join(__dirname, '..', '..', '..', 'prompts', `${fileName}.json`);
        const content = readFileSync(filePath, 'utf-8');
        promptCache[fileName] = JSON.parse(content);
        return promptCache[fileName];
    } catch (error) {
        console.error(`Error loading prompts from ${fileName}:`, error);
        throw error;
    }
}

/**
 * Get a specific prompt from a loaded prompts file
 * @param {string} fileName - Name of the JSON file
 * @param {string} promptPath - Dot-separated path to the prompt
 * @returns {string|Object} The requested prompt
 */
export function getPrompt(fileName, promptPath) {
    const prompts = loadPrompts(fileName);
    const pathParts = promptPath.split('.');
    
    let current = prompts;
    for (const part of pathParts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            throw new Error(`Prompt path '${promptPath}' not found in ${fileName}`);
        }
    }
    
    return current;
}

/**
 * Format a prompt template with variables
 * @param {string} template - Template string with {variable} placeholders
 * @param {Object} variables - Object with variable values
 * @returns {string} Formatted prompt
 */
export function formatPrompt(template, variables = {}) {
    let formatted = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        formatted = formatted.replace(regex, value);
    }
    return formatted;
}

/**
 * Build a complete prompt from components
 * @param {Object} components - Object with prompt components (role, task, requirements, etc.)
 * @returns {string} Complete formatted prompt
 */
export function buildPrompt(components) {
    const parts = [];
    
    if (components.role) {
        parts.push(components.role);
    }
    
    if (components.taskIntro || components.mainTask) {
        parts.push(components.taskIntro || components.mainTask);
    }
    
    if (components.requirements && Array.isArray(components.requirements)) {
        parts.push('\n要求：');
        components.requirements.forEach((req, i) => {
            parts.push(`${i + 1}. ${req}`);
        });
    }
    
    if (components.outputFormat) {
        parts.push('\n输出格式：');
        if (typeof components.outputFormat === 'string') {
            parts.push(components.outputFormat);
        } else {
            parts.push(JSON.stringify(components.outputFormat, null, 2));
        }
    }
    
    if (components.thinkingPrompt) {
        parts.push('\n' + components.thinkingPrompt);
    }
    
    return parts.join('\n\n');
}

// Preload all prompts for faster access
export function preloadAllPrompts() {
    const promptFiles = [
        'enhanced-agents-prompts',
        'fast-agents-prompts',
        'master-subagent-prompts',
        'specialized-agents-prompts',
        'other-agents-prompts'
    ];
    
    promptFiles.forEach(file => {
        try {
            loadPrompts(file);
            console.log(`✓ Loaded prompts from ${file}`);
        } catch (error) {
            console.error(`✗ Failed to load ${file}:`, error.message);
        }
    });
}