import type { D1Database } from '@cloudflare/workers-types';
import { getPositionMarketValue, type PublicPortfolioResponse, type Position } from '@gokkan-keeper/shared';
import type { Env } from '../types';
import { enrichPositionWithQuote, loadQuotesForTargets, MarketQuoteService } from './market-price';

interface PublicPortfolioRow {
  id: string;
  granary_id: string | null;
  granary_name: string | null;
  granary_currency: string | null;
  market: string | null;
  name: string;
  symbol: string;
  asset_type: string | null;
  quantity: number | null;
  avg_cost: number | null;
  current_value: number | null;
  profit_loss: number | null;
  profit_loss_percent: number | null;
  public_thesis: string | null;
  public_order: number | null;
  last_public_update: string | null;
}

const MARKET_CURRENCY_BY_MARKET: Record<string, string> = {
  KRX: 'KRW',
  KOSDAQ: 'KRW',
  KOSPI: 'KRW',
  KONEX: 'KRW',
  NASDAQ: 'USD',
  NYSE: 'USD',
  AMEX: 'USD',
  TSE: 'JPY',
  HKEX: 'HKD',
  SSE: 'CNY',
  SZSE: 'CNY',
};
const REPORTING_CURRENCY = 'KRW';

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function inferPositionCurrency(row: PublicPortfolioRow): string | null {
  const normalizedMarket = row.market?.trim().toUpperCase();
  if (normalizedMarket && MARKET_CURRENCY_BY_MARKET[normalizedMarket]) {
    return MARKET_CURRENCY_BY_MARKET[normalizedMarket];
  }
  return normalizeCurrency(row.granary_currency);
}

function toPublicPosition(row: PublicPortfolioRow): Position {
  const now = row.last_public_update ?? new Date().toISOString();

  return {
    id: row.id,
    granaryId: row.granary_id,
    name: row.name,
    symbol: row.symbol,
    market: row.market,
    assetType: row.asset_type,
    quantity: toNullableNumber(row.quantity),
    avgCost: toNullableNumber(row.avg_cost),
    currentValue: toNullableNumber(row.current_value),
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

async function loadQuoteMap(
  rows: PublicPortfolioRow[],
  env?: Env,
  db?: D1Database,
): Promise<Map<string, Awaited<ReturnType<MarketQuoteService['getQuoteBySymbol']>>>> {
  if (!env || !db) {
    return new Map<string, Awaited<ReturnType<MarketQuoteService['getQuoteBySymbol']>>>();
  }

  const quoteService = new MarketQuoteService({
    ...env,
    DB: db,
  });

  return loadQuotesForTargets(
    rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      market: row.market,
      assetType: row.asset_type ?? null,
    })),
    quoteService,
  );
}

async function loadFxRateMap(
  rows: PublicPortfolioRow[],
  env?: Env,
  db?: D1Database,
): Promise<Map<string, number>> {
  if (!env || !db) return new Map<string, number>();

  const quoteService = new MarketQuoteService({
    ...env,
    DB: db,
  });

  const pairs = [...new Set(
    rows
      .map((row) => {
        const sourceCurrency = inferPositionCurrency(row);
        const targetCurrency = REPORTING_CURRENCY;
        if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return null;
        return `${sourceCurrency}:${targetCurrency}`;
      })
      .filter((pair): pair is string => !!pair),
  )];

  const entries = await Promise.all(
    pairs.map(async (pair) => {
      const [sourceCurrency, targetCurrency] = pair.split(':');
      const quote = await quoteService.getQuoteBySymbol(`${sourceCurrency}${targetCurrency}=X`);
      return [pair, quote?.closePrice ?? null] as const;
    }),
  );

  return new Map(
    entries.filter((entry): entry is readonly [string, number] => entry[1] !== null),
  );
}

export async function buildPublicPortfolioResponse(
  rows: PublicPortfolioRow[],
  env?: Env,
  db?: D1Database,
): Promise<PublicPortfolioResponse> {
  const quoteMap = await loadQuoteMap(rows, env, db);
  const fxRateMap = await loadFxRateMap(rows, env, db);
  const warnings: PublicPortfolioResponse['meta']['warnings'] = [];

  const evaluated = rows.map((row) => {
    const basePosition = toPublicPosition(row);
    const quote = quoteMap.get(row.id) ?? null;
    const enrichedPosition = enrichPositionWithQuote(basePosition, quote);
    const rawPositionMarketValue = getPositionMarketValue(enrichedPosition);
    const sourceCurrency = inferPositionCurrency(row);
    const targetCurrency = REPORTING_CURRENCY;
    const fxKey = sourceCurrency && targetCurrency ? `${sourceCurrency}:${targetCurrency}` : null;
    const fxRate = !fxKey || sourceCurrency === targetCurrency
      ? 1
      : (fxRateMap.get(fxKey) ?? null);
    const positionMarketValue = rawPositionMarketValue !== null
      ? rawPositionMarketValue * (fxRate ?? 1)
      : null;
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
      sourceCurrency,
      targetCurrency,
      fxRate,
      positionMarketValue,
      returnPercent,
      isEstimatedReturn,
    };
  });

  const totalAllocationBasis = evaluated.reduce((acc, item) => acc + (item.positionMarketValue ?? 0), 0);

  for (const item of evaluated) {
    if (
      item.positionMarketValue !== null &&
      item.sourceCurrency &&
      item.targetCurrency &&
      item.sourceCurrency !== item.targetCurrency &&
      item.fxRate === null
    ) {
      warnings.push({
        positionId: item.row.id,
        symbol: item.row.symbol,
        message: `Missing FX rate for ${item.sourceCurrency}/${item.targetCurrency}. Allocation may be approximate.`,
      });
    }
    if (item.positionMarketValue === null) {
      warnings.push({
        positionId: item.row.id,
        symbol: item.row.symbol,
        message: 'Missing allocation inputs. Set currentValue or provide quantity with a usable price.',
      });
    }
  }

  const data = evaluated.map((item) => ({
    symbol: item.row.symbol,
    name: item.row.name,
    granaryId: item.row.granary_id ?? null,
    granaryName: item.row.granary_name ?? null,
    allocationPercent: item.positionMarketValue !== null && totalAllocationBasis > 0
      ? ((item.positionMarketValue ?? 0) / totalAllocationBasis) * 100
      : null,
    returnPercent: item.returnPercent,
    thesis: item.row.public_thesis ?? null,
    lastUpdated: item.row.last_public_update ?? null,
    isEstimatedReturn: item.isEstimatedReturn,
    currentUnitPrice: item.enrichedPosition.currentUnitPrice ?? null,
    currentPriceAsOf: item.enrichedPosition.currentPriceAsOf ?? null,
    currentPriceSource: item.enrichedPosition.currentPriceSource ?? null,
  }));

  const integratedEntries = data.filter((item) => item.currentPriceSource && item.currentPriceSource !== 'MANUAL');
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
