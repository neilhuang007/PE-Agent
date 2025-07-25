// Browser-compatible proxy configuration for Gemini API

// Get proxy URL from environment or use default
export const PROXY_URL = 'http://127.0.0.1:10809';

// Create proxied URL for API requests
export function getProxiedUrl(originalUrl) {
    // In production, you might want to use a proper CORS proxy service
    // For local development with proxy, configure your browser or use a local proxy server
    
    // Option 1: Direct URL (requires browser proxy settings or CORS headers)
    return originalUrl;
    
    // Option 2: Use a CORS proxy service (uncomment if needed)
    // return `https://cors-anywhere.herokuapp.com/${originalUrl}`;
    
    // Option 3: Use local proxy (requires proxy server setup)
    // return originalUrl.replace('https://', `${PROXY_URL}/`);
}

// Fetch with proxy support
export async function fetchWithProxy(url, options = {}) {
    const proxiedUrl = getProxiedUrl(url);
    
    try {
        const response = await fetch(proxiedUrl, options);
        return response;
    } catch (error) {
        console.error('Proxy fetch error:', error);
        // Fallback to direct fetch
        return fetch(url, options);
    }
}