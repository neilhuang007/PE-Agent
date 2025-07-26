// Simple test script for Gemini API wrapper
import { initGeminiClient, generateWithRetry, convertContentParts } from './src/utils/gemini-wrapper.js';

console.log('Testing Gemini API Wrapper...\n');

// Test 1: convertContentParts
console.log('Test 1: convertContentParts');
try {
  const parts = [{ text: 'Hello world' }];
  const result = convertContentParts(parts);
  console.log('✓ Text conversion:', JSON.stringify(result));
} catch (error) {
  console.log('✗ Text conversion failed:', error.message);
}

// Test 2: convertContentParts with file data
console.log('\nTest 2: convertContentParts with file data');
try {
  const parts = [
    { text: 'Check this file:' },
    { fileData: { mimeType: 'image/png', fileUri: 'https://example.com/image.png' } }
  ];
  const result = convertContentParts(parts);
  console.log('✓ File data conversion:', JSON.stringify(result));
} catch (error) {
  console.log('✗ File data conversion failed:', error.message);
}

// Test 3: API call without initialization
console.log('\nTest 3: API call without initialization');
try {
  const contents = [{ role: 'user', parts: [{ text: 'test' }] }];
  await generateWithRetry(contents, 'Test prompt');
  console.log('✗ Should have thrown error for uninitialized client');
} catch (error) {
  console.log('✓ Correctly threw error:', error.message);
}

// Test 4: Integration test (if API key is available)
console.log('\nTest 4: Integration test with actual API');
const apiKey = "";
if (!apiKey) {
  console.log('⚠ Skipped - GEMINI_API_KEY not set');
} else {
  try {
    initGeminiClient(apiKey, 'http://127.0.0.1:10809');
    
    const contents = [{
      role: 'user',
      parts: [{ text: 'Say "Hello test" and nothing else.' }]
    }];
    
    console.log('Making API call...');
    const result = await generateWithRetry(
      contents,
      'You are a helpful assistant that follows instructions precisely.',
      -1,
      'gemini-2.5-pro',
      1
    );
    
    console.log('✓ API response:', result.substring(0, 100) + '...');
  } catch (error) {
    console.log('✗ API call failed:', error.message);
  }
}

console.log('\nTests completed!');