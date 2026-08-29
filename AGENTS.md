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

## Workspace map

- `apps/web`: React/Vite client. `src/app-routes.tsx` is the public/private route
  inventory and `src/App.tsx` renders it; all HTTP calls belong in
  `src/lib/api.ts`.
- `apps/api`: Hono Cloudflare Worker. `src/app.ts` composes the HTTP app while
  `src/index.ts` adapts it to Worker fetch and scheduled handlers. `src/routes`
  owns HTTP concerns, `src/services` owns external data and domain orchestration,
  and `src/db/repositories` owns D1 queries.
- `packages/shared`: types, Zod input schemas, constants, and pure utilities
  shared by web and API. Add cross-workspace contracts here instead of copying
  them into both apps.
- `migrations`: ordered D1 schema history. Never edit an applied migration;
  append a new numbered migration.
- `docs`: feature-specific decisions and historical plans. The current system
  overview is `ARCHITECTURE.md`; local setup is `DEVELOPMENT.md`.

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
  `apps/api/src/middleware/auth.ts` before adding or moving a route.
- `API_SECRET` is not the browser login mechanism. It only protects operational
  alert-run endpoints.
- When adding public data, opt in explicitly at the query/DTO layer. Do not
  serialize private database records and remove fields afterward.

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
