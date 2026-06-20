import axios from 'axios';
import { getStoredLanguage } from '../i18n/language';
import { getApiBase } from './api';

export const SUPER_ADMIN_TOKEN_STORAGE_KEY = 'owner_auth_token';

const superAdminApi = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

superAdminApi.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  const token = localStorage.getItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
  const language = getStoredLanguage();

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers['Accept-Language'] = language;
  config.headers['X-Locale'] = language;

  return config;
});

export default superAdminApi;
