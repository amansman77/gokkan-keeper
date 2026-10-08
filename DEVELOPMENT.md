# 개발 가이드 (Development Guide)

## Prerequisites

- Node.js 22.22.2 (recommended: use nvm)
- pnpm 10.7.0
- Cloudflare account (for Workers, D1, R2)

## Installation

### Step 1: Install Node.js (using nvm)

```bash
# Install and switch to the correct Node.js version
nvm install  # If version is not installed
nvm use               # Switch to the version specified in .nvmrc
```

### Step 2: Install pnpm

If pnpm is not installed, choose one of the following methods:

**Option A: Using Corepack (recommended, comes with Node.js)**
```bash
corepack enable
corepack prepare pnpm@10.7.0 --activate
```

**Option B: Using npm**
```bash
npm install -g pnpm
```

**Option C: Using standalone script**
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Verify installation:
```bash
pnpm --version  # Should show 10.7.0
```

### Step 3: Install project dependencies

```bash
# Install dependencies
pnpm install

# Build shared package
pnpm --filter shared build
```

**Quick Setup (all steps at once):**
```bash
nvm install && nvm use
corepack enable && corepack prepare pnpm@10.7.0 --activate
pnpm install && pnpm --filter shared build
```

**Note**: This project uses `.nvmrc` to specify Node.js version. If you're using nvm:
- If you see "N/A: version is not yet installed", run `nvm install` first
- Then run `nvm use` to switch to the correct version
- This ensures all developers use the same Node.js version

## Development

**Before running `pnpm dev`, make sure you've set up environment variables** (see Environment Variables section below).

```bash
# Run frontend and backend in development mode
pnpm dev

# Frontend: http://localhost:5173
# Backend: http://localhost:8787
```

**Quick setup for first-time development:**
```bash
# 1. Set up backend environment variables
cd apps/api
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set GOOGLE_CLIENT_ID, ALLOWED_EMAIL, and SESSION_SECRET

# 2. Set up frontend environment variables
cd ../web
cp .env.production.example .env
# Set VITE_GOOGLE_CLIENT_ID to the same OAuth client ID as GOOGLE_CLIENT_ID.
# VITE_API_BASE_URL may be omitted locally; it defaults to http://localhost:8787.

# 3. Go back to root and run dev
cd ../..
pnpm dev
```

## Environment Variables

**⚠️ Important**: Before running `pnpm dev`, you must set up environment variables.

### Backend (API) - `.dev.vars` file

Create `apps/api/.dev.vars` file for local development:

```bash
cd apps/api
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set GOOGLE_CLIENT_ID, ALLOWED_EMAIL, and SESSION_SECRET
```

Minimum content of `apps/api/.dev.vars`:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ALLOWED_EMAIL=owner@example.com
SESSION_SECRET=replace-with-a-long-random-secret
```

**Note**: `.dev.vars` is used by `wrangler dev` for local development. This file is gitignored for security.

`ALLOWED_SUB` can additionally pin the Google account subject. `API_SECRET` is
needed for operational alert runs and headless automation writes; it is not
used for browser login. `POST /automation/discord-notify` specifically requires
`X-API-Secret`, even when a browser session is valid. Market-data keys and the Discord webhook are optional unless you are
working on those integrations. See `.dev.vars.example` for the complete list.

### Frontend (Web) - `.env` file

Create `apps/web/.env` file:

```bash
cd apps/web
# Create .env file with the following content
```

Content of `apps/web/.env`:
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
# Optional; this is already the local default:
VITE_API_BASE_URL=http://localhost:8787
```

**Important**: 
- `VITE_GOOGLE_CLIENT_ID` must match `GOOGLE_CLIENT_ID` in `apps/api/.dev.vars`
- Both files are gitignored for security
- For production, set these in your deployment platform's environment variables

## Database Setup

### How D1 Works Locally

**Cloudflare D1** is Cloudflare's serverless SQLite database service. For local development:

- **Production**: Uses Cloudflare's managed D1 service in the cloud
- **Local Development**: `wrangler dev` creates a local SQLite file (in `.wrangler/state/`) that simulates D1
- The local SQLite file is completely separate from production - your local data won't affect production and vice versa
- You need to run migrations with `--local` flag to create tables in the local SQLite file

**Where is the local database?**
- Location: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`
- This is a regular SQLite file that you can inspect with SQLite tools if needed
- The file is gitignored (in `.gitignore`)

### For Local Development

**Option 1: Using npx (works without pnpm in PATH)**
```bash
# From project root
cd apps/api
npx wrangler d1 migrations apply shared-db --local
```

**Option 2: From root directory (if pnpm is available)**
```bash
# From project root
pnpm --filter api migrate:local
```

**Option 3: Enable corepack first (if pnpm command not found)**
```bash
# Enable corepack (if not already enabled)
corepack enable

# Then try again
cd apps/api
pnpm migrate:local
```

**Quick fix if pnpm is not found:**
```bash
# Just use npx directly - no pnpm needed
cd apps/api
npx wrangler d1 migrations apply shared-db --local
```

**Important Notes**:
- Run `migrate:local` **before** or **after** starting `wrangler dev` - both work
- If you see "no such table" errors, run `migrate:local` to create the tables
- The local database persists between `wrangler dev` sessions (unless you delete `.wrangler/` folder)

### For Production

See the production deployment section below. The existing D1 binding and
migration directory are defined in `apps/api/wrangler.toml`.

## Google OAuth configuration

In Google Cloud Console, use a **Web Application** OAuth client. Register
`http://localhost:5173` and `https://gokkan-keeper.yetimates.com` as authorized
JavaScript origins. `GOOGLE_CLIENT_ID` on the Worker and `VITE_GOOGLE_CLIENT_ID`
in the frontend must use that same client ID.

The single owner is restricted by `ALLOWED_EMAIL` and optional `ALLOWED_SUB`.
Use a random `SESSION_SECRET` of at least 32 bytes. The login flow and cookie
rules are documented in [AGENTS.md](AGENTS.md); the local negative-path smoke
check is in [docs/auth-integration-test.md](docs/auth-integration-test.md).

## Production deployment (Cloudflare)

The API runs on Cloudflare Workers; the frontend runs on Cloudflare Pages.
Configuration lives in `apps/api/wrangler.toml` and the root `wrangler.toml`.
The Pages runtime source is `apps/web/server/worker.ts`; web builds typecheck it
and emit `apps/web/dist/_worker.js`. Static assets and redirects live in
`apps/web/public`, not in the server source directory.
Use the existing `shared-db` binding; deployment does not require recreating the
database. Do not replace migrations with ad hoc schema SQL.

Wrangler can use an existing OAuth login or `CLOUDFLARE_API_TOKEN`.
`.envrc.example` documents optional direnv configuration; keep `.envrc` ignored
and never print token values. Check the active account before deploying:

```bash
pnpm --filter api exec wrangler whoami
```

For a new production environment, configure the required Worker secrets:

```bash
pnpm --filter api exec wrangler secret put GOOGLE_CLIENT_ID --env production
pnpm --filter api exec wrangler secret put ALLOWED_EMAIL --env production
pnpm --filter api exec wrangler secret put SESSION_SECRET --env production
```

Set `API_SECRET` for operational alert runs and automated writes, and integration
secrets only when needed. Existing deployments retain their configured secrets.
Frontend builds require `VITE_GOOGLE_CLIENT_ID`; put public build settings in
the ignored `apps/web/.env.production` using `.env.production.example` as a
template, or provide them as environment variables. `VITE_API_BASE_URL` and
`VITE_SITE_URL` are optional. Never put private tokens in `VITE_*` variables.

From the repository root, validate and build before deploying:

```bash
pnpm check
pnpm build
```

Apply pending migrations only when the change includes them, using the
production binding:

```bash
pnpm --filter api exec wrangler d1 migrations apply shared-db --remote --env production
```

The supported deployment commands run `pnpm check` and build fresh artifacts
before publishing. A failed check stops deployment:

```bash
pnpm deploy:prod:api
pnpm deploy:prod:web
```

Pages uses `main` as its production deployment branch; other branches create
previews. Before deploying, compare the intended commit with the latest
production deployment so existing functionality is preserved.

After deployment, verify `GET /health` returns `{"status":"ok"}`, an
unauthenticated `GET /granaries` returns `401`, and the production frontend
serves the latest HTML and assets. The current endpoints are
`https://gokkan-keeper-api-production.amansman77.workers.dev` and
`https://gokkan-keeper.yetimates.com`.

## Quality checks

`pnpm check` runs strict TypeScript checks, ESLint, focused boundary tests, and
`pnpm audit:dependencies`. CI runs the same checks plus a production build for
pull requests and pushes to `main`. CI uses a dummy public Google client ID for
compilation; it does not verify Google login or publish the resulting assets.
Configure the GitHub `Quality checks / check` job as a required branch check in
repository settings if merge protection is desired; the workflow alone does not
enforce that setting.

- TypeScript includes web, Pages runtime, Vite/Capacitor config, API, shared
  contracts, and API scripts.
- ESLint checks JS/MJS syntax and common correctness errors. TypeScript uses
  promise/async rules; DB files additionally prohibit `any` and unsafe type
  propagation. JSX async handlers handle errors in their implementation; `void`
  marks intentional calls to internally handled loading functions and declarative
  router navigation. Other layers still contain legacy `any` and are not covered
  by DB-specific unsafe-type rules.
- `bash -n` checks the auth integration script's syntax, not shell behavior.
- Boundary tests cover stored diary JSON, automation assets, legacy position
  valuation, snapshot nulls, public/auth/CORS HTTP boundaries, dependency exception
  restrictions, and deployment
  stopping when checks/builds fail. They are not a general unit or browser suite.
  The opt-in auth integration check remains in `docs/auth-integration-test.md`.
- Dependency auditing covers both runtime and development dependencies. Critical
  and High findings block checks; Moderate findings remain visible in the audit
  summary. Audit/network errors fail the check instead of being treated as clean.

### Temporary dependency exception

As of 2026-10-09, the unpatched
[braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
only reaches this project through `tailwindcss > chokidar > braces@3.0.3`.
It processes repository-owned file-watch patterns during local development and
is not bundled in the browser or deployed Worker. Replacing Tailwind would be a
separate design-system migration. `scripts/check-dependencies.mjs` permits only
that advisory, version, and exact dependency path until **2026-11-09 UTC**. A
new path, released patch, Critical severity, or expiry blocks checks. This is an
accepted temporary development-tool risk, not a repaired vulnerability. Recheck
upstream before expiry and remove the exception when a compatible fix is available.

The current audit also reports Moderate findings in Capacitor's `xcode > uuid`
and Tailwind's `postcss-selector-parser`. They are not silently excluded.
The `miniflare > sharp` override selects a compatible patched 0.35.x release;
remove it when Wrangler's dependency already includes the patched release.

Capacitor is now version 8 and requires Node 22. Native `ios`/`android` projects
are ignored and are not present in this checkout. Existing local native projects
must follow the [Capacitor 8 migration guide](https://capacitorjs.com/docs/updating/8-0)
before syncing; native builds were not validated here.

## Mobile App (Capacitor)

```bash
cd apps/web

# Sync Capacitor
pnpm cap:sync

# Open iOS/Android project
pnpm cap:ios
pnpm cap:android
```
