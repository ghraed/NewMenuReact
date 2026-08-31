import axios from 'axios';
import { getStoredLanguage } from '../i18n/language';
import { getApiBase } from './api';

const superAdminApi = axios.create({
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

superAdminApi.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  const language = getStoredLanguage();

  config.headers = config.headers || {};

  config.headers['Accept-Language'] = language;
  config.headers['X-Locale'] = language;

  return config;
});

export default superAdminApi;
