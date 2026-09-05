# Gokkan Keeper agent guide

This file is the shortest reliable entry point for coding agents. Read it before
changing code, then open only the files related to the task.

## Product boundary

Gokkan Keeper is a purpose-based asset journal, not a trading system. Its main
domains are granaries, periodic snapshots, positions, and a public judgment
diary. Preserve the distinction between private owner data and deliberately
published portfolio/diary data.

Use [docs/DOMAIN_GLOSSARY.md](docs/DOMAIN_GLOSSARY.md) as the source of truth for
domain terms and field semantics. In particular, do not infer the meaning of the
legacy `Position.currentValue` field from its name.
Canonical Korean UI labels that mirror the glossary live in
`apps/web/src/lib/terminology.ts`; reuse them instead of introducing synonyms.

## Workspace map

- `apps/web`: React/Vite client. `src/app-routes.tsx` is the public/private route
  inventory and `src/App.tsx` renders it. Domain HTTP calls live in
  `src/lib/api/*`; `src/lib/api.ts` is their stable barrel entry point.
- `apps/api`: Hono Cloudflare Worker. `src/app.ts` composes the HTTP app while
  `src/index.ts` adapts it to Worker fetch and scheduled handlers. `src/routes`
  owns HTTP concerns, `src/services` owns external data and domain orchestration,
  and `src/db/repositories` owns D1 queries.
- `packages/shared`: types, Zod input schemas, constants, and pure utilities
  shared by web and API. Add cross-workspace contracts here instead of copying
  them into both apps.
- `migrations`: ordered D1 schema history. Never edit an applied migration;
  append a new numbered migration.
- `docs`: feature-specific decisions and focused operational guides. The
  repository-level system overview is `ARCHITECTURE.md`; local setup is
  `DEVELOPMENT.md`.

## Request and data flow

```text
React page/component
  -> apps/web/src/lib/api.ts
  -> apps/api/src/routes/*
  -> apps/api/src/services/* (when orchestration/external I/O is needed)
  -> apps/api/src/db/repositories/*
  -> D1
```

Shared Zod schemas validate write input at the API boundary. Database mappers
translate SQLite rows to the camelCase shared types. Do not access D1 from web
code or embed SQL in route handlers when a repository already owns that domain.

## Authentication and publication rules

- Owner authentication is Google ID token verification followed by a signed,
  HttpOnly `gk_session` cookie (`apps/api/src/routes/auth.ts` and
  `apps/api/src/auth/session.ts`). Client requests that need the session use
  `credentials: 'include'` via `fetchAPI`.
- Anonymous access is intentionally limited to health/auth, public portfolio and
  consulting endpoints, and read-only judgment-diary endpoints. Review
  `apps/api/src/http/route-access.ts` before adding or moving a route; it is the
  canonical inventory used by both app composition and authentication.
- `API_SECRET` is not the browser login mechanism. It only protects operational
  alert-run endpoints, plus a second automated-caller path (see below) for
  headless callers that need to write data, not just trigger a run.
- When adding public data, opt in explicitly at the query/DTO layer. Do not
  serialize private database records and remove fields afterward.
- A request authenticated via the `X-API-Secret` header (rather than the
  session cookie) has `authViaApiSecret` set on the request context by the auth
  layer; route handlers can check it to distinguish automated calls from real
  user sessions (e.g. `judgment-diary.ts` only fires the Discord "published"
  notification for API-Secret-authenticated creates, not manual entries — see
  external automation below).

## Change checklist

1. Identify the owning layer using the workspace map and follow a neighboring
   implementation.
2. Check new domain names against `docs/DOMAIN_GLOSSARY.md`; update the glossary
   when introducing a genuinely new concept.
3. If an API contract changes, update shared types/schemas, API handler, web API
   wrapper, and consumer together.
4. If persistence changes, add a migration, repository mapping, and shared type
   as applicable.
5. Keep public and authenticated route behavior explicit.
6. Run `pnpm typecheck`. Run `pnpm build` when build scripts, generated SEO
   assets, routing, or deployment behavior changes.

There is currently no general unit-test suite. Do not claim test coverage from a
successful typecheck. Auth has an opt-in integration check documented in
`docs/auth-integration-test.md`.

## Conventions and pitfalls

- TypeScript is strict; prefer shared domain types and `unknown` narrowing over
  introducing `any`.
- API JSON is camelCase even though D1 columns are snake_case.
- Public API aliases exist at both `/public/*` and `/api/public/*` for direct
  Worker access and same-origin Pages routing. Positions have a similar
  `/positions` and `/api/positions` compatibility mount.
- The frontend production default API base is `/api`; local development defaults
  to `http://localhost:8787`.
- Market quote providers are external and fallible. Preserve source/as-of
  metadata and fallback behavior when modifying price services.
- Never commit `.dev.vars`, `.env`, tokens, Google credentials, or webhook URLs.

## Judgment Diary vs. Positions/Granaries

Two largely independent halves of the app, both under the same auth:
- **Granary/Snapshot/Position**: the actual asset-tracking data model (README's "곳간" concept) — purpose-based asset buckets, periodic value snapshots, individual holdings with live-quote enrichment (`services/market-price.ts`, FSC API for KR tickers falling back to Yahoo Finance) and technical indicators (`services/technical-indicators.ts`, Yahoo Finance only, D1-cached 6h TTL via `gk_quote_cache`). `gk_cash_flows` (per-granary DEPOSIT/WITHDRAWAL ledger, `CashFlowManager.tsx` on the granary detail page) records external cash flows separately from Snapshots — this exists so a granary's total-value change can eventually be split into "money the user added/removed" vs. "actual investment performance" (time-weighted return), since a naive snapshot-to-snapshot % comparison conflates the two. No TWR calculation is implemented yet; this is just the ledger.
- **Judgment Diary**: a public, append-mostly decision log (`gk_judgment_diary_entries`). Entries are meant to record a decision *and its reasoning at the time it was made* (`title`/`summary`/`mainContent`/`action`); the schema also has later-review fields (`outcome`, `whatWasRight`, `lesson`, etc.) but **no UI currently exposes them** — only create/edit of the decision-time fields exists in `JudgmentDiaryForm.tsx`. Treat this distinction as load-bearing: don't casually add "outcome" UI without confirming that's actually wanted, since the diary's whole purpose (per README) is publishing judgment criteria before the fact, not narrating results after.

## Alert engine (`services/alert-engine.ts`)

Runs on Cloudflare Cron Triggers (daily weekdays + Friday weekly, see `wrangler.toml` and the `scheduled()` handler in `apps/api/src/index.ts`) and evaluates event-transition rules (not state rules — see rule comments for why: a rule fires only on the moment a condition newly becomes true, tracked per symbol+rule in `gk_alert_rule_state`, deduped same-day via `gk_alert_sent`). Rules are defined inline in that file (`RULES` array) with `condition`/`message`/`action` per rule; adding a rule means adding an entry there, not a schema migration, unless it needs new indicator fields. FX threshold rules reuse the same rule-state/dedup machinery and are user-managed (see `gk_settings` / the `/alerts` page) rather than hardcoded.

## External automation depending on this API

Five scheduled jobs run **outside this repo**, on the operator's own machine (`~/gokkan-keeper-automation/`, launchd-based, not part of this codebase or its deploys):
- **Weekly** (Saturdays): reads **all** Judgment Diary entries whose title contains "메가트렌드 후보군" and belong to the current quarter (a mid-quarter addition gets its own new entry, e.g. title suffixed "- K-뷰티 글로벌 밸류체인 편입", rather than editing the original — edits would rewrite the historical record of what was decided when), unions their `assets` fields (`{type, tickerOrName}[]`, deduped) into the ticker list, pulls indicator series via `GET /positions/indicators/series`, and posts a report to Discord via `POST /automation/discord-notify`. Implements the "megatrend candidate pool" investment process from the README's judgment philosophy. Its RSI overbought/oversold thresholds come from `GET /settings` (`weekly_report_rsi_overbought`/`_oversold`, editable on the `/alerts` page) rather than being hardcoded in the prompt. Also always includes a fixed crypto watchlist (BTC-USD/ETH-USD/DOGE-USD) hardcoded in the prompt template, independent of the quarterly candidate rotation. KR tickers are stored in `assets` with the Yahoo suffix already applied (e.g. `257720.KQ`) since this job's indicator calls don't pass a `market` param.
- **Quarterly** (Jan/Apr/Jul/Oct 1st): researches candidate megatrends and registers a new Judgment Diary entry (`action: WATCH`) with `assets` populated, authenticated via `X-API-Secret`.
- **Annual** (mid-August): registers a separate Judgment Diary entry summarizing the National Pension Service's (국민연금) latest disclosed domestic/overseas equity holdings, title pattern "{연도}년 {분기}분기 국민연금 보유종목 동향" (deliberately distinct from the megatrend title pattern so the weekly job's title match doesn't pick it up). Runs yearly, not quarterly, because NPS only discloses stock-level holdings once a year (year-end snapshot, published the following Q3) despite having separate lighter quarterly/monthly aggregate disclosures.
- **Weekly** (Saturdays, 10 min after the candidate report): `toss-sync.mjs` — a plain deterministic Node script (not an LLM agent; this is mechanical ETL, not research/judgment) that pulls the operator's real Toss Securities brokerage account (holdings + cash, in both USD and KRW — cash can sit in either) via the official Toss OpenAPI (`https://openapi.tossinvest.com`, OAuth2 client-credentials) and upserts Positions + a Snapshot into the "비상금 (토스)" granary via this app's own API. Toss's API is IP-allowlisted, which is why this specifically has to run from the operator's own machine rather than Cloudflare Workers (Workers has no fixed egress IP without an enterprise contract).
- **Weekly** (Saturdays, 15 min after the candidate report): `upbit-sync.mjs` — same deterministic-ETL pattern as the Toss sync, but for the operator's real Upbit crypto holdings (BTC/ETH/DOGE — the same three coins the weekly candidate report and alert engine already track by symbol). Auth is a self-signed JWT (HS256, access key + nonce) per Upbit's API, no npm dependency needed. Updates the same BTC-USD/ETH-USD/DOGE-USD Positions in the "코인" granary that were originally created as 0-qty alert-engine placeholders, plus a Snapshot (holdings value + KRW cash).

Practical implication for this repo: **`assets` on Judgment Diary entries, `GET /positions/indicators/series`, and `POST /automation/discord-notify` are a real external contract**, not unused surface — don't remove or change their shapes without accounting for that. `POST /automation/discord-notify` intentionally requires `X-API-Secret` specifically (checked in the handler, not just the generic auth middleware) so it can't be triggered by a logged-in browser session.
