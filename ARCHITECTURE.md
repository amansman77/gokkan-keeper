# 아키텍처 가이드

Gokkan Keeper는 목적별 자산(곳간), 시점별 평가액(스냅샷), 보유 포지션, 판단 기록을 관리하고 일부 기록을 공개하는 pnpm 모노레포입니다.

## 실행 단위

```text
apps/web (React/Vite)
    │ HTTPS JSON, gk_session cookie
    ▼
apps/api (Hono on Cloudflare Workers)
    │ repository queries
    ▼
Cloudflare D1

packages/shared ── types / Zod schemas / pure utilities ──► web + api
```

- `apps/web`: React Router 페이지, UI 컴포넌트, API 클라이언트
- `apps/api`: HTTP 라우트, 인증, DB 저장소, 시장 데이터/알림 서비스
- `packages/shared`: 양쪽 앱이 공유하는 도메인 계약
- `migrations`: `gk_` 접두사를 쓰는 D1 스키마 변경 이력

## Backend Composition

`apps/api/src/index.ts`는 Cloudflare Worker 어댑터입니다. HTTP 앱 조립은 `app.ts`, 예약 실행은 `services/alert-engine.ts`에 위임합니다.

HTTP 요청 흐름은 다음 순서를 따릅니다.

1. `app.ts`가 CORS를 적용합니다.
2. health/auth/public 라우트를 인증 미들웨어보다 먼저 등록합니다.
3. `middleware/auth.ts`가 이후 요청의 `gk_session` 쿠키를 검증합니다.
4. `routes/`가 입력 파싱, Zod 검증, HTTP 응답을 담당합니다.
5. 단순 CRUD는 `db/repositories/`, 외부 연동·재사용 로직은 `services/`로 내려갑니다.
6. `db/mappers.ts`가 D1의 snake_case 행을 camelCase 도메인 객체로 바꿉니다.

판단일지 GET은 공개 아카이브를 위해 세션 검사를 통과합니다. `/alerts/run/*`은 세션 대신 핸들러에서 `API_SECRET`을 검증하는 운영용 예외입니다.

## Frontend Composition

- `src/App.tsx`: lazy page import, 라우트, 내비게이션, 공개/비공개 SEO 정책
- `src/pages/`: URL 단위 화면과 데이터 로딩 조율
- `src/components/`: 재사용 가능한 표현 및 폼 UI
- `src/lib/api.ts`: 모든 HTTP 호출과 응답 타입
- `src/lib/auth-context.tsx`: 현재 세션 상태와 로그인/로그아웃
- `src/lib/config.ts`: 개발/배포 API 및 사이트 URL 해석

프로덕션에서는 브라우저가 같은 출처의 `/api`를 호출하고 Pages Worker가 API Worker로 전달합니다. 로컬 기본 API 주소는 `http://localhost:8787`입니다.

## Domain and Database

핵심 관계는 다음과 같습니다.

```text
Granary 1 ── N Snapshot
Granary 1 ── N Position
JudgmentDiaryEntry (public archive; granary와 독립)
QuoteCache / AlertLog (시장 가격과 알림 운영 데이터)
```

정확한 필드 계약은 `packages/shared/src/types.ts`와 `schemas.ts`, 영속 구조는 `migrations/`가 기준입니다. 필드 변경 시 공유 계약 → migration → mapper/repository → route → web API/form 순으로 확인합니다.

## Authentication

1. Web이 Google Identity Services에서 ID token을 받습니다.
2. `POST /auth/google`이 Google token과 허용 계정을 검증합니다.
3. API가 HMAC 서명된 `gk_session` HttpOnly 쿠키를 설정합니다.
4. 보호된 API 호출은 `credentials: include`로 쿠키를 보냅니다.

필수 Worker 설정은 `GOOGLE_CLIENT_ID`, `ALLOWED_EMAIL`, `SESSION_SECRET`, DB binding입니다. 자세한 설정은 `docs/auth-google.md`를 봅니다. `API_SECRET`은 일반 사용자 인증 수단이 아니라 alert 실행 엔드포인트용입니다.

## Scheduled and External Services

Worker cron은 평일 daily 및 금요일 weekly alert engine을 실행합니다. 시장 가격 공급자, quote cache, 기술 지표 계산은 `apps/api/src/services/`에 모여 있습니다. 외부 응답 형식은 서비스 경계 안에서 정규화하고 라우트나 UI로 누출하지 않습니다.

## Build and Validation

shared가 먼저 빌드된 뒤 web과 api가 검사됩니다.

```bash
pnpm typecheck
pnpm build
```

개발 환경과 migration 실행은 `DEVELOPMENT.md`, 배포·binding·secret 설정은 `DEPLOYMENT.md`, 변경 위치를 빠르게 찾는 표는 `AGENTS.md`를 참고합니다.
