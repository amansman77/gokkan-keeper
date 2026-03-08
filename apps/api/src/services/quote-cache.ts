import type { D1Database } from '@cloudflare/workers-types';
import type { PositionQuote, PositionQuoteOperation } from './quote-types';

const QUOTE_CACHE_TTL_HOURS = 6;
const NOT_FOUND_CACHE_TTL_MINUTES = 30;

interface CachedQuoteRow {
  quote_json: string | null;
  is_not_found: number;
  expires_at: string;
}

function getFutureIso(hours = 0, minutes = 0): string {
  const now = new Date();
  now.setUTCMinutes(now.getUTCMinutes() + minutes);
  now.setUTCHours(now.getUTCHours() + hours);
  return now.toISOString();
}

export function getCacheKey(symbol: string, operation: PositionQuoteOperation): string {
  return `${operation}:${symbol}`;
}

export async function getCachedQuote(
  db: D1Database | undefined,
  cacheKey: string,
): Promise<PositionQuote | null | undefined> {
  if (!db) return undefined;

  const now = new Date().toISOString();
  const row = await db
    .prepare(`
      SELECT quote_json, is_not_found, expires_at
      FROM gk_quote_cache
      WHERE cache_key = ? AND expires_at > ?
    `)
    .bind(cacheKey, now)
    .first<CachedQuoteRow>();

  if (!row) return undefined;
  if (row.is_not_found === 1) return null;
  if (!row.quote_json) return null;

  try {
    return JSON.parse(row.quote_json) as PositionQuote;
  } catch {
    return undefined;
  }
}

export async function setCachedQuote(
  db: D1Database | undefined,
  params: {
    cacheKey: string;
    lookupSymbol: string;
    operation: PositionQuoteOperation;
    quote: PositionQuote | null;
  },
): Promise<void> {
  if (!db) return;

  const { cacheKey, lookupSymbol, operation, quote } = params;
  const now = new Date().toISOString();
  const expiresAt = quote
    ? getFutureIso(QUOTE_CACHE_TTL_HOURS)
    : getFutureIso(0, NOT_FOUND_CACHE_TTL_MINUTES);

  await db
    .prepare(`
      INSERT INTO gk_quote_cache (cache_key, short_code, operation, quote_json, is_not_found, fetched_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        quote_json = excluded.quote_json,
        is_not_found = excluded.is_not_found,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at
    `)
    .bind(
      cacheKey,
      lookupSymbol,
      operation,
      quote ? JSON.stringify(quote) : null,
      quote ? 0 : 1,
      now,
      expiresAt,
    )
    .run();
}
