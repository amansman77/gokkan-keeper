# Architecture guide

Gokkan Keeper is a pnpm monorepo for a purpose-based asset journal. The system
separates private owner workflows from an explicitly public judgment archive and
portfolio view.

For task-oriented agent instructions, see [AGENTS.md](AGENTS.md). For local
setup, see [DEVELOPMENT.md](DEVELOPMENT.md). Domain language and ambiguous field
semantics are defined in [docs/DOMAIN_GLOSSARY.md](docs/DOMAIN_GLOSSARY.md).

## Runtime topology

```text
Browser (React + Vite)
  | JSON over HTTP; session cookie on private requests
  v
Cloudflare Worker (Hono)
  | SQL through domain repositories
  v
Cloudflare D1 (SQLite)

Worker scheduled triggers
  -> alert engine -> market providers / Discord webhook
```

- `apps/web`: static React application, deployable to Cloudflare Pages and
  prepared for Capacitor.
- `apps/api`: Hono Worker containing HTTP routes, authentication, domain
  services, scheduled alerts, and D1 access.
- `packages/shared`: compiled TypeScript package containing shared types, Zod
  schemas, constants, and pure utilities.
- `migrations`: the append-only D1 schema history.

The root build order is shared package, web, then API because both applications
consume `@gokkan-keeper/shared`.

## Backend boundaries

`apps/api/src/app.ts` is the HTTP composition root. It configures CORS, mounts
anonymous routes before authentication, applies the session middleware, and
mounts private routes. `apps/api/src/index.ts` is the Worker adapter that exports
the composed fetch handler and the scheduled alert handler.

Backend code is split by responsibility:

- `routes`: parse HTTP input, validate it, select status codes, and serialize
  responses.
- `services`: coordinate domain operations and external market/consulting/alert
  providers.
- `db/repositories`: contain D1 queries for granaries, snapshots, positions, and
  judgment-diary entries.
- `db/mappers.ts`: converts snake_case database rows to camelCase API objects.
- `auth` and `middleware`: create/verify sessions and enforce route access.

Write payload schemas live in `packages/shared/src/schemas.ts`; domain and API
types live in `packages/shared/src/types.ts`. Backend-only environment bindings
live in `apps/api/src/types.ts`.

## Frontend boundaries

`apps/web/src/app-routes.tsx` is the browser route inventory: it groups lazy
pages by public/private access and supplies route-level access checks used by
SEO. `apps/web/src/App.tsx` renders that inventory and owns navigation and the
application shell. Add a page to exactly one route list so authentication and
search-indexing behavior stay aligned. Pages compose domain components.

Pages import backend calls from the stable `apps/web/src/lib/api.ts` barrel.
Implementations are grouped by domain in `apps/web/src/lib/api/*`, while
`api/client.ts` owns the three intentional transport paths:

- authenticated requests include the session cookie;
- public requests omit credentials;
- auth requests include credentials so login/logout can set or clear cookies.

`apps/web/src/lib/config.ts` selects `http://localhost:8787` in development and
same-origin `/api` in production unless `VITE_API_BASE_URL` overrides it.

## Authentication and route exposure

The owner signs in with a Google ID token. The API verifies its audience and the
configured allowed account, then issues a 30-day HMAC-signed HttpOnly
`gk_session` cookie. This is a single-owner application even though some content
is public.

Anonymous API access includes:

- `GET /health`
- `/auth/*`
- `/public/*` and its `/api/public/*` alias
- read-only `GET /judgment-diary/*`

Other application routes require a valid session. Operational `/alerts/run/*`
handlers use `API_SECRET` rather than the browser session. The exact allowlist is
in `apps/api/src/middleware/auth.ts`; the executable browser inventory is in
`apps/web/src/app-routes.tsx`.

## Persistence

D1 tables use the `gk_` prefix because the database may be shared with other
services. The current domains are:

- `gk_granaries`: purpose-based asset containers and publication settings;
- `gk_snapshots`: dated value observations for a granary;
- `gk_positions`: holdings and optional public display metadata;
- `gk_judgment_diary_entries`: public judgment/action records;
- `gk_quote_cache`: cached external market quotes;
- `gk_alert_sent` and `gk_alert_log`: alert deduplication/history.

Migrations are ordered SQL files. Applied migrations are immutable; schema
changes must use the next numbered file.

## External integrations

- Google token info: owner identity verification.
- Korean FSC and Yahoo Finance endpoints: position prices and market data, with
  source and timestamp metadata retained in responses.
- Discord webhook: scheduled alert delivery.
- Cloudflare Cron Triggers: weekday daily and Friday weekly alert evaluation.

External failures must not silently become authoritative prices. Preserve
fallbacks, warnings, provider source, and `asOf` values.

## Validation and deployment

Run `pnpm typecheck` for the baseline repository check. Run `pnpm build` for
changes affecting web build scripts, SEO output, routes, or deployment. There is
no general automated unit-test suite at present; the auth integration smoke test
is documented separately.

Deployment details and Cloudflare bindings are in [DEPLOYMENT.md](DEPLOYMENT.md).
