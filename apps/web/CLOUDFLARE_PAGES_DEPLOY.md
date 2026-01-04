# Cloudflare Pages 배포 가이드

## 배포 방법

### 방법 1: Wrangler CLI로 수동 배포 (권장 - 가장 확실함)

Git 연동에서 문제가 발생하면 Wrangler CLI로 직접 배포할 수 있습니다.

**1단계: 로컬에서 빌드**

```bash
cd /Users/hosung/Workspace/amansman77/gokkan-keeper

# Shared 패키지 빌드
pnpm --filter shared build

# 프론트엔드 빌드
pnpm --filter web build
```

**2단계: Wrangler로 배포**

```bash
cd apps/web

# 프로젝트 생성 (최초 1회만)
pnpm wrangler pages project create gokkan-keeper-web

# 환경 변수 설정 (최초 1회만)
pnpm wrangler pages secret put VITE_API_BASE_URL \
  --project-name=gokkan-keeper-web \
  --value="https://gokkan-keeper-api-production.amansman77.workers.dev"

pnpm wrangler pages secret put VITE_API_SECRET \
  --project-name=gokkan-keeper-web \
  --value="your-api-secret"

# 배포
pnpm wrangler pages deploy dist \
  --project-name=gokkan-keeper-web \
  --branch=main
```

**장점:**
- 빌드 결과물을 직접 지정할 수 있음
- Git 연동 설정 문제를 우회
- 빠르고 확실함

### 방법 2: Git 연동 배포

Cloudflare Pages Dashboard → Settings → Builds & deployments:

```
Build command: pnpm install && pnpm --filter shared build && pnpm --filter web build
Deploy command: echo "Deploy completed"
Version command: (비워두기)
Root directory: apps/web
```

**설명:**
- Root directory를 `apps/web`로 설정하면, 빌드는 `apps/web` 내에서 실행됨
- 빌드 결과물은 `apps/web/dist`에 생성됨
- Cloudflare Pages는 자동으로 `apps/web/dist`를 찾아야 함

## 문제 진단

"Hello world" 페이지가 보인다면:

1. **빌드 로그 확인**: `dist/index.html`이 생성되었는지 확인
2. **Root directory 확인**: 설정이 올바르게 저장되었는지 확인
3. **Cloudflare Pages가 찾는 디렉토리 확인**: 
   - Root directory가 `apps/web`이면 → `apps/web/dist`를 찾아야 함
   - Root directory가 비어있으면 → 루트의 `dist`를 찾아야 함

## 환경 변수 설정

**⚠️ 중요**: Vite는 빌드 시점에 환경 변수를 번들에 포함시킵니다. 환경 변수를 설정한 후 **반드시 다시 빌드**해야 합니다.

**⚠️ 환경 변수가 적용되지 않는 경우 확인사항:**

1. **환경 변수 이름 확인**: 정확히 `VITE_API_BASE_URL`과 `VITE_API_SECRET`인지 확인 (대소문자 구분)
2. **Environment 선택 확인**: Production, Preview, Branch preview 모두 선택했는지 확인
3. **빌드 재실행**: 환경 변수 설정 후 반드시 새로운 배포를 트리거해야 함
4. **브라우저 캐시**: 배포 후 브라우저에서 강력 새로고침 (Ctrl+Shift+R 또는 Cmd+Shift+R)
5. **콘솔 로그 확인**: 브라우저 개발자 도구 콘솔에서 "API Configuration" 로그 확인
   - `VITE_API_BASE_URL_RAW`가 `undefined`이면 환경 변수가 빌드에 포함되지 않은 것

### Cloudflare Pages Dashboard에서 설정

1. Cloudflare Pages Dashboard → 프로젝트 선택 → **Settings** → **Environment variables**
2. 다음 환경 변수 추가:

   - **Variable name**: `VITE_API_BASE_URL`
   - **Value**: `https://gokkan-keeper-api-production.amansman77.workers.dev`
   - **Environment**: Production, Preview, Branch preview 모두 선택

   - **Variable name**: `VITE_API_SECRET`
   - **Value**: (백엔드와 동일한 API_SECRET 값)
   - **Environment**: Production, Preview, Branch preview 모두 선택

3. **Save** 클릭
4. **Deployments** 탭으로 이동 → **Retry deployment** 또는 **Create deployment** 클릭하여 다시 빌드

### Wrangler CLI로 설정 (런타임 환경 변수용, Vite 빌드에는 사용 안 함)

⚠️ 참고: `wrangler pages secret`은 런타임 환경 변수용입니다. Vite는 빌드 시점에 환경 변수를 번들에 포함시키므로, Cloudflare Pages Dashboard의 "Environment variables"를 사용해야 합니다.

```bash
# 이 방법은 Vite 빌드에는 적용되지 않습니다
pnpm wrangler pages secret put VITE_API_BASE_URL \
  --project-name=gokkan-keeper-web \
  --value="https://gokkan-keeper-api-production.amansman77.workers.dev"
```

## SPA 라우팅

React Router를 사용하므로 `_redirects` 파일이 필요합니다. 
이 파일은 `apps/web/public/_redirects`에 있으며, 빌드 시 `apps/web/dist/_redirects`로 복사됩니다.

## 배포 확인

배포가 성공하면:

1. Cloudflare Pages에서 제공하는 URL 확인 (예: `gokkan-keeper-web.pages.dev`)
2. 브라우저에서 접속하여 동작 확인
3. 브라우저 콘솔에서 API 연결 확인
