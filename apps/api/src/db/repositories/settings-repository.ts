import type { D1Database } from '@cloudflare/workers-types';

export class SettingsRepository {
  constructor(private readonly db: D1Database) {}

  async getAllSettings(): Promise<Record<string, string>> {
    const result = await this.db.prepare('SELECT key, value FROM gk_settings').all<{ key: string; value: string }>();
    const settings: Record<string, string> = {};
    for (const row of result.results || []) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO gk_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)
      .bind(key, value, new Date().toISOString())
      .run();
  }
}
