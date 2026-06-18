import axios from 'axios';
import { getStoredLanguage } from '../i18n/language';

const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || '/api';

const isLoopbackHost = (hostname: string): boolean => (
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '::1'
  || hostname === '[::1]'
);

export const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return CONFIGURED_API_URL;
  }

  const configured = CONFIGURED_API_URL.trim();
  if (configured === '') {
    return '/api';
  }

  try {
    const resolved = new URL(configured, window.location.origin);
    const current = new URL(window.location.origin);
    const normalizedPath = `${resolved.pathname}${resolved.search}${resolved.hash}` || '/api';

    if (resolved.origin === current.origin) {
      return normalizedPath;
    }

    if (isLoopbackHost(resolved.hostname) && isLoopbackHost(current.hostname)) {
      return resolved.toString().replace(/\/+$/, '');
    }

    // Public guest/custom-domain requests must stay same-origin so the backend can
    // resolve the tenant from the incoming Host header instead of a shared root domain.
    return '/api';
  } catch {
    return '/api';
  }
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
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
    return new URL(getApiBase(), window.location.origin).origin;
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
