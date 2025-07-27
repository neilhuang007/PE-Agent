// Test for Gemini API wrapper
// To run: node test-gemini.js
// API key is loaded from .env file

import 'dotenv/config';

import { initGeminiClient, generateWithRetry, convertContentParts } from './src/utils/gemini-wrapper.js';

async function runTests() {
  console.log('=== Gemini API Wrapper Tests ===\n');
  
  // Test 1: Content conversion - text only
  console.log('Test 1: Convert text parts to Content structure');
  try {
    const textParts = convertContentParts([{ text: 'Hello world' }]);
    console.log('✓ Text conversion successful');
    console.log('  Result:', JSON.stringify(textParts));
  } catch (error) {
    console.log('✗ Text conversion failed:', error.message);
  }
  
  // Test 2: Content conversion - mixed content
  console.log('\nTest 2: Convert mixed parts (text + file)');
  try {
    const mixedParts = convertContentParts([
      { text: 'Analyze this image:' },
      { fileData: { mimeType: 'image/png', fileUri: 'https://example.com/image.png' } }
    ]);
    console.log('✓ Mixed content conversion successful');
    console.log('  Result:', JSON.stringify(mixedParts));
  } catch (error) {
    console.log('✗ Mixed conversion failed:', error.message);
  }
  
  // Test 3: Error handling - uninitialized client
  console.log('\nTest 3: Error handling for uninitialized client');
  try {
    const contents = [{ role: 'user', parts: [{ text: 'test' }] }];
    await generateWithRetry(contents, 'You are a helpful assistant');
    console.log('✗ Expected error for uninitialized client');
  } catch (error) {
    console.log('✓ Correctly caught error:', error.message);
  }
  
  // Test 4: API call WITHOUT proxy (SDK mode)
  console.log('\nTest 4: API call without proxy (using SDK)');
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('  API key:', apiKey);

  if (!apiKey) {
    console.log('⚠ Skipped - Set GEMINI_API_KEY environment variable');
  } else {
    try {
      // Initialize without proxy
      initGeminiClient(apiKey);
      console.log('✓ Initialized client without proxy');
      
      const contents = [{
        role: 'user',
        parts: [{ text: 'Say "Hello from SDK" and nothing else.' }]
      }];
      
      console.log('  Making API call via SDK...');
      const result = await generateWithRetry(
        contents,
        'You are a helpful assistant that follows instructions precisely.',
        -1,
        'gemini-2.5-pro',
        1
      );
      
      console.log('✓ SDK Response:', result);
    } catch (error) {
      console.log('✗ SDK API call failed:', error.message);
    }
  }
  
  // Test 5: API call WITH proxy (direct HTTP mode)
  console.log('\nTest 5: API call with proxy (direct HTTP)');
  
  if (!apiKey) {
    console.log('⚠ Skipped - Set GEMINI_API_KEY environment variable');
  } else {
    try {
      // Re-initialize with proxy
      const proxyUrl = 'http://127.0.0.1:10809';
      initGeminiClient(apiKey, proxyUrl);
      
      const contents = [{
        role: 'user',
        parts: [{ text: 'Say "Hello from proxy" and nothing else.' }]
      }];
      
      console.log('  Making API call through proxy...');
      const result = await generateWithRetry(
        contents,
        'You are a helpful assistant that follows instructions precisely.',
        -1,
        'gemini-2.5-pro',
        1
      );
      
      console.log('✓ Proxy Response:', result);
    } catch (error) {
      console.log('✗ Proxy API call failed:', error.message);
    }
  }
  
  // Test 6: Different thinking budgets
  console.log('\nTest 6: Testing different thinking budgets');
  
  if (!apiKey) {
    console.log('⚠ Skipped - Set GEMINI_API_KEY environment variable');
  } else {
    try {
      const contents = [{
        role: 'user',
        parts: [{ text: 'What is 2+2? Answer with just the number.' }]
      }];
      
      // Test with thinking budget = 0
      console.log('  Testing thinking budget = 0...');
      const result1 = await generateWithRetry(
        contents,
        'You are a calculator. Only respond with numbers.',
        0,
        'gemini-2.5-pro',
        1
      );
      console.log('  Result:', result1);
      
      // Test with thinking budget = -1 (unlimited)
      console.log('  Testing thinking budget = -1 (unlimited)...');
      const result2 = await generateWithRetry(
        contents,
        'You are a calculator. Only respond with numbers.',
        -1,
        'gemini-2.5-pro',
        1
      );
      console.log('  Result:', result2);
      
      console.log('✓ Thinking budget tests completed');
    } catch (error) {
      console.log('✗ Thinking budget test failed:', error.message);
    }
  }
  
  console.log('\n=== All tests completed ===');
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});