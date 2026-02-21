import type { D1Database } from '@cloudflare/workers-types';
import type {
  Granary,
  Snapshot,
  CreateGranary,
  CreateSnapshot,
  UpdateGranary,
  UpdateSnapshot,
  JudgmentDiaryEntry,
  CreateJudgmentDiaryEntry,
  UpdateJudgmentDiaryEntry,
  JudgmentDiaryListFilters,
  PublicPortfolioResponse,
  Position,
  CreatePosition,
  UpdatePosition,
} from '@gokkan-keeper/shared';

export class DBClient {
  constructor(private db: D1Database) {}

  async getAllGranaries(): Promise<Granary[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_granaries ORDER BY created_at DESC')
      .all<any>();
    return (result.results || []).map(this.transformGranary);
  }

  async getAllGranariesWithLatestSnapshot(): Promise<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]> {
    const granaries = await this.getAllGranaries();
    const granariesWithSnapshots = await Promise.all(
      granaries.map(async (granary) => {
        const [latestSnapshot, previousSnapshot] = await Promise.all([
          this.getLatestSnapshotByGranaryId(granary.id),
          this.getPreviousSnapshotByGranaryId(granary.id),
        ]);
        return {
          ...granary,
          latestSnapshot: latestSnapshot || undefined,
          previousSnapshot: previousSnapshot || undefined,
        };
      })
    );
    return granariesWithSnapshots;
  }

  private transformGranary(row: any): Granary {
    return {
      id: row.id,
      name: row.name,
      purpose: row.purpose,
      currency: row.currency,
      owner: row.owner,
      isPublic: row.is_public === 1,
      publicThesis: row.public_thesis ?? null,
      publicOrder: row.public_order ?? null,
      lastPublicUpdate: row.last_public_update ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getGranaryById(id: string): Promise<Granary | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_granaries WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? this.transformGranary(result) : null;
  }

  async createGranary(data: CreateGranary): Promise<Granary> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.db
      .prepare(
        `INSERT INTO gk_granaries (
          id, name, purpose, currency, owner, is_public, public_thesis, public_order, last_public_update, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
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
        now
      )
      .run();

    const granary = await this.getGranaryById(id);
    if (!granary) {
      throw new Error('Failed to create granary');
    }
    return granary;
  }

  async updateGranary(id: string, data: UpdateGranary): Promise<Granary> {
    // Get existing granary
    const existing = await this.getGranaryById(id);
    if (!existing) {
      throw new Error('Granary not found');
    }

    // Build update query dynamically
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

    if (updates.length === 0) {
      return existing;
    }

    // Always update updated_at
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE gk_granaries SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getGranaryById(id);
    if (!updated) {
      throw new Error('Failed to update granary');
    }
    return updated;
  }

  async getLatestSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT 1')
      .bind(granaryId)
      .first<any>();
    return result ? this.transformSnapshot(result) : null;
  }

  async getPreviousSnapshotByGranaryId(granaryId: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT 1 OFFSET 1')
      .bind(granaryId)
      .first<any>();
    return result ? this.transformSnapshot(result) : null;
  }

  async getSnapshotsByGranaryId(granaryId: string, limit = 10): Promise<Snapshot[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE granary_id = ? ORDER BY date DESC LIMIT ?')
      .bind(granaryId, limit)
      .all<any>();
    return (result.results || []).map(this.transformSnapshot);
  }

  async getAllSnapshots(limit = 50): Promise<Snapshot[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots ORDER BY date DESC LIMIT ?')
      .bind(limit)
      .all<any>();
    return (result.results || []).map(this.transformSnapshot);
  }

  private transformSnapshot(row: any): Snapshot {
    return {
      id: row.id,
      granaryId: row.granary_id,
      date: row.date,
      totalAmount: row.total_amount,
      availableBalance: row.available_balance,
      profitLoss: row.profit_loss,
      memo: row.memo,
      createdAt: row.created_at,
    };
  }

  async createSnapshot(data: CreateSnapshot): Promise<Snapshot> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await this.db
        .prepare(
          'INSERT INTO gk_snapshots (id, granary_id, date, total_amount, available_balance, profit_loss, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          data.granaryId,
          data.date,
          data.totalAmount,
          data.availableBalance ?? null,
          data.profitLoss ?? null,
          data.memo ?? null,
          now
        )
        .run();
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        throw new Error('Snapshot already exists for this granary and date');
      }
      throw error;
    }

    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE id = ?')
      .bind(id)
      .first<any>();

    if (!result) {
      throw new Error('Failed to create snapshot');
    }
    return this.transformSnapshot(result);
  }

  async getSnapshotById(id: string): Promise<Snapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_snapshots WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? this.transformSnapshot(result) : null;
  }

  async updateSnapshot(id: string, data: UpdateSnapshot): Promise<Snapshot> {
    // Get existing snapshot
    const existing = await this.getSnapshotById(id);
    if (!existing) {
      throw new Error('Snapshot not found');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (data.date !== undefined) {
      updates.push('date = ?');
      values.push(data.date);
    }
    if (data.totalAmount !== undefined) {
      updates.push('total_amount = ?');
      values.push(data.totalAmount);
    }
    if (data.availableBalance !== undefined) {
      updates.push('available_balance = ?');
      values.push(data.availableBalance ?? null);
    }
    if (data.profitLoss !== undefined) {
      updates.push('profit_loss = ?');
      values.push(data.profitLoss ?? null);
    }
    if (data.memo !== undefined) {
      updates.push('memo = ?');
      values.push(data.memo ?? null);
    }

    if (updates.length === 0) {
      return existing;
    }

    values.push(id);

    await this.db
      .prepare(`UPDATE gk_snapshots SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getSnapshotById(id);
    if (!updated) {
      throw new Error('Failed to update snapshot');
    }
    return updated;
  }

  async getOldestUnupdatedGranary(): Promise<{ granary: Granary; daysSinceUpdate: number } | null> {
    const result = await this.db
      .prepare(`
        SELECT g.*, 
               MAX(s.date) as last_snapshot_date
        FROM gk_granaries g
        LEFT JOIN gk_snapshots s ON g.id = s.granary_id
        GROUP BY g.id
        ORDER BY last_snapshot_date ASC NULLS FIRST
        LIMIT 1
      `)
      .first<any>();

    if (!result) {
      return null;
    }

    const lastDate = result.last_snapshot_date || result.created_at;
    const daysSince = Math.floor(
      (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const granary = this.transformGranary(result);
    return { granary, daysSinceUpdate: daysSince };
  }

  private transformPosition(row: any): Position {
    return {
      id: row.id,
      granaryId: row.granary_id ?? null,
      name: row.name,
      symbol: row.symbol,
      market: row.market ?? null,
      assetType: row.asset_type ?? null,
      quantity: row.quantity ?? null,
      avgCost: row.avg_cost ?? null,
      currentValue: row.current_value ?? null,
      weightPercent: row.weight_percent ?? null,
      profitLoss: row.profit_loss ?? null,
      profitLossPercent: row.profit_loss_percent ?? null,
      note: row.note ?? null,
      isPublic: row.is_public === 1,
      publicThesis: row.public_thesis ?? null,
      publicOrder: row.public_order ?? 0,
      lastPublicUpdate: row.last_public_update ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getPositions(granaryId?: string): Promise<Position[]> {
    const result = granaryId
      ? await this.db
          .prepare('SELECT * FROM gk_positions WHERE granary_id = ? ORDER BY updated_at DESC')
          .bind(granaryId)
          .all<any>()
      : await this.db
          .prepare('SELECT * FROM gk_positions ORDER BY updated_at DESC')
          .all<any>();

    return (result.results || []).map((row) => this.transformPosition(row));
  }

  async getPositionById(id: string): Promise<Position | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_positions WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? this.transformPosition(result) : null;
  }

  async createPosition(data: CreatePosition): Promise<Position> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const shouldStampPublic = !!data.isPublic;

    await this.db
      .prepare(
        `INSERT INTO gk_positions (
          id, granary_id, name, symbol, market, asset_type,
          quantity, avg_cost, current_value, weight_percent, profit_loss, profit_loss_percent, note,
          is_public, public_thesis, public_order, last_public_update, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.granaryId ?? null,
        data.name,
        data.symbol,
        data.market ?? null,
        data.assetType ?? null,
        data.quantity ?? null,
        data.avgCost ?? null,
        data.currentValue ?? null,
        data.weightPercent ?? null,
        data.profitLoss ?? null,
        data.profitLossPercent ?? null,
        data.note ?? null,
        data.isPublic ? 1 : 0,
        data.publicThesis ?? null,
        data.publicOrder ?? 0,
        shouldStampPublic ? now : null,
        now,
        now
      )
      .run();

    const created = await this.getPositionById(id);
    if (!created) {
      throw new Error('Failed to create position');
    }
    return created;
  }

  async updatePosition(id: string, data: UpdatePosition): Promise<Position> {
    const existing = await this.getPositionById(id);
    if (!existing) {
      throw new Error('Position not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let publicFieldsChanged = false;

    const updateField = (field: string, value: any) => {
      updates.push(`${field} = ?`);
      values.push(value);
    };

    if (data.granaryId !== undefined) updateField('granary_id', data.granaryId ?? null);
    if (data.name !== undefined) updateField('name', data.name);
    if (data.symbol !== undefined) updateField('symbol', data.symbol);
    if (data.market !== undefined) updateField('market', data.market ?? null);
    if (data.assetType !== undefined) updateField('asset_type', data.assetType ?? null);
    if (data.quantity !== undefined) updateField('quantity', data.quantity ?? null);
    if (data.avgCost !== undefined) updateField('avg_cost', data.avgCost ?? null);
    if (data.currentValue !== undefined) updateField('current_value', data.currentValue ?? null);
    if (data.weightPercent !== undefined) updateField('weight_percent', data.weightPercent ?? null);
    if (data.profitLoss !== undefined) updateField('profit_loss', data.profitLoss ?? null);
    if (data.profitLossPercent !== undefined) updateField('profit_loss_percent', data.profitLossPercent ?? null);
    if (data.note !== undefined) updateField('note', data.note ?? null);
    if (data.isPublic !== undefined) {
      updateField('is_public', data.isPublic ? 1 : 0);
      publicFieldsChanged = true;
    }
    if (data.publicThesis !== undefined) {
      updateField('public_thesis', data.publicThesis ?? null);
      publicFieldsChanged = true;
    }
    if (data.publicOrder !== undefined) {
      updateField('public_order', data.publicOrder ?? 0);
      publicFieldsChanged = true;
    }

    if (updates.length === 0) {
      return existing;
    }

    if (publicFieldsChanged) {
      updateField('last_public_update', new Date().toISOString());
    }

    updateField('updated_at', new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE gk_positions SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getPositionById(id);
    if (!updated) {
      throw new Error('Failed to update position');
    }
    return updated;
  }

  async deletePosition(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM gk_positions WHERE id = ?')
      .bind(id)
      .run();
  }

  async getPublicPortfolioEntries(): Promise<PublicPortfolioResponse> {
    const result = await this.db
      .prepare(`
        SELECT
          p.id,
          p.granary_id,
          p.name,
          p.symbol,
          p.quantity,
          p.avg_cost,
          p.current_value,
          p.weight_percent,
          p.profit_loss,
          p.profit_loss_percent,
          p.public_thesis,
          p.public_order,
          p.last_public_update,
          g.name AS granary_name
        FROM gk_positions p
        LEFT JOIN gk_granaries g ON p.granary_id = g.id
        WHERE p.is_public = 1
        ORDER BY p.public_order ASC, p.updated_at DESC
      `)
      .all<any>();

    const rows = result.results || [];
    const warnings: PublicPortfolioResponse['meta']['warnings'] = [];
    const hasAnyWeight = rows.some(
      (row) => row.weight_percent !== null && row.weight_percent !== undefined
    );

    const evaluated = rows.map((row) => {
      const quantity = row.quantity === null || row.quantity === undefined ? null : Number(row.quantity);
      const avgCost = row.avg_cost === null || row.avg_cost === undefined ? null : Number(row.avg_cost);
      const currentInputValue =
        row.current_value === null || row.current_value === undefined
          ? null
          : Number(row.current_value);
      // If quantity exists, treat current_value as unit price and derive position market value.
      // If quantity is absent, treat current_value as already total value.
      const positionMarketValue = currentInputValue === null
        ? null
        : (quantity !== null ? quantity * currentInputValue : currentInputValue);
      const weightPercent =
        row.weight_percent === null || row.weight_percent === undefined
          ? null
          : Number(row.weight_percent);

      let returnPercent: number | null = null;
      let isEstimatedReturn = false;

      if (row.profit_loss_percent !== null && row.profit_loss_percent !== undefined) {
        returnPercent = Number(row.profit_loss_percent);
      } else if (
        avgCost !== null &&
        avgCost !== 0 &&
        currentInputValue !== null
      ) {
        // Compare current vs average unit price for intuitive return display.
        returnPercent = ((currentInputValue - avgCost) / avgCost) * 100;
        isEstimatedReturn = true;
      } else {
        warnings.push({
          positionId: row.id,
          symbol: row.symbol,
          message: 'Missing return inputs. Set profitLossPercent or provide avgCost and currentValue.',
        });
      }

      return {
        row,
        positionMarketValue,
        weightPercent,
        returnPercent,
        isEstimatedReturn,
      };
    });
    const totalAllocationBasis = evaluated.reduce((acc, item) => acc + (item.positionMarketValue ?? 0), 0);

    for (const item of evaluated) {
      if (hasAnyWeight && item.weightPercent === null) {
        warnings.push({
          positionId: item.row.id,
          symbol: item.row.symbol,
          message: 'Missing weightPercent while portfolio uses weight-based allocation.',
        });
      }
      if (!hasAnyWeight && item.positionMarketValue === null) {
        warnings.push({
          positionId: item.row.id,
          symbol: item.row.symbol,
          message: 'Missing allocation inputs. Set currentValue (or quantity+currentValue) or use weightPercent.',
        });
      }
    }

    const data = evaluated.map((item) => ({
      symbol: item.row.symbol,
      name: item.row.name,
      granaryId: item.row.granary_id ?? null,
      granaryName: item.row.granary_name ?? null,
      allocationPercent: (
        hasAnyWeight
          ? item.weightPercent !== null
          : item.positionMarketValue !== null
      ) && (hasAnyWeight || totalAllocationBasis > 0)
        ? (hasAnyWeight
          ? (item.weightPercent ?? null)
          : ((item.positionMarketValue ?? 0) / totalAllocationBasis) * 100)
        : null,
      returnPercent: item.returnPercent,
      thesis: item.row.public_thesis ?? null,
      lastUpdated: item.row.last_public_update ?? null,
      isEstimatedReturn: item.isEstimatedReturn,
    }));

    return {
      data,
      meta: {
        warnings,
      },
    };
  }

  private parseJSON<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private transformJudgmentDiaryEntry(row: any): JudgmentDiaryEntry {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      title: row.title,
      summary: row.summary,
      marketContext: row.market_context ?? null,
      decision: row.decision ?? null,
      action: row.action,
      assets: this.parseJSON(row.assets_json, undefined as any),
      positionChange: this.parseJSON(row.position_change_json, undefined as any),
      risk: row.risk ?? null,
      invalidateConditions: this.parseJSON(row.invalidate_conditions_json, undefined as any),
      nextCheck: row.next_check,
      emotionState: row.emotion_state,
      confidence: row.confidence,
      timeHorizon: row.time_horizon,
      strategyTags: this.parseJSON(row.strategy_tags_json, undefined as any),
      refs: this.parseJSON(row.refs_json, undefined as any),
      disclaimerVisible: row.disclaimer_visible === 1,
      reviewedAt: row.reviewed_at,
      outcome: row.outcome,
      whatWasRight: row.what_was_right,
      whatWasWrong: row.what_was_wrong,
      lesson: row.lesson,
      nextAction: row.next_action,
    };
  }

  async getJudgmentDiaryEntries(filters: JudgmentDiaryListFilters = {}): Promise<JudgmentDiaryEntry[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.from) {
      conditions.push("date(created_at) >= date(?)");
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push("date(created_at) <= date(?)");
      values.push(filters.to);
    }
    if (filters.action) {
      conditions.push('action = ?');
      values.push(filters.action);
    }
    if (filters.asset) {
      conditions.push('assets_json LIKE ?');
      values.push(`%${filters.asset}%`);
    }
    if (filters.strategyTag) {
      conditions.push('strategy_tags_json LIKE ?');
      values.push(`%${filters.strategyTag}%`);
    }

    const limit = filters.limit ?? 50;
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db
      .prepare(`SELECT * FROM gk_judgment_diary_entries ${whereClause} ORDER BY created_at DESC LIMIT ?`)
      .bind(...values, limit)
      .all<any>();

    return (result.results || []).map((row) => this.transformJudgmentDiaryEntry(row));
  }

  async getJudgmentDiaryEntryById(id: string): Promise<JudgmentDiaryEntry | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_judgment_diary_entries WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? this.transformJudgmentDiaryEntry(result) : null;
  }

  async createJudgmentDiaryEntry(data: CreateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;

    await this.db
      .prepare(
        `INSERT INTO gk_judgment_diary_entries (
          id, created_at, updated_at, title, summary, market_context, decision, action,
          assets_json, position_change_json, risk, invalidate_conditions_json, next_check,
          emotion_state, confidence, time_horizon, strategy_tags_json, refs_json,
          disclaimer_visible, reviewed_at, outcome, what_was_right, what_was_wrong, lesson, next_action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        createdAt,
        now,
        data.title,
        data.summary,
        data.marketContext ?? null,
        data.decision ?? null,
        data.action,
        JSON.stringify(data.assets ?? []),
        JSON.stringify(data.positionChange ?? []),
        data.risk ?? null,
        JSON.stringify(data.invalidateConditions ?? []),
        data.nextCheck ?? null,
        data.emotionState ?? null,
        data.confidence ?? null,
        data.timeHorizon ?? null,
        data.strategyTags ? JSON.stringify(data.strategyTags) : null,
        data.refs ? JSON.stringify(data.refs) : null,
        data.disclaimerVisible ? 1 : 0,
        data.reviewedAt ?? null,
        data.outcome ?? null,
        data.whatWasRight ?? null,
        data.whatWasWrong ?? null,
        data.lesson ?? null,
        data.nextAction ?? null
      )
      .run();

    const entry = await this.getJudgmentDiaryEntryById(id);
    if (!entry) {
      throw new Error('Failed to create judgment diary entry');
    }
    return entry;
  }

  async updateJudgmentDiaryEntry(id: string, data: UpdateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
    const existing = await this.getJudgmentDiaryEntryById(id);
    if (!existing) {
      throw new Error('Judgment diary entry not found');
    }

    const updates: string[] = [];
    const values: any[] = [];

    const updateField = (field: string, value: any) => {
      updates.push(`${field} = ?`);
      values.push(value);
    };

    if (data.title !== undefined) updateField('title', data.title);
    if (data.summary !== undefined) updateField('summary', data.summary);
    if (data.marketContext !== undefined) updateField('market_context', data.marketContext ?? null);
    if (data.decision !== undefined) updateField('decision', data.decision ?? null);
    if (data.action !== undefined) updateField('action', data.action);
    if (data.assets !== undefined) updateField('assets_json', JSON.stringify(data.assets ?? []));
    if (data.positionChange !== undefined) updateField('position_change_json', JSON.stringify(data.positionChange ?? []));
    if (data.risk !== undefined) updateField('risk', data.risk ?? null);
    if (data.invalidateConditions !== undefined) updateField('invalidate_conditions_json', JSON.stringify(data.invalidateConditions ?? []));
    if (data.nextCheck !== undefined) updateField('next_check', data.nextCheck ?? null);
    if (data.emotionState !== undefined) updateField('emotion_state', data.emotionState ?? null);
    if (data.confidence !== undefined) updateField('confidence', data.confidence ?? null);
    if (data.timeHorizon !== undefined) updateField('time_horizon', data.timeHorizon ?? null);
    if (data.strategyTags !== undefined) updateField('strategy_tags_json', data.strategyTags ? JSON.stringify(data.strategyTags) : null);
    if (data.refs !== undefined) updateField('refs_json', data.refs ? JSON.stringify(data.refs) : null);
    if (data.disclaimerVisible !== undefined) updateField('disclaimer_visible', data.disclaimerVisible ? 1 : 0);
    if (data.reviewedAt !== undefined) updateField('reviewed_at', data.reviewedAt ?? null);
    if (data.outcome !== undefined) updateField('outcome', data.outcome ?? null);
    if (data.whatWasRight !== undefined) updateField('what_was_right', data.whatWasRight ?? null);
    if (data.whatWasWrong !== undefined) updateField('what_was_wrong', data.whatWasWrong ?? null);
    if (data.lesson !== undefined) updateField('lesson', data.lesson ?? null);
    if (data.nextAction !== undefined) updateField('next_action', data.nextAction ?? null);

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE gk_judgment_diary_entries SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getJudgmentDiaryEntryById(id);
    if (!updated) {
      throw new Error('Failed to update judgment diary entry');
    }
    return updated;
  }
}
