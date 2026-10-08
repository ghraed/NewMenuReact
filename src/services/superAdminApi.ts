import { readOwnerIdentity, getVerifiedOwnerIdentity } from './ownerAuthSession';
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

  config.headers['X-Rozer-Auth-Mode'] = 'cookie-v1';
  const authRequest = /\/(?:super-admin|owner)\/auth\//.test(config.url || '');
  const expectedUser = authRequest ? readOwnerIdentity() : getVerifiedOwnerIdentity();
  if (!authRequest && !expectedUser && !config.headers.Authorization) throw new Error('Resolve the owner session before accessing protected data.');
  if (expectedUser && !config.headers.Authorization) config.headers['X-Rozer-Expected-User'] = String(expectedUser);
  config.headers['Accept-Language'] = language;
  config.headers['X-Locale'] = language;

  return config;
});

export default superAdminApi;
