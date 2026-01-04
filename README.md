# Gokkan Keeper (곳간 지기)

> **Keeps an eye on what matters.**  
> 당신의 자산을 대신 살펴보는 곳간 지기

---

## 🧭 What is Gokkan Keeper?

**Gokkan Keeper(곳간 지기)** 는  
흩어진 계좌와 자산을 **목적별 ‘곳간’** 으로 모아  
삶의 자산 구조를 **한눈에 이해할 수 있도록 돕는 개인 자산 기록 도구**입니다.

이 서비스는 거래를 권하지 않습니다.  
대신, **지켜보고 · 기록하고 · 정리해주는 역할**에 집중합니다.

> 비상금은 비상금답게,  
> 가계 자산은 가계 자산답게,  
> 아이들 자산은 아이들 자산답게.

---

## 🤔 Why Gokkan Keeper?

대부분의 자산 관리 서비스는  
- 계좌 단위로 흩어져 있고
- 잦은 확인과 거래를 유도하며
- “얼마 벌었는지”만 보여줍니다.

Gokkan Keeper는 질문을 바꿉니다.

- 내 비상금은 **제 역할을 하고 있는가?**
- 코인이 전체 자산을 **흔들고 있지는 않은가?**
- 아이들 자산은 **잊히지 않고 관리되고 있는가?**

👉 **관리의 기준을 ‘계좌’가 아니라 ‘목적’으로 바꿉니다.**

---

## 🏠 Core Concept: Granary (곳간)

Gokkan Keeper에서 자산은 다음과 같이 관리됩니다.

- **곳간(Granary)**  
  자산의 *목적 단위*  
  (예: 비상금 곳간, 가계 곳간, 코인 곳간, 아이들 곳간)

- **곳간 지기(Keeper)**  
  자산을 대신 살펴보고,  
  상태를 요약하고,  
  오래 열리지 않은 곳간을 알려주는 존재

---

## ✍️ What You Track (MVP 기준)

Gokkan Keeper는 **최소한의 데이터만 기록**합니다.

- 날짜
- 계좌(또는 곳간)
- 총 평가 금액 (통화 포함)

선택적으로:
- 예수금
- 간단한 메모

> 종목 · 매수단가 · 거래내역은 필수가 아닙니다.  
> **‘관리되는 상태’를 만드는 것이 목표입니다.**

---

## 🔁 Tracking Rhythm (권장 주기)

- **비상금 / 가계 자산**: 월 1~2회
- **코인**: 주 1회 (또는 자동 스냅샷)
- **아이들 자산**: 분기 1회

👉 월 **6~10회 입력**이면  
“관리되고 있다”라고 말할 수 있는 수준을 목표로 합니다.

---

## 🛠 Tech Stack (MVP)

- **Frontend**: Vite + React (Capacitor-ready)
- **Backend**: Cloudflare Workers (Hono)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (CSV 등)
- **Cron**: Workers Cron Trigger
- **Auth**: Shared secret (Single-user MVP)

> 인프라보다 **지속 가능한 기록**을 우선합니다.

---

## 📂 Repository Structure

```
gokkan-keeper/
apps/
web/ # Frontend
api/ # Backend (Workers)
packages/
shared/ # types, utils, copy
migrations/ # DB migrations
wrangler.toml
```


---

## 🧠 Design Philosophy

- **Less data, more insight**
- **Observe, don’t trade**
- **Purpose over accounts**
- **Family-friendly by default**

Gokkan Keeper는  
숫자를 줄이고,  
구조를 드러내며,  
삶의 중심을 지키는 도구가 되고자 합니다.

---

## 🚧 Status

- [x] Domain & concept defined
- [x] Core data model
- [x] Manual snapshot input
- [x] Granary status summary (Gokkan Keeper voice)
- [ ] Upbit auto snapshot (Phase 2)
- [ ] Accounts table (Phase 2)

---

## 📜 License

Apache License 2.0  
(Planned)

---

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.20.0 (recommended: use nvm)
- pnpm 8+
- Cloudflare account (for Workers, D1, R2)

### Installation

#### Step 1: Install Node.js (using nvm)

```bash
# Install and switch to the correct Node.js version
nvm install 18.20.0  # If version is not installed
nvm use               # Switch to the version specified in .nvmrc
```

#### Step 2: Install pnpm

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

#### Step 3: Install project dependencies

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

### Development

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

### Environment Variables

**⚠️ Important**: Before running `pnpm dev`, you must set up environment variables.

#### Backend (API) - `.dev.vars` file

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

#### Frontend (Web) - `.env` file

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

### Database Setup

#### How D1 Works Locally

**Cloudflare D1** is Cloudflare's serverless SQLite database service. For local development:

- **Production**: Uses Cloudflare's managed D1 service in the cloud
- **Local Development**: `wrangler dev` creates a local SQLite file (in `.wrangler/state/`) that simulates D1
- The local SQLite file is completely separate from production - your local data won't affect production and vice versa
- You need to run migrations with `--local` flag to create tables in the local SQLite file

**Where is the local database?**
- Location: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`
- This is a regular SQLite file that you can inspect with SQLite tools if needed
- The file is gitignored (in `.gitignore`)

#### For Local Development

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

#### For Production

**Note**: Cloudflare D1 free plan allows up to 5 databases. This project uses table prefixes (`gk_`) to allow sharing a single database across multiple services.

```bash
cd apps/api

# Create D1 database (first time only)
# If you already have a database for other services, you can reuse it
wrangler d1 create shared-db

# Update database_id in apps/api/wrangler.toml with the returned database_id

# Run migrations (--remote flag required for production)
pnpm migrate
# Or: pnpm wrangler d1 migrations apply shared-db --remote
# Or: npx wrangler d1 migrations apply shared-db --remote
```

**Using existing database:**

If you already have a D1 database for other services, simply update `database_id` in `wrangler.toml` to use that database. Table names use `gk_` prefix (`gk_granaries`, `gk_snapshots`) to avoid conflicts with other services.

### Deployment

#### Pre-deployment Checklist

- [ ] Shared package built: `pnpm --filter shared build`
- [ ] All tests passing (if any)
- [ ] Environment variables configured
- [ ] D1 database created and migrated
- [ ] API_SECRET generated and secured
- [ ] Domain/subdomain configured (if using custom domain)

#### Step 1: Build All Packages

```bash
# Build shared package first
pnpm --filter shared build

# Build frontend and backend
pnpm build
```

#### Step 2: Create Production D1 Database

```bash
cd apps/api

# Create D1 database (first time only)
pnpm wrangler d1 create shared-db
# 또는: npx wrangler d1 create shared-db

# Copy the returned database_id and update apps/api/wrangler.toml:
# database_id = "your-actual-database-id-here"

# Run migrations on production database
wrangler d1 migrations apply shared-db
```

#### Step 3: Configure Production Environment Variables

**Backend (Cloudflare Workers)**:

Set secrets in Cloudflare Dashboard or via CLI:

```bash
cd apps/api

# Set API_SECRET as a secret (recommended)
wrangler secret put API_SECRET
# Enter your production API_SECRET when prompted

# Or set in wrangler.toml [env.production.vars] (less secure, not recommended for secrets)
```

**Frontend**:

Set environment variables in your hosting platform:
- `VITE_API_BASE_URL`: Your production API URL (e.g., `https://api.gokkan-keeper.com`)
- `VITE_API_SECRET`: Must match backend `API_SECRET`

#### Step 4: Deploy Backend (Cloudflare Workers)

```bash
cd apps/api

# Deploy to production
wrangler deploy --env production
```

**Note**: If using custom subdomain, ensure:
1. Domain is added to Cloudflare
2. DNS is configured
3. `wrangler.toml` has correct route configuration

#### Step 5: Deploy Frontend

**Option A: Static Hosting (Vercel, Netlify, Cloudflare Pages, etc.)**

```bash
cd apps/web

# Build for production
pnpm build

# Deploy dist/ folder to your hosting service
# Configure environment variables in hosting platform dashboard
```

**Option B: Manual Deployment**

```bash
cd apps/web
pnpm build

# Upload dist/ folder contents to your web server
# Ensure environment variables are set in your hosting environment
```

#### Step 6: Verify Deployment

1. Check backend health: `https://your-api-domain.com/health`
2. Test API endpoints with correct `X-API-Secret` header
3. Verify frontend can connect to API
4. Test creating granaries and snapshots

#### Post-deployment

- [ ] Test all core features (create granary, create snapshot, edit, etc.)
- [ ] Verify API authentication works
- [ ] Check CORS configuration
- [ ] Monitor error logs
- [ ] Set up Cloudflare Access (recommended for production security)

### Production Security

**⚠️ Important**: For production deployments, it's strongly recommended to use **Cloudflare Access** in addition to shared secret authentication:

- Shared secret provides basic authentication
- Cloudflare Access adds identity-based access control
- Configure Access policies to restrict API access to authorized users
- This provides defense-in-depth security for your personal asset data

### Mobile App (Capacitor)

```bash
cd apps/web

# Sync Capacitor
pnpm cap:sync

# Open iOS/Android project
pnpm cap:ios
pnpm cap:android
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## ✨ Closing

> 자산을 통제하지 않아도 괜찮습니다.  
> **지켜보고 있다는 감각**이면 충분합니다.

Gokkan Keeper is your quiet companion  
that keeps an eye on your granary.
