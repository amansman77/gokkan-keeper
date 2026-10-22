import type { D1Database } from '@cloudflare/workers-types';

export class SecurityRepository {
  constructor(private readonly db: D1Database) {}

  async registerSession(id: string, expiresAt: number): Promise<void> {
    await this.db.prepare('INSERT INTO gk_sessions (id, expires_at) VALUES (?, ?)').bind(id, expiresAt).run();
  }
  async hasSession(id: string, now: number): Promise<boolean> {
    return !!await this.db.prepare('SELECT id FROM gk_sessions WHERE id = ? AND expires_at > ?').bind(id, now).first<{ id: string }>();
  }
  async revokeSession(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM gk_sessions WHERE id = ?').bind(id).run();
  }
  async consumeRateLimit(key: string, now: number, seconds: number, maximum: number): Promise<boolean> {
    const start = Math.floor(now / seconds) * seconds;
    const row = await this.db.prepare(`
      INSERT INTO gk_security_rate_limits (key, window_start, attempts, expires_at) VALUES (?, ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END,
        window_start = excluded.window_start, expires_at = excluded.expires_at
      RETURNING attempts
    `).bind(key, start, start + seconds).first<{ attempts: number }>();
    return !!row && row.attempts <= maximum;
  }
  async recordEvent(id: string, actor: string, domain: string, method: string, status: number): Promise<void> {
    await this.db.prepare('INSERT INTO gk_security_audit_log (id, created_at, actor, domain, method, status) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, Math.floor(Date.now() / 1000), actor, domain, method, status).run();
  }
  async cleanup(now = Math.floor(Date.now() / 1000)): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM gk_quote_cache WHERE expires_at <= ?').bind(new Date(now * 1000).toISOString()),
      this.db.prepare('DELETE FROM gk_alert_sent WHERE sent_at < ?').bind(new Date((now - 90 * 86400) * 1000).toISOString()),
      this.db.prepare('DELETE FROM gk_alert_outbox WHERE delivered_at < ?').bind(new Date((now - 90 * 86400) * 1000).toISOString()),
      this.db.prepare('DELETE FROM gk_sessions WHERE expires_at <= ?').bind(now),
      this.db.prepare('DELETE FROM gk_security_rate_limits WHERE expires_at <= ?').bind(now),
      this.db.prepare('DELETE FROM gk_security_audit_log WHERE created_at < ?').bind(now - 90 * 86400),
    ]);
  }
}
