import axios from 'axios';
import { getStoredLanguage } from '../i18n/language';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_auth_token');
  const language = getStoredLanguage();

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers['Accept-Language'] = language;
  config.headers['X-Locale'] = language;
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
