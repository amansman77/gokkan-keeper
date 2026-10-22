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
Frontend builds require `VITE_GOOGLE_CLIENT_ID` and `VITE_TURNSTILE_SITE_KEY`; put public build settings in
the ignored `apps/web/.env.production` using `.env.production.example` as a
template, or provide them as environment variables. `VITE_API_BASE_URL` and
`VITE_SITE_URL` are optional. Never put private tokens in `VITE_*` variables.

From the repository root, validate and build before deploying:

```bash
pnpm check
pnpm build
```

The production API deploy command applies pending numbered D1 migrations before
publishing the Worker. To apply them separately, use the production binding:

```bash
pnpm --filter api exec wrangler d1 migrations apply shared-db --remote --env production
```

The supported deployment commands run `pnpm check` and build fresh artifacts
before publishing; API production deploys also apply pending migrations. A failed
check or migration stops publishing:

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

## Security configuration and rollout

The API only accepts credentialed browser origins listed in
`apps/api/src/http/origins.ts`. Production permits the canonical web origin and
existing Capacitor origins; local HTTP origins require non-production mode.
Cookie writes and login/logout require `Origin`, and JSON writes require
`application/json`. SameSite=None remains for the existing native/direct-Worker
transport. Public and automation routes retain their explicit access inventory.

Google login verifies RS256 JWTs using Google's cached JWKS, rather than sending
credentials to tokeninfo. Sessions now expire after seven days, require a D1
registration, and are revoked on logout. Migration **0016 must precede this
Worker**. Existing cookies require one re-login after deployment. Changing the
owner email/subject or rotating SESSION_SECRET invalidates existing sessions.

Consulting needs a managed Turnstile widget restricted to the canonical domain.
Set its public site key in `VITE_TURNSTILE_SITE_KEY` for the build, and configure
its secret on the API:

```bash
pnpm --filter api exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Cloudflare may replace client IPs with a shared Worker IP for cross-zone
subrequests ([header semantics](https://developers.cloudflare.com/fundamentals/reference/http-headers/)).
Set the same independently generated, at least 32-character `PROXY_AUTH_SECRET`
on both services so Pages can attest the edge IP to the API. Never reuse an owner
or automation key, or put this value in VITE variables:

```bash
pnpm --filter api exec wrangler secret put PROXY_AUTH_SECRET --env production
pnpm --filter web exec wrangler pages secret put PROXY_AUTH_SECRET --project-name gokkan-keeper-web
```

Pages strips client-supplied attestation headers. API checks HMAC, timestamp
(within 30 seconds), method and path/query. Invalid/missing attestations fall
back to Cloudflare's IP, never arbitrary forwarded headers. Without matching
secrets, proxied clients can share a rate bucket. Roll out API and Pages together.
Login allows 20 attempts per 10-minute fixed window; consulting allows 3 per hour.
Buckets use HMAC identifiers in D1, not stored raw IPs. These limits bound abuse,
but do not replace Cloudflare DDoS protection.

Consulting additionally requires explicit consent to Discord transfer. The API
validates bounded PNG/JPEG/WebP container structure and dimensions, replaces the
original filename, and suppresses mentions. Structural checks are not a full
image decoder or malware scan. Operators must define and enforce Discord access
and retention outside this repository; no automatic Discord deletion is claimed.

Security audit records contain request ID, actor category/job ID, fixed route
domain, method and status. They omit credentials, email, IP, query and body.
Scheduled cleanup retains audit rows for 90 days and removes expired sessions
and rate buckets; cleanup runs on the existing cron schedule. Private responses
use no-store; API/Pages apply CSP, framing, MIME, referrer and HTTPS HSTS controls.
Client errors contain generic internal messages and request IDs, not raw exceptions.

### External automation credentials

`AUTOMATION_API_KEYS` is a secret containing a JSON array of up to 20 entries:
`[{"id":"weekly-report","secret":"<random value, minimum 32 characters>","scopes":["indicators:read","settings:read","discord:notify"],"expiresAt":"<optional ISO timestamp>"}]`.
Configure it with `wrangler secret put AUTOMATION_API_KEYS --env production`.
Jobs keep using `X-API-Secret` as the transport header. Invalid configuration fails
closed. See `apps/api/src/auth/automation.ts` for the exact method/path inventory.

| Caller | Required scopes |
| --- | --- |
| Weekly candidate report | indicators:read, settings:read, discord:notify |
| Quarterly candidate diary / annual NPS diary (separate keys) | diary:publish |
| Toss / Upbit sync (separate keys) | portfolio:read, positions:sync, snapshots:sync |
| Manual headless alert runner | alerts:run |

Public diary reads remain public even when a job supplies its key. Position and
snapshot sync retain their existing aliases and upsert methods. A scoped key
cannot edit diary history, change settings, export private records, or modify
unrelated owner domains. The legacy API_SECRET temporarily grants the union of
existing job scopes only, for compatibility. Browser sessions cannot call the
Discord automation endpoint or operational alert-run routes.

The five jobs live outside this checkout in `~/gokkan-keeper-automation/`.
Create separate random keys, install their matching entries on the Worker,
update each job's own protected credential store, and verify its scheduled flow.
Then remove the legacy API_SECRET. This repository change implements scoped keys;
it does **not** claim those external jobs have been migrated or their host audited.
Never include keys in Git, CI artifacts, reports, or chat output. Rotate a scoped
key by temporarily configuring old/new entries with distinct IDs, moving its job,
and deleting the old entry.

## Quality checks

Install the Chromium test browser once after installing dependencies:

```bash
pnpm setup:test
pnpm check
```

`pnpm check` runs types, lint, Node tests with coverage, isolated Worker/D1
integration tests, Chromium browser tests, and dependency auditing. The supported
deploy commands run this same gate and a fresh build, then execute a read-only
production smoke check. Smoke failures return a nonzero exit after publishing;
they do not automatically roll back a deployment.

| Command | Scope |
| --- | --- |
| `pnpm test` | Tooling tests, covered unit tests, Worker/D1 integration tests; saves logs |
| `pnpm test:boundaries` | Fast Node tests for domain/auth/Pages and tooling |
| `pnpm test:integration` | Worker/D1 CRUD, publication, auth and alert transition tests |
| `pnpm test:browser` | Chromium against Vite and the production bundle/Pages worker over local HTTPS, with isolated Worker/D1 |
| `pnpm test:coverage` | Coverage reports and thresholds for selected core modules |
| `pnpm smoke:prod [api\|web\|all]` | Read-only checks of the currently deployed endpoints |

Test commands prepare shared artifacts automatically. D1 integration tests bundle
`src/index.ts`, use the same compatibility date as Wrangler, and apply **all**
numbered migrations with Wrangler's SQL parser. Miniflare uses ephemeral local
storage, never the production D1 ID, remote bindings, `.dev.vars`, or real user
credentials. Its version is pinned to the version used by Wrangler; its current
v5 API uses the provided v4-option conversion helper.

Integration tests allow only fixture Google JWKS, Turnstile and Discord responses; all unexpected external requests fail. Browser tests use a
fake Google UI with the real local cookie/API flow, and block non-local requests.
The fixtures live entirely in test files and cannot authenticate against the
production app. The production-bundle browser fixture uses a temporary self-signed
TLS certificate and ignores certificate errors only in the test browser. It checks
CSP violations through the login and consulting flows. No real Google account,
brokerage account or Discord webhook is
required. The API servers listen only on loopback; tests do not reuse an existing
server. Chromium is installed inside the workspace's ignored dependencies.

Coverage includes JWT/session auth, automation permissions, origins, request
security, image/challenge validation, security persistence, alert rules, indicators,
market quotes and their
providers/cache, and shared utilities. It enforces **70% lines, 65% branches,
65% functions** in that selected scope. This is not whole-project coverage and
V8 coverage does not measure code running inside workerd. D1/browser assertions
provide separate runtime evidence. Tests cover positive/negative login, session
expiry/tampering, CRUD constraints, mixed public/private data, cached alert
transitions/dedup, numeric warm-up/trend boundaries, provider/manual fallbacks,
Pages cookie proxying, browser create/edit/reload/logout, and failed saves.
Real Google availability, native apps, every page and all external automation
flows are still outside the suite.

CI runs for every branch push, pull request, and weekly scheduled scan. It installs Chromium and executes
`pnpm check` plus a production build using dummy public Google/Turnstile build keys.
It always preserves `test-results`, `coverage`, and `playwright-report` for 14
days. Browser failures retain their first-attempt trace and screenshot; tests
have no automatic retries. The active GitHub `Protect main with PR and quality
checks` ruleset requires a pull request, resolved discussions, and a passing
`check` from GitHub Actions; force pushes and deletion are blocked. It requires
zero reviewer approvals for the current single-maintainer repository. Dependabot
security updates are enabled; `.github/dependabot.yml` schedules npm/actions
updates. CI source changes take effect after the branch is pushed.

Logs are under `test-results/*.log`, coverage HTML/LCOV/JSON under `coverage/api`,
and browser HTML/JUnit/traces under `playwright-report` and `test-results`.
The automated production smoke report is `test-results/production-smoke.json`;
it records statuses and build asset checks, not user records or credentials.

TypeScript also covers Vite/Capacitor configs and API scripts. ESLint adds promise
rules and prohibits unsafe types in DB files; other layers retain some legacy
`any`. `bash -n` checks auth-shell syntax; the integration suite additionally runs
the strict curl auth check against its fixture Worker. That check requires `401`
for invalid credentials, and a configuration `500` is a failure.
Dependency auditing covers development/runtime dependencies, blocks Critical and
High findings except the narrow temporary exception below, and fails on network
errors. Moderate findings remain visible in its summary.

### Temporary dependency exception

As of 2026-10-09, the unpatched
[braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
only reaches this project through `tailwindcss > chokidar > braces@3.0.3`.
It processes repository-owned file-watch patterns during local development and
is not bundled in the browser or deployed Worker. Replacing Tailwind would be a
separate design-system migration. `scripts/check-dependencies.mjs` permits only
that advisory, version, and exact dependency path until **2026-11-09 UTC**. A
new path, released patch, Critical severity, or expiry blocks checks. This is an
upstream-unfixed development-tool dependency with a local mitigation:
`patches/braces@3.0.3.patch` limits parser and recursive AST traversal depth to 64.
`scripts/braces-security.test.mjs` checks ordinary patterns, deeply nested patterns
and cyclic ASTs using the actual watcher dependency. The registry still reports
the advisory; the exception retains its expiry and exact path. Recheck upstream
before expiry and remove the patch/exception when a compatible fix is available.

Overrides select patched `uuid` for Capacitor's xcode tooling and patched
`postcss-selector-parser` for Tailwind and postcss-nested. Remove these overrides
when their parent packages already select patched versions.
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

## 데이터 보존·백업·복구

마이그레이션 **0017–0020을 API보다 먼저 적용**한다. 기존 행과 REAL 금액을
변환·삭제하지 않는다. DB 쓰기 트리거가 통화 변경, 날짜, 금액, boolean, 주요
열거형과 JSON 배열을 검증한다. 실제 계정 자동화는 기존 계약을 계속 사용할 수
있으며 원본 식별자 도입은 선택 사항이다. `source`/`sourceRecordId`는 계좌와
보유 단위까지 구분해 POST에 함께 넣고, 재호출에서 반환된 기존 ID를 PATCH한다.
외부 Toss/Upbit 스크립트를 이번 저장소 변경만으로 수정했다고 가정하지 않는다.

현재 cron에서 만료 시세 캐시·세션·rate bucket을 제거한다. 성공한 알림 대기열과
발송 중복 방지 키, 보안 요청 이력은 90일 보존한다. 실패한 대기열, 알림 로그,
스냅샷·입출금·일지 및 비공개 수정·삭제 이력은 서비스 데이터로 계속 보존한다.
개인 자료 삭제 요청에는 관련 변경 이력과 보관 백업까지 포함해 별도로 처리한다.
자동 백업 업로드나 운영자 PC/Discord 자료 삭제는 이 저장소가 수행하지 않는다.

알림 실패는 60초부터 최대 1시간의 backoff로 재시도 대상이 된다. 실제 재시도는
다음 cron/운영 실행 때 일어나며 별도 분 단위 실행을 추가한 것은 아니다. 최대
50건씩 처리하고 120초 claim lease와 15초 요청 timeout을 사용한다. HTTP 실패는
발송 성공으로 기록하지 않는다. Discord 성공 직후 DB 저장 전 Worker가 종료되면
재발송될 수 있다(외부 webhook에는 exactly-once 보장이 없음). 배포 이전에 잃은
알림의 원본 payload는 없으므로 이 변경이 과거 누락분을 추정 발송하지 않는다.

### 암호화한 Gokkan 전용 백업

`scripts/data-backup.mjs`는 `gk_`의 영속 데이터·스키마만 읽는다. 다른 서비스와
인증 세션·rate bucket·보안 요청 로그·시세 캐시의 행은 제외하고 빈 테이블로 복원한다. REAL 값은 17자리
표현으로 손실 없이 보존한다. 전체 데이터는 한 SELECT 시점의 스냅샷이며, 도중
스키마 변경은 실패한다. 현재 개인 서비스 규모를 위한 메모리 기반 백업으로,
데이터 증가 시 D1 응답/메모리 제한에 맞춘 다른 export 방식이 필요하다.

별도 비밀 저장소에서 생성·보관한 32바이트 키를 `GK_BACKUP_KEY`(64자 hex)로
주입한다. 키를 파일명·명령 인자·Git·CI artifact·채팅에 넣지 않는다. 키를 잃으면
백업을 복호화할 수 없다. 출력은 AES-256-GCM, 새 파일만 생성, 권한 0600이다.
아래 실제 실행은 운영자의 백업 보관 경로와 보호된 환경 변수를 사용한다.

```bash
node scripts/data-backup.mjs export /private/tmp/gokkan-local.gkbackup --local
node scripts/data-backup.mjs export /private/tmp/gokkan-production.gkbackup --remote
node scripts/data-backup.mjs restore-sql /private/tmp/gokkan-production.gkbackup
```

복호화된 `.restore.sql`도 0600이지만 평문이다. 격리 환경에서 검증하고 즉시
삭제한다. 백업은 코드·환경 변수·R2 파일의 백업이 아니며 인증 데이터는 재생성한다.
운영 보관 목표: 매일 1회 암호화 export와 큰 마이그레이션 직전 추가 export,
일별 30개·월별 12개 보관, 데이터 손실 목표(RPO) 24시간·복구 목표(RTO) 4시간.
이는 운영 정책 목표이며 외부 스케줄러와 보관 저장소가 설정되었다는 뜻은 아니다.
현재 배포된 D1의 실제 복구 가능 시각/요금제는 작업 때 별도로 확인해야 한다.

### 복구 훈련과 운영 복구

1. 쓰기와 외부 동기화, cron 알림을 중지하고 대상·복구 시각·RPO를 확인한다.
2. 기존 shared-db에 복구 SQL을 적용하지 않는다. 새 격리 D1에 Gokkan 전용
   restore SQL을 가져와 테이블별 건수·대표 금액/수량·JSON·외래 키를 확인한다.
3. `PRAGMA foreign_key_check`가 비어 있어야 한다. 수정·삭제 이력과 트리거,
   원본 식별자 고유 제약, pending 알림을 확인한다. 백업 이후 데이터 차이는
   별도 대조한다. 알림 재개 전에 외부 실제 발송 여부와 pending을 대조한다.
4. 인증/캐시 테이블은 빈 상태로 복원되므로 다시 로그인해야 한다.
   해당 코드 버전에 적용된 **Gokkan 마이그레이션만** 새 DB 이력에 기록한다.
   다른 서비스의 마이그레이션/데이터는 복원·표시하지 않는다. 자동 migrate를
   재실행하기 전에 schema/history가 일치하는지 확인한다.
5. 격리 Worker에서 private/public 접근과 읽기·쓰기 smoke를 검증한 뒤, 이
   서비스의 DB binding만 전환한다. 기존 DB는 유지해 비교/rollback에 사용한다.
   전체 shared-db 복구가 필요하면 다른 서비스 운영자와 영향/중단을 함께 결정한다.

`pnpm test:integration`의 backup 테스트는 두 개의 실제 ephemeral Worker/D1에서
암호화→복호화→새 스키마/데이터 복원→FK/금액/소수 수량/트리거 검증을 실행한다.
fixture만 사용하며 운영 데이터 export나 운영 복구를 실행하지 않는다.
Cloudflare [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)은
Paid 30일/Free 7일의 전체 DB 복구 기능이다. 공유 DB를 되돌리는 작업은 다른
서비스에도 영향을 주므로 이 Gokkan 전용 훈련과 구분한다.

### 구조 크기와 복잡도 회귀 검사

`pnpm check:structure`는 ESLint로 파일 400 코드 줄, 함수 100 코드 줄,
분기 복잡도 15, 중첩 4, 매개변수 5, 문장 50을 검사합니다. 빈 줄과 주석은
줄 수에서 제외하며 JSX는 포함합니다. 이 수치는 프로젝트의 검토 기준으로,
AI 이해도를 보장하는 보편적인 한계는 아닙니다.

폴더당 직접 파일 25개, 깊이 6, 소스 파일 32 KiB, `AGENTS.md` 12 KiB도
검사합니다. 프로젝트 전체 파일 수에는 상한을 두지 않고 도메인별 폴더로
탐색 범위를 제한합니다. 추적 파일과 gitignore에 걸리지 않는 새 파일을
포함하고, 의존성·빌드·비밀 파일·검사 결과는 제외합니다. `CLAUDE.md`는
심볼릭 링크로 집계하므로 가이드 내용을 중복 계산하지 않습니다.

결과는 `test-results/structure-audit/report.md`와 `metrics.json`에 남습니다.
JSON에는 각 파일의 바이트·전체/코드 줄 수와 모든 함수의 코드 줄 수·복잡도를
포함하므로 임계치를 넘지 않는 함수도 비교할 수 있습니다.
`pnpm check`와 CI에 포함되어 새로운 위반이나 기존 위반의 수치·개수 증가를
차단합니다. 현재 잔여 위반은 `scripts/structure-baseline.json`에 함수/규칙별
수치와 사유를 기록했습니다. 줄 번호 이동은 허용하지만 새 파일이나 함수로
위반을 옮기는 것은 허용하지 않습니다. 기준을 자동으로 다시 생성하지
마세요. 해결한 예외는 제거하고, 예외 확대가 필요하면 이유와 변경 수치를
검토해야 합니다. SQL의 명시적 null/undefined 매핑과 남은 JSX 화면은 해당
동작을 검증할 수 있는 변경에서 별도로 줄입니다.
