// src/services/analyticsService.ts
import type { AnalyticsEvent } from '../types';
import api from './api';

class AnalyticsService {
  async track(eventType: AnalyticsEvent['event_type']): Promise<void> {
    try {
      // Use eventType parameter (camelCase) to create event_type property (snake_case)
      await api.post('/analytics/track', { event_type: eventType });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }
}

export const analyticsService = new AnalyticsService();