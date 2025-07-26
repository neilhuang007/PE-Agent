// Test for Gemini API wrapper
import { initGeminiClient, generateWithRetry, convertContentParts } from './src/utils/gemini-wrapper.js';

async function runTests() {
  console.log('Gemini API Wrapper Tests\n');
  
  // Test 1: Content conversion
  console.log('Test 1: Content conversion');
  try {
    const textParts = convertContentParts([{ text: 'Hello world' }]);
    console.log('✓ Text conversion:', JSON.stringify(textParts));
    
    const fileParts = convertContentParts([
      { text: 'Check this:' },
      { fileData: { mimeType: 'image/png', fileUri: 'https://example.com/image.png' } }
    ]);
    console.log('✓ File conversion:', JSON.stringify(fileParts));
  } catch (error) {
    console.log('✗ Conversion failed:', error.message);
  }
  
  // Test 2: Error handling without initialization
  console.log('\nTest 2: Error handling');
  try {
    await generateWithRetry([{ role: 'user', parts: [{ text: 'test' }] }], 'Test prompt');
    console.log('✗ Should have thrown error');
  } catch (error) {
    console.log('✓ Correctly threw error:', error.message);
  }
  
  // Test 3: API call with proxy (requires API key)
  console.log('\nTest 3: API call with proxy');
  const apiKey = process.env.GEMINI_API_KEY || '';
  const proxyUrl = 'http://127.0.0.1:10809';
  
  if (!apiKey) {
    console.log('⚠ Skipped - Set GEMINI_API_KEY environment variable to test');
    return;
  }
  
  try {
    initGeminiClient(apiKey, proxyUrl);
    
    const contents = [{
      role: 'user',
      parts: [{ text: 'Say "Hello from Gemini" and nothing else.' }]
    }];
    
    console.log('Making API call through proxy...');
    const result = await generateWithRetry(
      contents,
      'You are a helpful assistant that follows instructions precisely.',
      -1,
      'gemini-2.5-pro',
      1
    );
    
    console.log('✓ Response:', result);
  } catch (error) {
    console.log('✗ API call failed:', error.message);
  }
}

runTests().catch(console.error);