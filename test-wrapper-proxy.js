// Test the proxy-enabled wrapper
import { initGeminiClient, generateWithRetry, convertContentParts } from './src/utils/gemini-wrapper-with-proxy.js';

async function testProxyWrapper() {
  console.log('Testing Gemini Wrapper with Proxy Support...\n');
  
  const apiKey = "AIzaSyA0CfzJO7IjmIq168wvOIfpwx9vSO7FS5g";
  const proxyUrl = 'http://127.0.0.1:10809';
  
  // Test 1: Without proxy
  console.log('Test 1: Initialize without proxy');
  try {
    initGeminiClient(apiKey);
    console.log('✓ Initialized without proxy');
  } catch (error) {
    console.log('✗ Failed:', error.message);
  }
  
  // Test 2: With proxy
  console.log('\nTest 2: Initialize with proxy');
  try {
    initGeminiClient(apiKey, proxyUrl);
    console.log('✓ Initialized with proxy');
  } catch (error) {
    console.log('✗ Failed:', error.message);
  }
  
  // Test 3: API call with proxy
  console.log('\nTest 3: API call through proxy');
  try {
    const contents = [{
      role: 'user',
      parts: [{ text: 'Say "Hello from proxy wrapper" and nothing else.' }]
    }];
    
    const result = await generateWithRetry(
      contents,
      'You are a helpful assistant that follows instructions precisely.',
      -1,
      'gemini-2.5-pro',
      1
    );
    
    console.log('✓ API call successful:', result);
  } catch (error) {
    console.log('✗ API call failed:', error.message);
  }
  
  // Test 4: Convert content parts
  console.log('\nTest 4: Content conversion');
  try {
    const parts = [{ text: 'Test message' }];
    const contents = convertContentParts(parts);
    console.log('✓ Content conversion:', JSON.stringify(contents));
  } catch (error) {
    console.log('✗ Content conversion failed:', error.message);
  }
}

testProxyWrapper().catch(console.error);