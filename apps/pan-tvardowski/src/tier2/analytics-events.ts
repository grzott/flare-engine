export const ANALYTICS_EVENTS = {
  zone_start: 'zone_start',
  zone_complete: 'zone_complete',
  miniboss_defeated: 'miniboss_defeated',
  boss_phase_change: 'boss_phase_change',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const ANALYTICS_EVENT_COUNT = 4;
