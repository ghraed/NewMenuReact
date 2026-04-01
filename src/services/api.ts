import axios from 'axios';

const isLocalhost = window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const API_URL = import.meta.env.VITE_API_URL || (isLocalhost
  ? 'http://127.0.0.1:8000/api'
  : 'https://192.168.10.203/api');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
      const parsedApiOrigin = new URL(apiOrigin);
      if (parsed.origin === apiOrigin || parsed.hostname === parsedApiOrigin.hostname) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // fall through
    }
    return url;
  }

  try {
    return new URL(url, apiOrigin).toString();
  } catch {
    if (url.startsWith('/')) {
      return `${apiOrigin}${url}`;
    }
    return `${apiOrigin}/${url}`;
  }
};
