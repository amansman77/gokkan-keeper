# 아키텍처 가이드 (Architecture Guide)

## Tech Stack (MVP)

- **Frontend**: Vite + React (Capacitor-ready)
- **Backend**: Cloudflare Workers (Hono)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (CSV 등)
- **Cron**: Workers Cron Trigger
- **Auth**: Shared secret (Single-user MVP)

> 인프라보다 **지속 가능한 기록**을 우선합니다.

## Repository Structure

```
gokkan-keeper/
├── apps/
│   ├── web/          # Frontend (Vite + React)
│   └── api/          # Backend (Cloudflare Workers)
├── packages/
│   └── shared/       # Shared types, schemas, utils
├── migrations/       # D1 database migrations
└── wrangler.toml     # Cloudflare Workers configuration
```

### Apps

#### `apps/web` - Frontend
- **Framework**: Vite + React
- **Routing**: React Router
- **Styling**: Tailwind CSS
- **Mobile**: Capacitor (iOS/Android)
- **Build**: `pnpm build` → `dist/`

#### `apps/api` - Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Shared secret via `X-API-Secret` header
- **Deploy**: `pnpm wrangler deploy --env production`

### Packages

#### `packages/shared` - Shared Code
- TypeScript types (`Granary`, `Snapshot`, etc.)
- Zod schemas for validation
- Utility functions
- Constants

Used by both frontend and backend for type safety and consistency.

### Database

#### D1 Database Structure

**Table Prefix**: `gk_` (for multi-service database sharing)

- `gk_granaries`: 곳간 정보
  - `id`, `name`, `purpose`, `currency`, `owner`, `created_at`, `updated_at`
  
- `gk_snapshots`: 스냅샷 기록
  - `id`, `granary_id`, `date`, `total_amount`, `available_balance`, `memo`, `created_at`
  - `UNIQUE(granary_id, date)` constraint

**Note**: Cloudflare D1 free plan allows up to 5 databases. This project uses table prefixes to share a single database across multiple services.

## Data Flow

1. **Frontend** → API request with `X-API-Secret` header
2. **Backend** → Validate secret → Query D1 database
3. **Backend** → Transform snake_case to camelCase → Return JSON
4. **Frontend** → Display data with React components

## Authentication

**MVP**: Shared secret authentication
- Single secret (`API_SECRET`) for all requests
- Sent via `X-API-Secret` header
- Backend validates against `c.env.API_SECRET`

**Production Recommendation**: Add Cloudflare Access for additional security layer.

## CORS Configuration

Allowed origins:
- `http://localhost:*` (local development)
- `capacitor://localhost` (Capacitor apps)
- `*.pages.dev` (Cloudflare Pages)
- Custom domains (configured in `apps/api/src/index.ts`)

## Environment Variables

### Backend
- `API_SECRET`: Shared secret for authentication

### Frontend
- `VITE_API_BASE_URL`: API endpoint URL
- `VITE_API_SECRET`: Must match backend `API_SECRET`

## Build Process

1. **Shared package**: TypeScript compilation → `packages/shared/dist/`
2. **Frontend**: Vite build → `apps/web/dist/`
3. **Backend**: TypeScript compilation → bundled by Wrangler

## Deployment

- **Backend**: Cloudflare Workers (via Wrangler)
- **Frontend**: Cloudflare Pages (or any static hosting)
- **Database**: Cloudflare D1 (managed service)

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

