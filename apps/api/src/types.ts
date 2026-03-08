import type { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  // STORAGE: R2Bucket; // 미래 사용을 위해 주석 처리
  GOOGLE_CLIENT_ID: string;
  ALLOWED_EMAIL: string;
  SESSION_SECRET: string;
  ALLOWED_SUB?: string;
  DISCORD_WEBHOOK_URL?: string;
  FSC_STOCK_API_SERVICE_KEY?: string;
  FSC_STOCK_API_BASE_URL?: string;
  FSC_SECURITIES_PRODUCT_API_BASE_URL?: string;
  YAHOO_FINANCE_API_BASE_URL?: string;
}
