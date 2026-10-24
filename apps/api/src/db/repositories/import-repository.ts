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

  async linkAccount(granaryId: string, suffix: string): Promise<void> {
    await this.db.prepare(`INSERT INTO gk_import_accounts (granary_id, broker, account_suffix, created_at) VALUES (?, 'samsung', ?, ?)
      ON CONFLICT(granary_id) DO NOTHING`).bind(granaryId, suffix, new Date().toISOString()).run();
  }
}
