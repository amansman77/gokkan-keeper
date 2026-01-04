export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
export const API_SECRET = import.meta.env.VITE_API_SECRET || '';

// Debug logging (always log in production to help diagnose issues)
console.log('API Configuration:', {
  API_BASE_URL,
  VITE_API_BASE_URL_RAW: import.meta.env.VITE_API_BASE_URL,
  API_SECRET_SET: !!API_SECRET,
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  DEV: import.meta.env.DEV,
});

