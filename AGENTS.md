# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Cursor, etc.) when working with code in this repository. `CLAUDE.md` is a symlink to this file.

## Commands

```bash
# First-time setup
pnpm install && pnpm --filter shared build

# Dev (frontend :5173, backend :8787) — requires .dev.vars / .env set up first, see DEVELOPMENT.md
pnpm dev

# Build everything (shared must build before web/api, since both depend on its dist/)
pnpm build

# Typecheck everything
pnpm typecheck

# Typecheck a single package
pnpm --filter api typecheck
pnpm --filter web typecheck

# Deploy
pnpm deploy:prod:api    # apps/api only (Cloudflare Workers)
pnpm deploy:prod:web    # apps/web only (Cloudflare Pages)
pnpm deploy:prod        # both, plus a full build first

# D1 migrations
cd apps/api && pnpm migrate:local   # local dev DB
cd apps/api && pnpm migrate         # remote/production DB

# Auth integration test (only test suite in the repo)
cd apps/api && pnpm test:auth:integration
```

There is no lint script and no unit test suite beyond the auth integration test — `tsc --noEmit` (via `typecheck`) is the correctness gate. Always run `pnpm typecheck` after backend changes; `apps/api` is Cloudflare Workers code (no Node APIs, `D1Database` types from `@cloudflare/workers-types`).

## Architecture

pnpm workspace monorepo: `apps/web` (Vite + React + Tailwind, deployed to Cloudflare Pages), `apps/api` (Hono on Cloudflare Workers, deployed via Wrangler), `packages/shared` (Zod schemas + types, consumed by both — **must be rebuilt** after editing before web/api typecheck picks up changes, since they import compiled `dist/`, not source).

### Data model note

Single D1 database (`shared-db`) shared across multiple unrelated services on the same Cloudflare account; all tables for this project are prefixed `gk_` to avoid collisions. Migrations in `migrations/` are numbered and applied in order — several are full-table rebuilds (`RENAME TO ..._old` → `CREATE` → `INSERT ... SELECT` → `DROP`) rather than `ALTER TABLE`, which is the established pattern here for anything beyond adding a nullable column.

### Auth: two paths into the API

`apps/api/src/middleware/auth.ts` gates everything except `/health`, `/auth/*`, `/public*`, and `GET /judgment-diary*` (the public Judgment Archive is intentionally read-open). Two ways to pass:
1. **Browser session** — Google OAuth, signed cookie (`SESSION_SECRET`), single allowed email (`ALLOWED_EMAIL`/`ALLOWED_SUB`). This is what the web app uses.
2. **`X-API-Secret` header** matching `env.API_SECRET` — for headless/automated callers only (see below). Not in the CORS `allowHeaders` allowlist, so it's unreachable from browser JS by design. When a request authenticates this way, `authMiddleware` sets `c.set('authViaApiSecret', true)`, which route handlers can check to distinguish automated calls from real user sessions (e.g. `judgment-diary.ts` only fires the Discord "published" notification for API-Secret-authenticated creates, not manual entries — see below).

### Judgment Diary vs. Positions/Granaries

Two largely independent halves of the app, both under the same auth:
- **Granary/Snapshot/Position**: the actual asset-tracking data model (README's "곳간" concept) — purpose-based asset buckets, periodic value snapshots, individual holdings with live-quote enrichment (`services/market-price.ts`, FSC API for KR tickers falling back to Yahoo Finance) and technical indicators (`services/technical-indicators.ts`, Yahoo Finance only, D1-cached 6h TTL via `gk_quote_cache`).
- **Judgment Diary**: a public, append-mostly decision log (`gk_judgment_diary_entries`). Entries are meant to record a decision *and its reasoning at the time it was made* (`title`/`summary`/`mainContent`/`action`); the schema also has later-review fields (`outcome`, `whatWasRight`, `lesson`, etc.) but **no UI currently exposes them** — only create/edit of the decision-time fields exists in `JudgmentDiaryForm.tsx`. Treat this distinction as load-bearing: don't casually add "outcome" UI without confirming that's actually wanted, since the diary's whole purpose (per README) is publishing judgment criteria before the fact, not narrating results after.

### Alert engine (`services/alert-engine.ts`)

Runs on Cloudflare Cron Triggers (daily weekdays + Friday weekly, see `wrangler.toml` and the `scheduled()` handler in `index.ts`) and evaluates event-transition rules (not state rules — see rule comments for why: a rule fires only on the moment a condition newly becomes true, tracked per symbol+rule in `gk_alert_rule_state`, deduped same-day via `gk_alert_sent`). Rules are defined inline in that file (`RULES` array) with `condition`/`message`/`action` per rule; adding a rule means adding an entry there, not a schema migration, unless it needs new indicator fields.

### External automation depending on this API

Five scheduled jobs run **outside this repo**, on the operator's own machine (`~/gokkan-keeper-automation/`, launchd-based, not part of this codebase or its deploys):
- **Weekly** (Saturdays): reads the latest Judgment Diary entry whose title contains "메가트렌드 후보군", uses its structured `assets` field (`{type, tickerOrName}[]`) as the ticker list, pulls indicator series via `GET /positions/indicators/series`, and posts a report to Discord via `POST /automation/discord-notify`. Implements the "megatrend candidate pool" investment process from the README's judgment philosophy. Its RSI overbought/oversold thresholds come from `GET /settings` (`weekly_report_rsi_overbought`/`_oversold`, editable on the `/alerts` page) rather than being hardcoded in the prompt. Also always includes a fixed crypto watchlist (BTC-USD/ETH-USD/DOGE-USD) hardcoded in the prompt template, independent of the quarterly candidate rotation.
- **Quarterly** (Jan/Apr/Jul/Oct 1st): researches candidate megatrends and registers a new Judgment Diary entry (`action: WATCH`) with `assets` populated, authenticated via `X-API-Secret`.
- **Annual** (mid-August): registers a separate Judgment Diary entry summarizing the National Pension Service's (국민연금) latest disclosed domestic/overseas equity holdings, title pattern "{연도}년 {분기}분기 국민연금 보유종목 동향" (deliberately distinct from the megatrend title pattern so the weekly job's title match doesn't pick it up). Runs yearly, not quarterly, because NPS only discloses stock-level holdings once a year (year-end snapshot, published the following Q3) despite having separate lighter quarterly/monthly aggregate disclosures.
- **Weekly** (Saturdays, 10 min after the candidate report): `toss-sync.mjs` — a plain deterministic Node script (not an LLM agent; this is mechanical ETL, not research/judgment) that pulls the operator's real Toss Securities brokerage account (holdings + cash, in both USD and KRW — cash can sit in either) via the official Toss OpenAPI (`https://openapi.tossinvest.com`, OAuth2 client-credentials) and upserts Positions + a Snapshot into the "비상금 (토스)" granary via this app's own API. Toss's API is IP-allowlisted, which is why this specifically has to run from the operator's own machine rather than Cloudflare Workers (Workers has no fixed egress IP without an enterprise contract).
- **Weekly** (Saturdays, 15 min after the candidate report): `upbit-sync.mjs` — same deterministic-ETL pattern as the Toss sync, but for the operator's real Upbit crypto holdings (BTC/ETH/DOGE — the same three coins the weekly candidate report and alert engine already track by symbol). Auth is a self-signed JWT (HS256, access key + nonce) per Upbit's API, no npm dependency needed. Updates the same BTC-USD/ETH-USD/DOGE-USD Positions in the "코인" granary that were originally created as 0-qty alert-engine placeholders, plus a Snapshot (holdings value + KRW cash).

Practical implication for this repo: **`assets` on Judgment Diary entries, `GET /positions/indicators/series`, and `POST /automation/discord-notify` are a real external contract**, not unused surface — don't remove or change their shapes without accounting for that. `POST /automation/discord-notify` intentionally requires `X-API-Secret` specifically (checked in the handler, not just the generic auth middleware) so it can't be triggered by a logged-in browser session.
