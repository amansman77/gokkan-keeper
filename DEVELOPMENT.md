# 개발 가이드 (Development Guide)

## Prerequisites

- Node.js 18.20.0 (recommended: use nvm)
- pnpm 8+
- Cloudflare account (for Workers, D1, R2)

## Installation

### Step 1: Install Node.js (using nvm)

```bash
# Install and switch to the correct Node.js version
nvm install 18.20.0  # If version is not installed
nvm use               # Switch to the version specified in .nvmrc
```

### Step 2: Install pnpm

If pnpm is not installed, choose one of the following methods:

**Option A: Using Corepack (recommended, comes with Node.js)**
```bash
corepack enable
corepack prepare pnpm@latest --activate
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
pnpm --version  # Should show 8.x or higher
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
nvm install 18.20.0 && nvm use
corepack enable && corepack prepare pnpm@latest --activate
pnpm install && pnpm --filter shared build
```

**Note**: This project uses `.nvmrc` to specify Node.js version. If you're using nvm:
- If you see "N/A: version is not yet installed", run `nvm install 18.20.0` first
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
# Edit .dev.vars and set API_SECRET

# 2. Set up frontend environment variables
cd ../web
echo "VITE_API_BASE_URL=http://localhost:8787" > .env
echo "VITE_API_SECRET=your-secret-key-here" >> .env
# Edit .env and set VITE_API_SECRET to match API_SECRET

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
# Edit .dev.vars and set your API_SECRET
```

Content of `apps/api/.dev.vars`:
```env
API_SECRET=your-secret-key-here-change-in-production
```

**Note**: `.dev.vars` is used by `wrangler dev` for local development. This file is gitignored for security.

### Frontend (Web) - `.env` file

Create `apps/web/.env` file:

```bash
cd apps/web
# Create .env file with the following content
```

Content of `apps/web/.env`:
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_API_SECRET=your-secret-key-here-change-in-production
```

**Important**: 
- The `VITE_API_SECRET` must match the `API_SECRET` in `apps/api/.dev.vars`
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

See [DEPLOYMENT.md](DEPLOYMENT.md) for production database setup.

## Mobile App (Capacitor)

```bash
cd apps/web

# Sync Capacitor
pnpm cap:sync

# Open iOS/Android project
pnpm cap:ios
pnpm cap:android
```

