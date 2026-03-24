import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreatePosition,
  Position,
  PublicPortfolioResponse,
  UpdatePosition,
} from '@gokkan-keeper/shared';
import type { Env } from '../../types';
import { buildPublicPortfolioResponse } from '../../services/public-portfolio';
import { transformPosition } from '../mappers';

export class PositionRepository {
  constructor(private readonly db: D1Database) {}

  async getPositions(granaryId?: string): Promise<Position[]> {
    const result = granaryId
      ? await this.db
          .prepare('SELECT * FROM gk_positions WHERE granary_id = ? ORDER BY updated_at DESC')
          .bind(granaryId)
          .all<any>()
      : await this.db
          .prepare('SELECT * FROM gk_positions ORDER BY updated_at DESC')
          .all<any>();

    return (result.results || []).map(transformPosition);
  }

  async getPositionById(id: string): Promise<Position | null> {
    const result = await this.db
      .prepare('SELECT * FROM gk_positions WHERE id = ?')
      .bind(id)
      .first<any>();
    return result ? transformPosition(result) : null;
  }

  async createPosition(data: CreatePosition): Promise<Position> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(`
        INSERT INTO gk_positions (
          id, granary_id, name, symbol, market, asset_type,
          quantity, avg_cost, current_value, weight_percent, profit_loss, profit_loss_percent, note,
          is_public, public_thesis, public_order, last_public_update, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
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
        null,
        data.profitLoss ?? null,
        data.profitLossPercent ?? null,
        data.note ?? null,
        data.isPublic ? 1 : 0,
        data.publicThesis ?? null,
        data.publicOrder ?? 0,
        data.isPublic ? now : null,
        now,
        now,
      )
      .run();

    const position = await this.getPositionById(id);
    if (!position) throw new Error('Failed to create position');
    return position;
  }

  async updatePosition(id: string, data: UpdatePosition): Promise<Position> {
    const existing = await this.getPositionById(id);
    if (!existing) throw new Error('Position not found');

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
    if (updates.length === 0) return existing;

    if (publicFieldsChanged) updateField('last_public_update', new Date().toISOString());
    updateField('updated_at', new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE gk_positions SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.getPositionById(id);
    if (!updated) throw new Error('Failed to update position');
    return updated;
  }

  async deletePosition(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM gk_positions WHERE id = ?').bind(id).run();
  }

  async getPublicPortfolioEntries(env?: Env): Promise<PublicPortfolioResponse> {
    const result = await this.db
      .prepare(`
        SELECT
          p.id,
          p.granary_id,
          g.currency AS granary_currency,
          p.market,
          p.name,
          p.symbol,
          p.asset_type,
          p.quantity,
          p.avg_cost,
          p.current_value,
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

    return buildPublicPortfolioResponse(result.results || [], env, this.db);
  }
}
