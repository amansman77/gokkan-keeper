import type { Env } from './types';
import { createApp } from './app';
import { runAlertEngine } from './services/alert-engine';

const app = createApp();

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // "0 9 * * 2-6"  → weekdays 18:00 KST daily signals  (Cloudflare: 1=Sun, Mon=2, Fri=6)
    // "30 9 * * 6"   → Friday  18:30 KST weekly signals
    const mode = event.cron === '30 9 * * 6' ? 'weekly' : 'daily';
    await runAlertEngine(env, mode);
  },
};
