import { initGeminiClient, generateWithRetry, convertContentParts } from './gemini-wrapper.js';
// Simple test runner
const tests = [];
let passed = 0;
let failed = 0;
function test(name, fn) {
    tests.push({ name, fn });
}
async function runTests() {
    console.log('Running Gemini Wrapper Tests...\n');
    for (const { name, fn } of tests) {
        try {
            await fn();
            console.log(`✓ ${name}`);
            passed++;
        }
        catch (error) {
            console.log(`✗ ${name}`);
            console.error(`  Error: ${error}`);
            failed++;
        }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}
// Unit Tests
test('convertContentParts should convert text parts correctly', async () => {
    const parts = [{ text: 'Hello world' }];
    const result = convertContentParts(parts);
    if (result.length !== 1)
        throw new Error('Expected 1 content item');
    const firstContent = result[0];
    if (!firstContent || firstContent.role !== 'user')
        throw new Error('Expected role to be "user"');
    if (firstContent.parts.length !== 1)
        throw new Error('Expected 1 part');
    const firstPart = firstContent.parts[0];
    if (!firstPart || !('text' in firstPart) || firstPart.text !== 'Hello world') {
        throw new Error('Text part not converted correctly');
    }
});
test('convertContentParts should handle file data', async () => {
    const parts = [
        { text: 'Check this file:' },
        { fileData: { mimeType: 'image/png', fileUri: 'https://example.com/image.png' } }
    ];
    const result = convertContentParts(parts);
    const firstContent = result[0];
    if (!firstContent || firstContent.parts.length !== 2)
        throw new Error('Expected 2 parts');
    const secondPart = firstContent.parts[1];
    if (!secondPart || !('fileData' in secondPart))
        throw new Error('File data not included');
});
test('generateWithRetry should throw if client not initialized', async () => {
    const contents = [{ role: 'user', parts: [{ text: 'test' }] }];
    try {
        await generateWithRetry(contents, 'Test prompt');
        throw new Error('Expected error for uninitialized client');
    }
    catch (error) {
        if (!error.message.includes('not initialized')) {
            throw new Error('Wrong error message');
        }
    }
});
// Integration test (requires API key)
test('integration: should generate content with actual API', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('  (Skipped - GEMINI_API_KEY not set)');
        return;
    }
    // Initialize client
    initGeminiClient(apiKey);
    // Create simple content
    const contents = [{
            role: 'user',
            parts: [{ text: 'Say "Hello test" and nothing else.' }]
        }];
    // Test generation
    const result = await generateWithRetry(contents, 'You are a helpful assistant that follows instructions precisely.', -1, 'gemini-2.5-pro', 1);
    if (!result || typeof result !== 'string') {
        throw new Error('Expected string response');
    }
    console.log(`  Response: ${result.substring(0, 50)}...`);
});
// Run all tests
runTests().catch(console.error);
