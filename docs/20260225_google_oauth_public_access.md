# plan.md — Cloudflare Workers Google OAuth (Single-Account) + Public/Private Access Control

## 0. Goal
곶간지기를 대중 공개 가능한 형태로 만든다.

- **익명(비로그인)**: `Judgment`, `Public Archive`만 접근 가능
- **로그인(관리자 1인: 내 Google 계정만 허용)**: 대시보드/개인 자산 영역 접근 가능
- 로그인 UX는 “Google로 로그인” 버튼 하나로 자연스럽게 제공
- 인증은 **Cloudflare Workers**에서 처리하며, 성공 시 **HttpOnly 세션 쿠키** 발급

> MVP 원칙: 구조 단순화. (DB 분리/권한 레벨 세분화는 제외)

## 1. Current Context
- 프론트는 `localhost:5173` 기반 (Vite로 추정)
- 백엔드는 **Cloudflare Workers**
- 기존 `/login` 페이지는 “API Secret 입력” 방식이며 UX가 어색함 → **Google OAuth로 교체**

## 2. Scope

### In Scope
1) Google OAuth 로그인 (내 계정 1개만 허용)
2) Worker에서 ID Token 검증 후 세션 쿠키 발급/삭제
3) Private routes route guard (익명 접근 차단)
4) Navigation에서 익명일 때 Dashboard 메뉴 숨김
5) Private routes SEO 차단(noindex + robots disallow)

### Out of Scope
- DB 분리(/public vs /private)
- 다중 사용자/권한 레벨
- 고급 보안(감사로그, 디바이스 관리, 2FA 등)
- 자동 포트폴리오 동기화/공개 포트폴리오 분리

## 3. Definitions

### Public Routes (Anonymous allowed)
- `/judgment/**`
- `/archive/**`
- `/login` (로그인 진입)
- 정적 리소스(`/assets/**`, `/favicon.ico` 등)

### Private Routes (Auth required)
- `/dashboard/**`
- `/granaries/**`
- `/snapshots/**`
- `/accounts/**`
- 기타 실자산/가족/아이들 자산이 노출될 수 있는 경로 전부

### Session
- Worker가 발급하는 **HttpOnly 쿠키** 기반 세션
- 세션 만료: 기본 30일(또는 7일) 권장
- Cookie 옵션: `HttpOnly`, `SameSite=Lax`, `Secure(프로덕션)`, `Path=/`

## 4. Architecture (MVP)

### Login Flow
1) 프론트 `/login`에서 Google Identity Services(GIS)로 로그인
2) 프론트는 `credential` (Google ID Token)을 수신
3) `POST /auth/google`로 `{ credential, next }` 전송
4) Worker는 토큰 검증 후:
   - `email_verified === true`
   - `aud === GOOGLE_CLIENT_ID`
   - `email === ALLOWED_EMAIL` (또는 `sub` 고정)
5) 성공 시 세션 생성 + **Set-Cookie**로 세션 쿠키 발급
6) `next` 경로로 리다이렉트

### Logout Flow
- `POST /auth/logout`
- 세션 쿠키 삭제 후 `/judgment` 또는 `/login`으로 이동

### Token Verification Strategy (MVP)
- Worker에서 Google ID Token을 검증
- 구현 단순화를 위해 아래 중 하나 선택:

A) **Google tokeninfo endpoint**로 검증 (가장 간편)
- `https://oauth2.googleapis.com/tokeninfo?id_token=...`

B) JWT 서명 검증 (고급, Phase 2)
- Google JWKs fetch + jose 검증

MVP는 A로 시작한다.

## 5. Environment Variables (Workers)
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `ALLOWED_EMAIL`: 허용할 내 Google 이메일 1개
- `SESSION_SECRET`: 세션 서명용 비밀키(랜덤 32bytes+)

Optional (강화)
- `ALLOWED_SUB`: 허용할 Google account sub (최초 로그인 후 확보)

## 6. Implementation Plan

### Step 1) Google OAuth Client 준비
- [ ] Google Cloud Console에서 OAuth Client ID 생성 (Web)
- [ ] Authorized JS origins 등록
  - `http://localhost:5173`
  - `https://<production-domain>`
- [ ] Client ID를 `GOOGLE_CLIENT_ID`로 설정

**Deliverable**
- 설정값 정리 문서 `docs/auth-google.md` (Client ID, origins 목록)

### Step 2) Worker: Auth Endpoints 추가
- [ ] `POST /auth/google`
  - request body: `{ credential: string, next?: string }`
  - token 검증(tokeninfo 또는 jwt)
  - allowed email/sub 체크
  - 세션 생성 + `Set-Cookie`
  - 200 JSON 또는 302 redirect (구현 방식 통일)
- [ ] `POST /auth/logout`
  - 쿠키 만료 처리
  - 200 또는 302

**Acceptance**
- credential이 유효하고 허용 계정이면 세션 쿠키가 발급된다.
- 허용되지 않은 계정이면 401(일관된 에러) 반환.

### Step 3) Worker: Session Utilities 구현
- [ ] `createSession(payload)` → 서명된 세션 토큰 생성 (HMAC)
- [ ] `readSessionFromCookie(request)` → 쿠키 파싱 + 서명 검증 + 만료 확인
- [ ] `clearSessionCookie()` → 쿠키 삭제

**Acceptance**
- 위조/변조된 쿠키는 무조건 무효 처리된다.
- 만료된 세션은 무효 처리된다.

### Step 4) Route Guard 적용 (Private routes)
- [ ] Private path 목록 확정
- [ ] Worker fetch/router 레벨에서 private 접근 시:
  - 세션 없음 → `/login?next=<path>`로 302 리다이렉트
  - 세션 있음 → 정상 처리
- [ ] Public routes는 항상 허용

**Acceptance**
- 익명 사용자가 `/dashboard` 직접 입력 시 로그인 페이지로 이동한다.
- 로그인 후 `next`로 원래 페이지 복귀한다.

### Step 5) Frontend Login Page 교체 (API Secret 제거)
- [ ] `/login` UI를 “Google로 로그인” 버튼 기반으로 변경
- [ ] GIS 로드 및 로그인 성공 시 `credential` 수신
- [ ] `POST /auth/google` 호출 후 성공 처리(리다이렉트)
- [ ] 실패 메시지 표준화(“로그인에 실패했습니다.”)

**Acceptance**
- API Secret 입력 UI가 사라지고, Google 로그인으로만 인증 가능하다.

### Step 6) Navigation 메뉴 제어
- [ ] 클라이언트에서 `auth` 상태 판단(세션 존재 여부)
  - 간단 방식: `GET /auth/me` 같은 엔드포인트 추가 (선택)
  - 또는 서버 렌더/초기 props에서 auth 포함 (앱 구조에 맞춤)
- [ ] 익명: `Judgment`, `Public Archive`, `로그인`만 노출
- [ ] 로그인: `Dashboard` 포함 전체 메뉴 노출

**Acceptance**
- 익명 상태에서 Dashboard 메뉴가 렌더되지 않는다.

### Step 7) SEO Control
- [ ] `robots.txt`에서 private prefix disallow
  - `/dashboard`
  - `/granaries`
  - `/snapshots`
  - `/accounts`
- [ ] Private route 응답에 `X-Robots-Tag: noindex, nofollow` 헤더 추가

**Acceptance**
- private 페이지가 검색 엔진에 노출되지 않는다.

### Step 8) Tests (최소)
- [ ] 익명 → `/dashboard` 접근 → `/login` 리다이렉트 확인
- [ ] 로그인 성공 후 → `/dashboard` 접근 가능
- [ ] 허용되지 않은 계정 토큰 → 401 처리
- [ ] 로그아웃 후 → 다시 `/dashboard` 접근 시 `/login` 리다이렉트

**Acceptance**
- 핵심 시나리오가 재현 가능하며 regressions 방지

## 7. Deliverables Checklist
- [ ] `docs/auth-google.md` (설정 가이드)
- [ ] Worker: `/auth/google`, `/auth/logout` 구현
- [ ] Worker: 세션 유틸 + route guard
- [ ] Front: `/login` Google 로그인 UI로 교체
- [ ] Nav: 익명/로그인 메뉴 분기
- [ ] `robots.txt` + `X-Robots-Tag` 적용
- [ ] 최소 테스트 시나리오

## 8. Done Definition (Acceptance Criteria)
- 익명은 `Judgment`, `Public Archive`만 접근 가능
- private routes는 URL 직접 접근해도 차단된다(로그인 리다이렉트)
- 로그인은 Google OAuth로만 진행되며 **내 계정 1개만 허용**
- 세션은 HttpOnly 쿠키로 관리된다
- private routes는 검색 노출 차단된다

## 9. Phase 2 (Optional)
- tokeninfo 대신 JWT 서명 검증(jose)로 전환
- `ALLOWED_SUB` 고정으로 더 강한 계정 바인딩
- `/auth/me` 추가로 nav auth 판별 단순화
- rate limit / brute force 방어 강화