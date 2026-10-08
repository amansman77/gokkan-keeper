import type { D1Database } from '@cloudflare/workers-types';

export interface Env {
  NODE_ENV?: string;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  ALLOWED_EMAIL: string;
  SESSION_SECRET: string;
  ALLOWED_SUB?: string;
  API_SECRET?: string;
  AUTOMATION_API_KEYS?: string;
  TURNSTILE_SECRET_KEY?: string;
  PROXY_AUTH_SECRET?: string;
  DISCORD_WEBHOOK_URL?: string;
  FSC_STOCK_API_SERVICE_KEY?: string;
  FSC_STOCK_API_BASE_URL?: string;
  FSC_SECURITIES_PRODUCT_API_BASE_URL?: string;
  YAHOO_FINANCE_API_BASE_URL?: string;
}

export interface Variables {
  requestId: string;
  actor?: string;
  // Set by authMiddleware when the request authenticated via the X-API-Secret
  // header instead of a browser session — used to identify automated/scheduled
  // callers (e.g. the quarterly megatrend cloud agent) for server-side notifications.
  authViaApiSecret?: boolean;
}

declare module 'hono' { interface ContextVariableMap extends Variables {} }
