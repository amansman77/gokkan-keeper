# 배포 가이드 (Deployment Guide)

## 배포 전 준비사항

### 1. 빌드 확인

```bash
# 모든 패키지 빌드
pnpm build

# 또는 개별 빌드
pnpm --filter shared build
pnpm --filter web build
pnpm --filter api build
```

### 2. 프로덕션 D1 데이터베이스 생성

```bash
cd apps/api

# D1 데이터베이스 생성 (최초 1회만)
# 이미 다른 서비스용 데이터베이스가 있다면 새로 생성하지 않고 기존 것을 사용할 수 있습니다
pnpm wrangler d1 create shared-db
# 또는: npx wrangler d1 create shared-db

# 반환된 database_id를 복사하여 apps/api/wrangler.toml에 업데이트
# database_id = "실제-database-id"
```

**기존 데이터베이스 사용 시:**

이미 다른 서비스용 D1 데이터베이스가 있다면, `wrangler.toml`의 `database_id`를 해당 데이터베이스 ID로 설정하면 됩니다. 테이블 이름이 `gk_` prefix로 시작하므로 다른 서비스의 테이블과 충돌하지 않습니다.

### 3. 프로덕션 마이그레이션 실행

```bash
cd apps/api

# 프로덕션 데이터베이스에 마이그레이션 적용 (--remote 플래그 필요)
pnpm migrate
# 또는: pnpm wrangler d1 migrations apply shared-db --remote
# 또는: npx wrangler d1 migrations apply shared-db --remote
```

**중요**: 프로덕션 데이터베이스에 마이그레이션을 적용하려면 반드시 `--remote` 플래그를 사용해야 합니다. 플래그 없이 실행하면 로컬 데이터베이스에만 적용됩니다.

### 4. 환경 변수 설정

#### Backend (Cloudflare Workers)

**방법 1: Wrangler Secret (권장)**

```bash
cd apps/api
# 프로덕션 환경에 secret 설정
pnpm wrangler secret put API_SECRET --env production
# 또는: npx wrangler secret put API_SECRET --env production
# 프롬프트에 프로덕션 API_SECRET 입력

# 현재 설정된 secret 확인
pnpm wrangler secret list --env production
```

**방법 2: Cloudflare Dashboard**

1. Cloudflare Dashboard → Workers & Pages → gokkan-keeper-api
2. Settings → Variables and Secrets
3. Add secret: `API_SECRET`

#### Frontend

호스팅 플랫폼의 환경 변수 설정에서:

- `VITE_API_BASE_URL`: 프로덕션 API URL (예: `https://api.gokkan-keeper.com`)
- `VITE_API_SECRET`: 백엔드 `API_SECRET`과 동일한 값

## 배포 단계

### Backend 배포

```bash
cd apps/api

# 프로덕션 환경으로 배포
pnpm run deploy
# 또는
pnpm wrangler deploy --env production
# 또는
npx wrangler deploy --env production
```

**참고**: 
- `pnpm deploy` 대신 `pnpm run deploy`를 사용하세요. `pnpm deploy`는 pnpm의 내장 명령어가 아닙니다.
- 기본 환경(`gokkan-keeper-api`)이 생성되어 있다면 삭제하세요: `pnpm wrangler delete gokkan-keeper-api`

**커스텀 도메인 사용 시:**

1. Cloudflare에 도메인 추가
2. DNS 설정 확인 (도메인이 Cloudflare 프록시로 설정되어 있어야 함)
3. `wrangler.toml`의 `[env.production]` 섹션에서 라우팅 설정 확인

**도메인이 없는 경우:**

커스텀 도메인을 사용하지 않으려면 `wrangler.toml`에서 `routes` 설정을 제거하거나 주석 처리하세요:

```toml
[env.production]
# routes = [
#   { pattern = "api.gokkan-keeper.com", zone_name = "gokkan-keeper.com" }
# ]
```

이 경우 Workers는 기본 URL(`gokkan-keeper-api.your-subdomain.workers.dev`)로 배포됩니다.

### Frontend 배포

#### Vercel 배포 예시

```bash
cd apps/web

# 빌드
pnpm build

# Vercel CLI로 배포
vercel --prod

# 또는 Vercel Dashboard에서:
# 1. New Project → Import Git Repository
# 2. Root Directory: apps/web
# 3. Build Command: pnpm build
# 4. Output Directory: dist
# 5. Environment Variables 설정
```

#### Netlify 배포 예시

```bash
cd apps/web
pnpm build

# Netlify CLI로 배포
netlify deploy --prod

# 또는 Netlify Dashboard에서:
# 1. Add new site → Import from Git
# 2. Base directory: apps/web
# 3. Build command: pnpm build
# 4. Publish directory: dist
# 5. Environment variables 설정
```

#### Cloudflare Pages 배포

**상세 가이드**: `apps/web/CLOUDFLARE_PAGES_DEPLOY.md` 참고

**Git 연동 배포 (권장)**:

1. **Cloudflare Dashboard → Pages → Create a project**
2. **Connect to Git → Repository 선택**
3. **Build settings**:
   - Framework preset: None (또는 Vite)
   - **Build command**: `pnpm install && pnpm --filter shared build && pnpm --filter web build`
   - **Build output directory**: `apps/web/dist`
   - **Root directory**: `apps/web`
   - **Deploy command**: `echo "Deploy completed"` (또는 빈 문자열 - 필수 필드이지만 실제로는 사용되지 않음)
4. **Environment variables 설정** (Settings → Environment variables):
   - `VITE_API_BASE_URL`: `https://gokkan-keeper-api-production.amansman77.workers.dev`
   - `VITE_API_SECRET`: (백엔드와 동일한 값)
   - Environment: Production, Preview, Branch preview 모두 선택
5. **Save and Deploy**

**중요**: Deploy command를 설정하지 마세요! 빌드만 하면 자동으로 배포됩니다.

## 배포 후 확인사항

### 1. Health Check

```bash
# Backend health check
curl https://your-api-domain.com/health

# 예상 응답: {"status":"ok"}
```

### 2. API 인증 테스트

```bash
# 올바른 secret으로 테스트
curl -H "X-API-Secret: your-secret" https://your-api-domain.com/granaries

# 잘못된 secret으로 테스트 (401 예상)
curl -H "X-API-Secret: wrong-secret" https://your-api-domain.com/granaries
```

### 3. Frontend 연결 확인

1. 브라우저에서 프론트엔드 URL 접속
2. 개발자 도구 → Network 탭에서 API 요청 확인
3. 콘솔에서 에러 확인

### 4. 기능 테스트

- [ ] 곳간 생성
- [ ] 스냅샷 생성
- [ ] 곳간 수정
- [ ] 스냅샷 수정
- [ ] 상태 요약 확인

## 프로덕션 보안 권장사항

### Cloudflare Access 설정 (강력 권장)

1. Cloudflare Dashboard → Zero Trust → Access
2. Create Application
3. Application Domain: `api.gokkan-keeper.com` (또는 사용하는 도메인)
4. Policy 설정:
   - Include: 특정 이메일 도메인 또는 사용자
   - Require: Email
5. Save

이렇게 하면 Shared Secret 외에 추가 인증 레이어가 추가됩니다.

### API_SECRET 관리

- **절대** Git에 커밋하지 마세요
- 프로덕션과 개발 환경의 secret을 다르게 설정
- 정기적으로 secret 로테이션
- Cloudflare Secret 사용 (환경 변수보다 안전)

## 트러블슈팅

### Backend 배포 실패

- `wrangler.toml`의 `database_id` 확인
- Cloudflare 계정 로그인 확인: `wrangler login`
- 빌드 오류 확인: `pnpm --filter shared build` 실행

### Frontend가 API에 연결되지 않음

- `VITE_API_BASE_URL` 환경 변수 확인
- `VITE_API_SECRET` 환경 변수 확인
- CORS 설정 확인 (백엔드 `apps/api/src/index.ts`)
- 브라우저 콘솔의 네트워크 오류 확인

### 데이터베이스 오류

- 마이그레이션 실행 확인: `pnpm migrate` 또는 `pnpm wrangler d1 migrations apply shared-db --remote`
- 데이터베이스 ID 확인: `wrangler.toml`의 `database_id`
- Cloudflare Dashboard에서 데이터베이스 상태 확인
- 테이블 이름 확인: `gk_granaries`, `gk_snapshots` (prefix 확인)

**마이그레이션이 실행되었지만 테이블이 생성되지 않은 경우:**

마이그레이션 메타데이터(`_migrations`)만 생성되고 실제 테이블이 생성되지 않았다면, SQL을 직접 실행하세요:

```bash
cd apps/api

# 마이그레이션 파일을 직접 실행
pnpm wrangler d1 execute shared-db --file=../../migrations/0001_initial.sql --remote

# 또는 개별 SQL 명령어로 실행
pnpm wrangler d1 execute shared-db --remote --command="CREATE TABLE IF NOT EXISTS gk_granaries (id TEXT PRIMARY KEY, name TEXT NOT NULL, purpose TEXT NOT NULL, currency TEXT NOT NULL, owner TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));"
```

**로컬 개발 시 기존 데이터베이스 초기화:**

테이블 이름이 변경된 경우, 로컬 데이터베이스를 초기화해야 합니다:

```bash
# 로컬 데이터베이스 초기화 (기존 데이터 삭제됨)
rm -rf apps/api/.wrangler

# 마이그레이션 재실행
cd apps/api
pnpm migrate:local
```

