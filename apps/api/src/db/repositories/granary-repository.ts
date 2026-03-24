import type { D1Database } from '@cloudflare/workers-types';
import type { CreateGranary, Granary, Snapshot, UpdateGranary } from '@gokkan-keeper/shared';
import { transformGranary, transformSnapshot } from '../mappers';

export class GranaryRepository {
  constructor(private readonly db: D1Database) {}

  async getAllGranaries(): Promise<Granary[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_granaries ORDER BY created_at DESC')
      .all<any>();
    return (result.results || []).map(transformGranary);
  }

  async getAllGranariesWithLatestSnapshot(): Promise<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]> {
    const granaries = await this.getAllGranaries();
    if (granaries.length === 0) return [];

    const rankedSnapshots = await this.db
      .prepare(`
        SELECT *
        FROM (
          SELECT
            s.*,
            ROW_NUMBER() OVER (PARTITION BY s.granary_id ORDER BY s.date DESC) AS snapshot_rank
          FROM gk_snapshots s
        )
        WHERE snapshot_rank <= 2
      `)
      .all<any>();

    const snapshotsByGranary = new Map<string, { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot }>();
    for (const row of rankedSnapshots.results || []) {
      const granaryId = row.granary_id as string;
      const existing = snapshotsByGranary.get(granaryId) ?? {};
      const snapshot = transformSnapshot(row);
      if (row.snapshot_rank === 1) existing.latestSnapshot = snapshot;
      if (row.snapshot_rank === 2) existing.previousSnapshot = snapshot;
      snapshotsByGranary.set(granaryId, existing);
    }

    return granaries.map((granary) => ({
      ...granary,
      latestSnapshot: snapshotsByGranary.get(granary.id)?.latestSnapshot,
      previousSnapshot: snapshotsByGranary.get(granary.id)?.previousSnapshot,
    }));
  }

  async getGranaryById(id: string): Promise<Granary | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_granaries WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? transformGranary(result) : null;
  }

  async createGranary(data: CreateGranary): Promise<Granary> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(`
        INSERT INTO gk_granaries (
          id, name, purpose, currency, owner, is_public, public_thesis, public_order, last_public_update, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        data.name,
        data.purpose,
        data.currency,
        data.owner || 'default',
        data.isPublic ? 1 : 0,
        data.publicThesis ?? null,
        data.publicOrder ?? null,
        data.isPublic ? now : null,
        now,
        now,
      )
      .run();

    const granary = await this.getGranaryById(id);
    if (!granary) throw new Error('Failed to create granary');
    return granary;
  }

  async updateGranary(id: string, data: UpdateGranary): Promise<Granary> {
    const existing = await this.getGranaryById(id);
    if (!existing) throw new Error('Granary not found');

    const updates: string[] = [];
    const values: any[] = [];
    let publicFieldsChanged = false;

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.purpose !== undefined) {
      updates.push('purpose = ?');
      values.push(data.purpose);
    }
    if (data.currency !== undefined) {
      updates.push('currency = ?');
      values.push(data.currency);
    }
    if (data.isPublic !== undefined) {
      updates.push('is_public = ?');
      values.push(data.isPublic ? 1 : 0);
      publicFieldsChanged = true;
    }
    if (data.publicThesis !== undefined) {
      updates.push('public_thesis = ?');
      values.push(data.publicThesis ?? null);
      publicFieldsChanged = true;
    }
    if (data.publicOrder !== undefined) {
      updates.push('public_order = ?');
      values.push(data.publicOrder ?? null);
      publicFieldsChanged = true;
    }
    if (publicFieldsChanged) {
      updates.push('last_public_update = ?');
      values.push(new Date().toISOString());
    }
    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(new Date().toISOString(), id);

    await this.db
      .prepare(`UPDATE gk_granaries SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getGranaryById(id);
    if (!updated) throw new Error('Failed to update granary');
    return updated;
  }

  async getOldestUnupdatedGranary(): Promise<{ granary: Granary; daysSinceUpdate: number } | null> {
    const result = await this.db
      .prepare(`
        SELECT g.*, MAX(s.date) as last_snapshot_date
        FROM gk_granaries g
        LEFT JOIN gk_snapshots s ON g.id = s.granary_id
        GROUP BY g.id
        ORDER BY last_snapshot_date ASC NULLS FIRST
        LIMIT 1
      `)
      .first<any>();

    if (!result) return null;

    const lastDate = result.last_snapshot_date || result.created_at;
    const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
    return { granary: transformGranary(result), daysSinceUpdate: daysSince };
  }
}
