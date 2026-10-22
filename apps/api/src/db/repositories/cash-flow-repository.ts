import type { CashFlowRow, SqlValue } from '../rows';
import type { D1Database } from '@cloudflare/workers-types';
import { toMinorUnits } from '@gokkan-keeper/shared';
import type { Granary } from '@gokkan-keeper/shared';
import type { CashFlow, CreateCashFlow, UpdateCashFlow } from '@gokkan-keeper/shared';

function transformCashFlow(row: CashFlowRow): CashFlow {
  return {
    id: row.id,
    granaryId: row.granary_id,
    date: row.date,
    type: row.type,
    amount: row.amount,
    amountMinor: row.amount_minor ?? null,
    currency: row.money_currency ?? null,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CashFlowRepository {
  constructor(private readonly db: D1Database) {}

  async getCashFlowsByGranaryId(granaryId: string): Promise<CashFlow[]> {
    const result = await this.db
      .prepare('SELECT * FROM gk_cash_flows WHERE granary_id = ? ORDER BY date DESC, id DESC')
      .bind(granaryId)
      .all<CashFlowRow>();
    return (result.results || []).map(transformCashFlow);
  }

  async getCashFlowById(id: string): Promise<CashFlow | null> {
    const row = await this.db.prepare('SELECT * FROM gk_cash_flows WHERE id = ?').bind(id).first<CashFlowRow>();
    return row ? transformCashFlow(row) : null;
  }

  private async currency(granaryId: string): Promise<Granary['currency']> {
    const row = await this.db.prepare('SELECT currency FROM gk_granaries WHERE id = ?').bind(granaryId).first<{ currency: Granary['currency'] }>();
    if (!row) throw new Error('Granary not found');
    return row.currency;
  }

  async createCashFlow(data: CreateCashFlow): Promise<CashFlow> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const currency = await this.currency(data.granaryId);
    const minor = toMinorUnits(data.amount, currency);
    await this.db
      .prepare(`
        INSERT INTO gk_cash_flows (id, granary_id, date, type, amount, memo, created_at, updated_at, money_currency, amount_minor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, data.granaryId, data.date, data.type, data.amount, data.memo ?? null, now, now, currency, minor)
      .run();

    const created = await this.getCashFlowById(id);
    if (!created) throw new Error('Failed to create cash flow');
    return created;
  }

  async updateCashFlow(id: string, data: UpdateCashFlow): Promise<CashFlow> {
    const existing = await this.getCashFlowById(id);
    if (!existing) throw new Error('Cash flow not found');

    const updates: string[] = [];
    const values: SqlValue[] = [];
    const set = (field: string, value: SqlValue) => { updates.push(`${field} = ?`); values.push(value); };

    if (data.date !== undefined) set('date', data.date);
    if (data.type !== undefined) set('type', data.type);
    if (data.amount !== undefined) {
      const currency = await this.currency(existing.granaryId);
      set('amount', data.amount);
      set('money_currency', currency);
      set('amount_minor', toMinorUnits(data.amount, currency));
    }
    if (data.memo !== undefined) set('memo', data.memo ?? null);

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(new Date().toISOString(), id);

    await this.db.prepare(`UPDATE gk_cash_flows SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await this.getCashFlowById(id);
    if (!updated) throw new Error('Failed to update cash flow');
    return updated;
  }

  async deleteCashFlow(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM gk_cash_flows WHERE id = ?').bind(id).run();
  }
}
