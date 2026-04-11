import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App.tsx';
import { registerPushServiceWorker } from './services/pushNotifications.ts';

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerPushServiceWorker().catch((error) => {
      console.warn('[Push] Service worker registration failed.', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
