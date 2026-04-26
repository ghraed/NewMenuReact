import axios from 'axios';
import { getStoredLanguage } from '../i18n/language';

export const OWNER_TOKEN_STORAGE_KEY = 'owner_auth_token';

const OWNER_API_URL = import.meta.env.VITE_API_URL || '/api';

const ownerApi = axios.create({
  baseURL: OWNER_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

ownerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
  const language = getStoredLanguage();

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers['Accept-Language'] = language;
  config.headers['X-Locale'] = language;

  return config;
});

export default ownerApi;
