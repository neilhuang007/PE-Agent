// Test Gemini API with proxy using environment variables
import { initGeminiClient, generateWithRetry } from './src/utils/gemini-wrapper.js';

// Set proxy environment variables
process.env.HTTP_PROXY = 'http://127.0.0.1:10809';
process.env.HTTPS_PROXY = 'http://127.0.0.1:10809';
process.env.http_proxy = 'http://127.0.0.1:10809';
process.env.https_proxy = 'http://127.0.0.1:10809';

console.log('Testing Gemini API with Proxy...');
console.log('Proxy:', process.env.HTTPS_PROXY);

const apiKey = "AIzaSyA0CfzJO7IjmIq168wvOIfpwx9vSO7FS5g";

async function testWithProxy() {
  try {
    // Initialize without explicit proxy (let environment handle it)
    initGeminiClient(apiKey);
    
    const contents = [{
      role: 'user',
      parts: [{ text: 'Say "Hello from proxy test" and nothing else.' }]
    }];
    
    console.log('Making API call through proxy...');
    const result = await generateWithRetry(
      contents,
      'You are a helpful assistant that follows instructions precisely.',
      -1,
      'gemini-2.5-pro',
      1
    );
    
    console.log('✓ Success! Response:', result);
  } catch (error) {
    console.log('✗ Failed:', error.message);
    console.log('Error details:', error);
  }
}

testWithProxy();