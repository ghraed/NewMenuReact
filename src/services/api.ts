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
  const isLoopbackHost = (hostname: string): boolean => (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]'
  );

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      // Only collapse to a relative URL when the asset is truly same-origin with the current page.
      // Keep absolute URLs for cross-origin frontend deployments (e.g. app on another domain/subdomain).
      if (currentOrigin && parsed.origin === currentOrigin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }

      // Local dev safety: backend may emit loopback absolute URLs using stale APP_URL
      // (e.g. http://localhost/storage/..). If both are loopback but ports differ,
      // remap to the configured API origin so assets stay reachable.
      try {
        const apiParsed = new URL(apiOrigin);
        if (
          isLoopbackHost(parsed.hostname)
          && isLoopbackHost(apiParsed.hostname)
          && parsed.origin !== apiParsed.origin
        ) {
          return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, apiOrigin).toString();
        }
      } catch {
        // fall through
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
