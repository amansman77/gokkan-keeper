export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const SITE_BASE_URL = (import.meta.env.VITE_SITE_URL || 'https://gokkan-keeper.yetimates.com').replace(/\/+$/, '');

if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    API_BASE_URL,
    GOOGLE_CLIENT_ID_SET: !!GOOGLE_CLIENT_ID,
    SITE_BASE_URL,
    VITE_API_BASE_URL_RAW: import.meta.env.VITE_API_BASE_URL,
    VITE_SITE_URL_RAW: import.meta.env.VITE_SITE_URL,
    MODE: import.meta.env.MODE,
  });
}
