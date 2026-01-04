import type { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  // STORAGE: R2Bucket; // 미래 사용을 위해 주석 처리
  API_SECRET: string;
}

