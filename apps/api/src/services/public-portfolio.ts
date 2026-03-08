import type { D1Database } from '@cloudflare/workers-types';
import type { PublicPortfolioResponse, Position } from '@gokkan-keeper/shared';
import type { Env } from '../types';
import { enrichPositionWithQuote, FscStockPriceService, normalizeShortCode } from './fsc-stock-price';

interface PublicPortfolioRow {
  id: string;
  granary_id: string | null;
  granary_name: string | null;
  name: string;
  symbol: string;
  asset_type: string | null;
  quantity: number | null;
  avg_cost: number | null;
  current_value: number | null;
  weight_percent: number | null;
  profit_loss: number | null;
  profit_loss_percent: number | null;
  public_thesis: string | null;
  public_order: number | null;
  last_public_update: string | null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPublicPosition(row: PublicPortfolioRow): Position {
  const now = row.last_public_update ?? new Date().toISOString();

  return {
    id: row.id,
    granaryId: row.granary_id,
    name: row.name,
    symbol: row.symbol,
    market: null,
    assetType: row.asset_type,
    quantity: toNullableNumber(row.quantity),
    avgCost: toNullableNumber(row.avg_cost),
    currentValue: toNullableNumber(row.current_value),
    weightPercent: toNullableNumber(row.weight_percent),
    profitLoss: toNullableNumber(row.profit_loss),
    profitLossPercent: toNullableNumber(row.profit_loss_percent),
    note: null,
    isPublic: true,
    publicThesis: row.public_thesis,
    publicOrder: row.public_order ?? 0,
    lastPublicUpdate: row.last_public_update,
    createdAt: now,
    updatedAt: now,
  };
}

function resolvePositionMarketValue(position: Position): number | null {
  if (position.currentMarketValue !== null && position.currentMarketValue !== undefined) {
    return position.currentMarketValue;
  }
  if (position.currentValue === null || position.currentValue === undefined) {
    return null;
  }
  if (position.quantity !== null && position.quantity !== undefined) {
    return position.quantity * position.currentValue;
  }
  return position.currentValue;
}

async function loadQuoteMap(
  rows: PublicPortfolioRow[],
  env?: Env,
  db?: D1Database,
): Promise<Map<string, Awaited<ReturnType<FscStockPriceService['getQuoteBySymbol']>>>> {
  const quoteMap = new Map<string, Awaited<ReturnType<FscStockPriceService['getQuoteBySymbol']>>>();

  if (!env) {
    return quoteMap;
  }

  const quoteService = new FscStockPriceService(
    env.FSC_STOCK_API_SERVICE_KEY,
    env.FSC_STOCK_API_BASE_URL,
    db,
    env.FSC_SECURITIES_PRODUCT_API_BASE_URL,
  );

  if (!quoteService.isEnabled()) {
    return quoteMap;
  }

  const shortCodeAssetTypeMap = new Map<string, string | null>();
  for (const row of rows) {
    const shortCode = normalizeShortCode(String(row.symbol ?? ''));
    if (!shortCode || shortCodeAssetTypeMap.has(shortCode)) continue;
    shortCodeAssetTypeMap.set(shortCode, row.asset_type ?? null);
  }

  const quoteEntries = await Promise.all(
    Array.from(shortCodeAssetTypeMap.entries()).map(async ([shortCode, assetType]) => (
      [shortCode, await quoteService.getQuoteBySymbol(shortCode, { assetType })] as const
    )),
  );

  for (const [shortCode, quote] of quoteEntries) {
    quoteMap.set(shortCode, quote);
  }

  return quoteMap;
}

export async function buildPublicPortfolioResponse(
  rows: PublicPortfolioRow[],
  env?: Env,
  db?: D1Database,
): Promise<PublicPortfolioResponse> {
  const quoteMap = await loadQuoteMap(rows, env, db);
  const warnings: PublicPortfolioResponse['meta']['warnings'] = [];
  const hasAnyWeight = rows.some(
    (row) => row.weight_percent !== null && row.weight_percent !== undefined,
  );

  const evaluated = rows.map((row) => {
    const basePosition = toPublicPosition(row);
    const shortCode = normalizeShortCode(String(row.symbol ?? ''));
    const quote = shortCode ? quoteMap.get(shortCode) ?? null : null;
    const enrichedPosition = enrichPositionWithQuote(basePosition, quote);
    const positionMarketValue = resolvePositionMarketValue(enrichedPosition);
    const weightPercent = toNullableNumber(row.weight_percent);
    const avgCost = enrichedPosition.avgCost ?? null;

    let returnPercent: number | null = null;
    let isEstimatedReturn = false;

    if (row.profit_loss_percent !== null && row.profit_loss_percent !== undefined) {
      returnPercent = Number(row.profit_loss_percent);
    } else if (
      avgCost !== null &&
      avgCost !== 0 &&
      (enrichedPosition.currentUnitPrice ?? enrichedPosition.currentValue) !== null
    ) {
      returnPercent = (
        ((enrichedPosition.currentUnitPrice ?? enrichedPosition.currentValue ?? 0) - avgCost)
        / avgCost
      ) * 100;
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
      enrichedPosition,
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
      ? (
        hasAnyWeight
          ? (item.weightPercent ?? null)
          : ((item.positionMarketValue ?? 0) / totalAllocationBasis) * 100
      )
      : null,
    returnPercent: item.returnPercent,
    thesis: item.row.public_thesis ?? null,
    lastUpdated: item.row.last_public_update ?? null,
    isEstimatedReturn: item.isEstimatedReturn,
    currentUnitPrice: item.enrichedPosition.currentUnitPrice ?? null,
    currentPriceAsOf: item.enrichedPosition.currentPriceAsOf ?? null,
    currentPriceSource: item.enrichedPosition.currentPriceSource ?? null,
  }));

  const integratedEntries = data.filter((item) => item.currentPriceSource === 'FSC_STOCK_PRICE_API');
  const manualEntries = data.filter((item) => item.currentPriceSource === 'MANUAL');
  const latestAsOf = integratedEntries
    .map((item) => item.currentPriceAsOf)
    .filter((value): value is string => !!value)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    data,
    meta: {
      warnings,
      pricing: {
        integratedCount: integratedEntries.length,
        manualCount: manualEntries.length,
        latestAsOf,
      },
    },
  };
}
