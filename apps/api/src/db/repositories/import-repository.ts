import type { D1Database } from '@cloudflare/workers-types';
import type { ImportJob, ImportJobStatus, ImportResult } from '@gokkan-keeper/shared';

/**
 * Screenshot import jobs (docs/SCREENSHOT_IMPORT.md). Images live here only
 * until the OCR result arrives; `purgeExpired` removes anything left behind.
 */

interface JobRow {
  id: string;
  granary_id: string;
  status: ImportJobStatus;
  result_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  image_count: number;
  account_suffix: string | null;
}

const JOB_TTL_MS = 24 * 3600_000;
const LEASE_SECONDS = 600;

function toJob(row: JobRow): ImportJob {
  return {
    id: row.id, granaryId: row.granary_id, status: row.status,
    result: row.result_json ? (JSON.parse(row.result_json) as ImportResult) : null,
    error: row.error, imageCount: row.image_count, linkedAccountSuffix: row.account_suffix,
    createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at,
  };
}

const SELECT_JOB = `
  SELECT j.*, (SELECT COUNT(*) FROM gk_import_images i WHERE i.job_id = j.id) AS image_count, a.account_suffix
  FROM gk_import_jobs j LEFT JOIN gk_import_accounts a ON a.granary_id = j.granary_id`;

/** Everything one approved import writes, applied in a single D1 batch. */
export interface ApplyPlan {
  jobId: string;
  granaryId: string;
  updates: { positionId: string; quantity: number; avgCost: number }[];
  creates: { key: string; name: string; symbol: string; market: string | null; assetType: string | null; quantity: number; avgCost: number; currency: string }[];
  zeroed: string[];
  snapshot: { date: string; totalAmount: number; availableBalance: number; profitLoss: number; memo: string };
  accountSuffix: string | null;
}

export class ImportRepository {
  constructor(private readonly db: D1Database) {}

  async createJob(granaryId: string): Promise<ImportJob> {
    const id = crypto.randomUUID();
    const now = new Date();
    await this.db.prepare(`INSERT INTO gk_import_jobs (id, granary_id, status, created_at, updated_at, expires_at) VALUES (?, ?, 'draft', ?, ?, ?)`)
      .bind(id, granaryId, now.toISOString(), now.toISOString(), new Date(now.getTime() + JOB_TTL_MS).toISOString()).run();
    return (await this.getJob(id))!;
  }

  async getJob(id: string): Promise<ImportJob | null> {
    const row = await this.db.prepare(`${SELECT_JOB} WHERE j.id = ?`).bind(id).first<JobRow>();
    return row ? toJob(row) : null;
  }

  async putImage(jobId: string, seq: number, mime: string, bytes: Uint8Array): Promise<void> {
    await this.db.prepare(`INSERT INTO gk_import_images (job_id, seq, mime, bytes) VALUES (?, ?, ?, ?)
      ON CONFLICT(job_id, seq) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes`)
      .bind(jobId, seq, mime, bytes).run();
  }

  async setStatus(id: string, status: ImportJobStatus, fields: { result?: ImportResult; error?: string } = {}): Promise<void> {
    await this.db.prepare('UPDATE gk_import_jobs SET status = ?, result_json = coalesce(?, result_json), error = ?, lease_until = 0, updated_at = ? WHERE id = ?')
      .bind(status, fields.result ? JSON.stringify(fields.result) : null, fields.error ?? null, new Date().toISOString(), id).run();
  }

  /** Lease the oldest queued job (or one whose lease lapsed) for the OCR worker. */
  async leaseNext(): Promise<{ job: ImportJob; images: { seq: number; mime: string }[] } | null> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db.prepare(`UPDATE gk_import_jobs SET status = 'processing', lease_until = ?, updated_at = ?
      WHERE id = (SELECT id FROM gk_import_jobs WHERE status = 'queued' OR (status = 'processing' AND lease_until < ?) ORDER BY created_at LIMIT 1)
      RETURNING id`).bind(now + LEASE_SECONDS, new Date().toISOString(), now).first<{ id: string }>();
    if (!row) return null;
    const images = await this.db.prepare('SELECT seq, mime FROM gk_import_images WHERE job_id = ? ORDER BY seq').bind(row.id)
      .all<{ seq: number; mime: string }>();
    return { job: (await this.getJob(row.id))!, images: images.results ?? [] };
  }

  async getImage(jobId: string, seq: number): Promise<{ mime: string; bytes: Uint8Array } | null> {
    const row = await this.db.prepare('SELECT mime, bytes FROM gk_import_images WHERE job_id = ? AND seq = ?').bind(jobId, seq)
      .first<{ mime: string; bytes: ArrayBuffer | number[] }>();
    // D1 hands BLOB columns back as a plain number array
    return row ? { mime: row.mime, bytes: row.bytes instanceof ArrayBuffer ? new Uint8Array(row.bytes) : Uint8Array.from(row.bytes) } : null;
  }

  async deleteImages(jobId: string): Promise<void> {
    await this.db.prepare('DELETE FROM gk_import_images WHERE job_id = ?').bind(jobId).run();
  }

  async purgeExpired(): Promise<void> {
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare('DELETE FROM gk_import_images WHERE job_id IN (SELECT id FROM gk_import_jobs WHERE expires_at < ?)').bind(now),
      this.db.prepare('DELETE FROM gk_import_jobs WHERE expires_at < ?').bind(now),
    ]);
  }

  /**
   * All-or-nothing apply. The first statement claims the job with a fresh
   * token only if it is still `parsed`; every later statement runs only while
   * that token is in place, so a concurrent or repeated apply writes nothing.
   * Created positions carry a source identity, so they can never duplicate.
   */
  async applyPlan(plan: ApplyPlan): Promise<boolean> {
    const token = crypto.randomUUID();
    const now = new Date().toISOString();
    const guard = 'EXISTS (SELECT 1 FROM gk_import_jobs WHERE id = ? AND apply_token = ?)';
    const g = [plan.jobId, token];
    const db = this.db;
    await db.batch([
      db.prepare("UPDATE gk_import_jobs SET apply_token = ?, updated_at = ? WHERE id = ? AND status = 'parsed' AND apply_token IS NULL").bind(token, now, plan.jobId),
      ...plan.updates.map((u) => db.prepare(`UPDATE gk_positions SET quantity = ?, avg_cost = ?, updated_at = ? WHERE id = ? AND granary_id = ? AND ${guard}`)
        .bind(u.quantity, u.avgCost, now, u.positionId, plan.granaryId, ...g)),
      ...plan.zeroed.map((id) => db.prepare(`UPDATE gk_positions SET quantity = 0, updated_at = ? WHERE id = ? AND granary_id = ? AND ${guard}`)
        .bind(now, id, plan.granaryId, ...g)),
      ...plan.creates.map((p) => db.prepare(`INSERT INTO gk_positions (id, granary_id, name, symbol, market, asset_type, quantity, avg_cost, is_public, public_order, created_at, updated_at, price_currency, source, source_record_id)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 'screenshot-import', ? WHERE ${guard}
        ON CONFLICT(source, source_record_id) WHERE source IS NOT NULL AND source_record_id IS NOT NULL DO NOTHING`)
        .bind(crypto.randomUUID(), plan.granaryId, p.name, p.symbol, p.market, p.assetType, p.quantity, p.avgCost, now, now, p.currency, p.key, ...g)),
      db.prepare(`INSERT INTO gk_snapshots (id, granary_id, date, total_amount, available_balance, profit_loss, memo, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}
        ON CONFLICT(granary_id, date) DO UPDATE SET total_amount = excluded.total_amount, available_balance = excluded.available_balance, profit_loss = excluded.profit_loss, memo = excluded.memo`)
        .bind(crypto.randomUUID(), plan.granaryId, plan.snapshot.date, plan.snapshot.totalAmount, plan.snapshot.availableBalance, plan.snapshot.profitLoss, plan.snapshot.memo, now, ...g),
      ...(plan.accountSuffix ? [db.prepare(`INSERT INTO gk_import_accounts (granary_id, broker, account_suffix, created_at) SELECT ?, 'samsung', ?, ? WHERE ${guard} ON CONFLICT(granary_id) DO NOTHING`)
        .bind(plan.granaryId, plan.accountSuffix, now, ...g)] : []),
      db.prepare("UPDATE gk_import_jobs SET status = 'applied', updated_at = ? WHERE id = ? AND apply_token = ?").bind(now, plan.jobId, token),
    ]);
    const row = await db.prepare('SELECT status, apply_token FROM gk_import_jobs WHERE id = ?').bind(plan.jobId).first<{ status: string; apply_token: string | null }>();
    return row?.status === 'applied' && row.apply_token === token;
  }

  async linkAccount(granaryId: string, suffix: string): Promise<void> {
    await this.db.prepare(`INSERT INTO gk_import_accounts (granary_id, broker, account_suffix, created_at) VALUES (?, 'samsung', ?, ?)
      ON CONFLICT(granary_id) DO NOTHING`).bind(granaryId, suffix, new Date().toISOString()).run();
  }
}
