import type { Env } from './types';
import { createApp } from './app';
import { runAlertEngine } from './services/alert-engine';

const app = createApp();

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // "0 9 * * 1-5"  → weekdays 18:00 KST daily signals
    // "30 9 * * 5"   → Friday  18:30 KST weekly signals
    const mode = event.cron === '30 9 * * 5' ? 'weekly' : 'daily';
    await runAlertEngine(env, mode);
  },
};
