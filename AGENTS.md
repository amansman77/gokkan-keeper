# AI Agent Guide

This file is the shortest reliable path to understanding and changing Gokkan Keeper.

## Start Here

1. Read `ARCHITECTURE.md` for boundaries and request flows.
2. Read `packages/shared/src/schemas.ts` before changing a domain payload.
3. Locate the relevant API route in `apps/api/src/routes/`, then follow it to a repository or service.
4. Locate the corresponding web call in `apps/web/src/lib/api.ts`, then the page/component using it.
5. Run `pnpm typecheck`; run `pnpm build` when build scripts or production behavior changed.

## Repository Boundaries

- `apps/web`: React UI. Pages orchestrate data fetching; components hold reusable UI; `lib/api.ts` is the API client.
- `apps/api`: Hono/Cloudflare Worker API. `app.ts` composes HTTP middleware and routes; `index.ts` only adapts it to Worker fetch/cron handlers.
- `packages/shared`: cross-boundary domain types, Zod schemas, constants, and pure utilities. Put request/response contracts here when both apps use them.
- `migrations`: append-only D1 schema history. Never edit a migration that may have been applied; add the next numbered migration.
- `docs`: focused operational references. `docs/routes.md` is the route inventory.

## Change Map

| Change | Start in | Usually also check |
| --- | --- | --- |
| Domain field or validation | `packages/shared/src/schemas.ts` | shared types, migration, mapper, API route, form |
| Database read/write | `apps/api/src/db/repositories/` | `db/mappers.ts`, migration, route |
| Business/integration logic | `apps/api/src/services/` | route, environment bindings in `types.ts` |
| API endpoint | `apps/api/src/routes/` | `app.ts`, web `lib/api.ts`, `docs/routes.md` |
| Page or navigation | `apps/web/src/App.tsx` and `pages/` | SEO rules, protected-route rules, route docs |
| Authentication | `apps/api/src/auth/`, `middleware/auth.ts` | auth route, web auth context, integration test |
| Scheduled alert behavior | `services/alert-engine.ts` | `index.ts`, both Wrangler configs |

## Architectural Rules

- Keep HTTP parsing/status codes in routes, persistence in repositories, and reusable domain or external-provider logic in services.
- Validate external input with a shared Zod schema instead of duplicating ad hoc checks.
- Keep database snake_case conversion in `apps/api/src/db/mappers.ts`; expose camelCase JSON.
- Preserve the authentication boundary in `apps/api/src/app.ts`: routes registered before `authMiddleware` are anonymous.
- Judgment-diary GET routes and alert run routes are deliberate exceptions handled by `authMiddleware`; mutations require a session unless the handler verifies `API_SECRET`.
- The API is deployed both at direct Worker paths and behind the Pages `/api` proxy. Preserve existing aliases unless deployment routing is changed too.

## Verification

```bash
pnpm typecheck
pnpm build
```

There is no general unit-test suite yet. Authentication has an opt-in integration script (`pnpm --filter api test:auth:integration`) that requires a running API and credentials; see `docs/auth-integration-test.md`.

Do not commit generated `dist/`, local `.env`/`.dev.vars`, Wrangler state, or dependency directories.
