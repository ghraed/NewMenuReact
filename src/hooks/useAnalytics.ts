// src/hooks/useAnalytics.ts
import { useCallback } from 'react';
import type { AnalyticsEvent } from '../types';
import { analyticsService } from '../services/analyticsService';

export const useAnalytics = () => {
  const trackEvent = useCallback((eventType: AnalyticsEvent['event_type']) => {
    analyticsService.track(eventType).catch(err => {
      console.warn('Analytics tracking failed:', err);
    });
  }, []);

  return { trackEvent };
};