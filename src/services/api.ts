import axios from 'axios';

const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';
const API_URL = isLocalhost 
    ? 'http://127.0.0.1:8000/api'
    // ? 'https://fran-utile-unmorosely.ngrok-free.dev/api'
    : 'https://192.168.10.203/api'; 

console.log('API_URL:', API_URL); // Check this in mobile browser console

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

export const getApiOrigin = (): string => {
  try {
    return new URL(API_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

export const resolveAssetUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const apiOrigin = getApiOrigin();

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.origin === apiOrigin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // fall through
    }
    return url;
  }

  if (url.startsWith('/')) return url;
  return `/${url}`;
};
