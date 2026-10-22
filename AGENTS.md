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

[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) is the source of truth for color
and typography, and it is fully applied: every screen uses its tokens
(`bg-surface`, `text-ink`, `border-line`, `text-gain`/`text-loss`/`text-flow`,
…) and no raw Tailwind palette class or hardcoded hex remains in `apps/web/src`.
Read it before choosing a color, font, or weight, and do not reintroduce raw
palette classes — they would keep a fixed light-theme color while the tokens
around them flip, which is how dark mode breaks.

## Workspace map

- `apps/web`: React/Vite client. `src/app-routes.tsx` is the public/private route
  inventory and `src/App.tsx` renders it. Domain HTTP calls live in
  `src/lib/api/*`; `src/lib/api.ts` is their stable barrel entry point.
  `server/worker.ts` owns Pages redirects, the same-origin API proxy, and the
  dynamic sitemap; the build emits it as `dist/_worker.js`. `public` holds static
  assets and the single `_redirects` source.
- `apps/api`: Hono Cloudflare Worker. `src/app.ts` composes the HTTP app while
  `src/index.ts` adapts it to Worker fetch and scheduled handlers. `src/routes`
  owns HTTP concerns, `src/services` owns external data and domain orchestration,
  and `src/db/repositories` owns D1 queries. `scripts/simulation` replays rules,
  `scripts/experiments` compares candidate behavior, and `scripts/checks` holds
  operational/auth probes. Scripts are not Worker runtime entry points.
- `packages/shared`: types, Zod input schemas, constants, and pure utilities
  shared by web and API. Add cross-workspace contracts here instead of copying
  them into both apps.
- `migrations`: ordered D1 schema history. Never edit an applied migration;
  append a new numbered migration.
- `docs`: domain glossary, design system, and auth integration check. Local
  setup, Google OAuth configuration, and deployment are in `DEVELOPMENT.md`.

The runtime is Browser → Cloudflare Worker → D1. Cron triggers invoke the alert
engine in the same Worker. Both apps consume `@gokkan-keeper/shared`; the root
build compiles shared, then web, then API. D1 tables use the `gk_` prefix because
the database may be shared with other services.

## Request and data flow

### Finding the right source

Start with the glossary for meaning, then the executable source for behavior.
Use the workspace map above for boundaries and `DEVELOPMENT.md` only for setup
or deployment tasks. Open only the domain files needed for the task:

| Task | Starting points |
| --- | --- |
| Domain fields and write validation | `packages/shared/src/schemas.ts`, `utils.ts` |
| Korean labels | `apps/web/src/lib/terminology.ts` |
| Persistence | `apps/api/src/db/repositories/*`, `db/mappers.ts`, `migrations` |
| Authentication and publication | `apps/api/src/http/route-access.ts`, `apps/web/src/app-routes.tsx` |
| Prices and portfolio values | `apps/api/src/services/market-price.ts`, `public-portfolio.ts`, shared `getPositionMarketValue()` |
| Alert conditions and simulations | `apps/api/src/services/alert-rules.ts`, `apps/api/scripts/*` |
| Alert delivery and event state | `apps/api/src/services/alert-engine.ts`, `db/repositories/alert-delivery-repository.ts` |

Keep stored/API compatibility names (especially `currentValue` and `ruleId`)
stable during terminology refactors. Internal evaluation input is
`AlertRuleContext`, with `heldQuantity`; reserve `Snapshot` and `Position` for
their persisted domain models. Record new concepts in the glossary and put
repeated UI labels in `UI_TERMS`.

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

`apps/web/src/lib/api/client.ts` owns transport: private and auth calls include
credentials; public calls omit them. Add a browser page to exactly one route
list in `app-routes.tsx` so authentication and SEO exposure stay aligned.

## Authentication and publication rules

- Owner authentication is Google ID token verification followed by a signed,
  HttpOnly `gk_session` cookie (`apps/api/src/routes/auth.ts` and
  `apps/api/src/auth/session.ts`). Client requests that need the session use
  `credentials: 'include'` via `fetchAPI`. Google JWTs are verified against JWKS.
  Seven-day sessions are registered in D1, revoked on logout, and checked against
  the current owner allowlist on each request. Deploy migration 0016 before this code.
- Anonymous access is intentionally limited to health/auth, public portfolio and
  consulting endpoints, and read-only judgment-diary endpoints. Review
  `apps/api/src/http/route-access.ts` before adding or moving a route; it is the
  canonical inventory used by both app composition and authentication.
- Cookie-authenticated writes and login/logout require an exact trusted `Origin`;
  JSON writes also require `application/json`. CORS never trusts all Pages domains.
  Review `http/origins.ts` and `middleware/security.ts` when changing transport.
- `API_SECRET` is not browser login. `AUTOMATION_API_KEYS` defines per-job scopes in `auth/automation.ts`. The legacy
  `API_SECRET` permits only existing automation operations, not arbitrary owner
  writes or exports. Retire it after the five external jobs have separate keys.
- When adding public data, opt in explicitly at the query/DTO layer. Do not
  serialize private database records and remove fields afterward.
- A request authenticated via the `X-API-Secret` header (rather than the
  session cookie) has `authViaApiSecret` set on the request context by the auth
  layer; route handlers can check it to distinguish automated calls from real
  user sessions (e.g. `judgment-diary.ts` only fires the Discord "published"
  notification for API-Secret-authenticated creates, not manual entries — see
  docs/DOMAIN_OPERATIONS.md).

Public consulting requires verified Turnstile, explicit Discord-transfer consent,
bounded image validation and a D1-backed rate limit. Pages signs edge client IP
metadata with server-only `PROXY_AUTH_SECRET`; it is never an authentication key
or a `VITE_*` value. Unsigned forwarded headers are ignored. Security headers are
owned by the API middleware and Pages worker; keep login/challenge CSP tests passing.

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
6. Run `pnpm check` (types, lint, structure regression, covered unit tests,
   Worker/D1 integration, Chromium, dependency audit). Install Chromium once with
   `pnpm setup:test`. Run `pnpm build` when build scripts, generated SEO
   assets, routing, or deployment behavior changes.

Tests and commands are documented in `DEVELOPMENT.md`. `pnpm test` runs Node
and ephemeral Worker/D1 tests; `pnpm test:browser` runs Chromium with an isolated
API, and both prepare shared artifacts. Test fixtures must never use production
D1, credentials, or real notifications. Coverage thresholds apply only to the
listed core modules, not the whole project or workerd. Production deploy commands
also run read-only smoke checks after publishing. Do not equate typecheck/build
success with behavioral coverage. The legacy `test-candidate` and `test-tiering`
commands are experiments, not test suites.

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

## Domain-specific guardrails

- Snapshot changes can include deposits/withdrawals. Keep cash flows separate;
  the detail page adjusts changes for those flows, but does not calculate TWR.
- The judgment diary records reasoning at decision time. Later-review fields
  exist in storage but have no UI; do not introduce outcome editing casually.
- Alert conditions live in `services/alert-rules.ts`. Production and simulation
  share these rules and indicator math. Alerts fire on event transitions;
  `WARN_*` observes, while `SELL_001`/`BUY_001` are actionable.
- A `ruleId` rename needs a matching `gk_alert_rule_state` migration. Historical
  alert logs retain old IDs, so historical queries must account for both.
- Five scheduled jobs live outside this repository. Preserve diary `assets`,
  `GET /positions/indicators/series`, `POST /automation/discord-notify`, and
  positions/snapshots sync contracts. Discord automation requires a scoped
  `X-API-Secret` caller, not a browser session.

Read [docs/DOMAIN_OPERATIONS.md](docs/DOMAIN_OPERATIONS.md) for rule history,
simulation interpretation and the five external jobs before changing those areas.
Large screens use domain folders under `apps/web/src/components`: `granary-detail`,
`asset-goal`, `position-form`, and `snapshot-form`. Page files compose their parts;
keep loading hooks, calculations, and field groups with their owning domain.

## Data integrity and recovery

Deploy migrations 0017–0020 before this API. D1 write guards protect calendar dates,
amounts, flags and serialized arrays even for direct SQL. Granary currency is locked
once snapshots, cash flows or positions exist. New cash-flow writes use integer
minor units; preserve legacy REAL valuations and nullable exact-money fields.
Position source identities are optional, immutable pairs; never deduplicate by symbol.
Alert transitions and their outbox payloads must remain one D1 batch. Preserve retry
leases and pending records during cleanup. Revisions contain private previous rows.
Recovery and encrypted Gokkan-only backup commands are in DEVELOPMENT.md; never
restore the shared production database as part of a routine coding change.
