export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
export const API_SECRET = import.meta.env.VITE_API_SECRET || '';

// Debug logging (only in development)
if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    API_BASE_URL,
    API_SECRET_SET: !!API_SECRET,
  });
}

