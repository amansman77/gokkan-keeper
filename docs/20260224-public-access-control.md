# Gokkan Keeper Public/Private Access Control (MVP)

## 0. Goal
곶간지기를 “대중 공개 가능” 상태로 만든다.

- **익명(비로그인)**: `Judgment`, `Public Archive`만 접근 가능
- **로그인 사용자**: 기존 기능 전체(대시보드 포함) 접근 가능
- 익명이 `/dashboard` 같은 private URL을 직접 입력해도 **접근 불가**(UI 숨김만이 아니라 라우트 가드 포함)

> MVP 원칙: **구조 복잡화 금지** (DB 분리/동기화 등은 이번 범위 제외)

## 1. Scope

### In Scope
1) **Navigation 메뉴 제어**
- 익명: Dashboard 메뉴 미노출
- 로그인: Dashboard 메뉴 노출

2) **Route Guard (서버/미들웨어)**
- Private routes: 인증 없으면 `/login`으로 리다이렉트(또는 401)
- Public routes: 누구나 접근 가능

3) **Search Engine Control**
- Private routes: `noindex` 적용 + `robots.txt`에서 disallow
- Public routes: 인덱싱 허용(브랜드 목적)

4) **Public Page Safety Filter (뷰 레벨)**
- Public 화면에서 개인 자산(실잔고/곳간 금액/예수금 등) 노출될 수 있는 UI 컴포넌트/필드를 **렌더하지 않도록 방어**
- “Public Archive”는 트랙레코드 전략에 따라 수익률/Allocation 공개 가능(이미 설계된 UI 유지)

### Out of Scope (이번 계획에서 제외)
- DB 분리 (/public vs /private) 및 데이터 파이프라인
- 실계좌 자동 연동/동기화 고도화
- 권한 레벨(관리자/일반 사용자) 세분화
- 감사 로그/추적/세션 보안 고도화

## 2. Assumptions
- 앱에는 “로그인 상태”를 판단할 수 있는 방법이 이미 존재한다.
  - 예: cookie/session/JWT 등
- Public 페이지 경로가 이미 존재한다.
  - 예: `/judgment`, `/archive` 등
- Dashboard 및 개인 자산 관련 경로가 존재한다.
  - 예: `/dashboard`, `/granaries`, `/snapshots`, `/accounts` 등

> 구현 시 실제 라우트 목록은 코드에서 확인해 확정한다.

## 3. Definitions

### Public Routes (Anonymous allowed)
- `/` (홈이 public이면 허용, 아니면 `/judgment`로 리다이렉트)
- `/judgment/**`
- `/archive/**`
- `/login` (인증 진입)
- 정적 파일, 이미지, favicon 등

### Private Routes (Auth required)
- `/dashboard/**`
- `/granaries/**`
- `/snapshots/**`
- `/accounts/**`
- 기타 “실자산/가족/아이들 곳간” 정보가 노출되는 화면 전부

## 4. Implementation Plan

### Step 1) Route Inventory
- [ ] 라우트 목록 전수 조사
  - public 후보 / private 후보 분류
- [ ] 공개 대상 2개(`Judgment`, `Archive`)의 라우트 확정

**Deliverable**
- `docs/routes.md` (간단 목록으로만)

### Step 2) Auth Check Utility
- [ ] “로그인 여부”를 단일 함수로 통일
  - 예: `isAuthenticated(request)` or `getUserFromSession()`
- [ ] 클라이언트에서 사용할 경우 `useAuth()` 같은 hook/상태로 통일

**Acceptance**
- 서버/미들웨어에서 auth 판정 가능
- UI 렌더링에서도 auth 판정 가능

### Step 3) Route Guard (MVP 핵심)
- [ ] 미들웨어/서버 라우트 가드 구현
- [ ] private route 접근 시:
  - 로그인 X → `/login?next=<original_path>` 리다이렉트
  - 로그인 O → 정상 진행
- [ ] public route 접근은 항상 허용

**Acceptance**
- 익명 사용자가 `/dashboard` 직접 입력해도 대시보드가 보이지 않는다.

### Step 4) Navigation: Dashboard 메뉴 숨김
- [ ] Top nav / sidebar에서 `Dashboard` 메뉴 노출 조건을 `auth === true`로 제한
- [ ] 익명 상태에서는 `Judgment`, `Archive`만 보여준다.
- [ ] 로그인 상태에서는 기존 메뉴 전부 보여준다.

**Acceptance**
- 익명: Dashboard 메뉴가 아예 안 보인다.
- 로그인: 기존과 동일하게 보인다.

### Step 5) Public Safety Filter (뷰 레벨 방어)
목표: **Public 페이지에서 개인 자산 금액이 섞여 노출되는 사고를 방지**

- [ ] Public 전용 레이아웃(or guard flag) 정의
  - 예: `layout=public` or `isPublicView=true`
- [ ] Public 화면에서 다음 요소를 렌더 금지:
  - granary별 실제 금액
  - 예수금
  - 실제 계좌명/아이 이름 등 민감 메타(필요 시)
- [ ] Public Archive에 필요한 값(Allocation/Return/Thesis/Updated)은 유지

**Acceptance**
- Public 페이지 어디에서도 “실자산/가족자산/아이들 계좌 금액”이 노출되지 않는다.

### Step 6) SEO Control
- [ ] `robots.txt` 업데이트
  - disallow: private route prefix들
- [ ] private route response에 `noindex` 적용
  - header 또는 meta tag
- [ ] public pages는 인덱싱 허용

**Acceptance**
- `/dashboard` 등은 검색 노출 대상에서 제외된다.

### Step 7) Tests
- [ ] E2E 또는 최소 통합 테스트
  - 익명으로 private route 접근 시 `/login` 리다이렉트
  - 로그인 상태에서 private route 정상 접근
  - 익명 네비게이션에서 dashboard 메뉴 미노출
- [ ] 스냅샷/곳간 금액이 public 페이지에 나오지 않는지 스모크 테스트

**Acceptance**
- 위 시나리오가 자동/수동 테스트로 재현 가능

## 5. Rollout Plan
1) feature flag 없이 바로 적용 가능(범위 작음)
2) 배포 후 즉시 확인:
   - 익명으로 `/dashboard` 접근
   - robots/noindex 확인
   - public 화면에 개인 금액 노출 없는지 확인

Rollback
- 미들웨어/가드만 롤백하면 기존 동작으로 복귀 가능

## 6. Deliverables Checklist
- [ ] `docs/routes.md`
- [ ] route guard 구현(미들웨어/서버)
- [ ] nav 조건부 렌더링
- [ ] public safety filter
- [ ] `robots.txt` 업데이트 + noindex 처리
- [ ] 테스트(최소 3케이스)

## 7. Acceptance Criteria (Done Definition)
- 익명 사용자는 **Judgment / Public Archive**만 접근 가능
- 익명 사용자가 private URL 직접 접근해도 **로그인으로 리다이렉트(또는 401)**
- 익명 네비게이션에서 **Dashboard 메뉴가 보이지 않음**
- Public 페이지에서 **개인 자산/가족/아이들 곳간 금액이 노출되지 않음**
- Private routes는 `noindex` + robots disallow 적용됨

## 8. Notes
- “메뉴 숨김”만으로는 보안이 아니다. **반드시 route guard가 함께 있어야** 한다.
- 이번 계획은 구조를 심플하게 유지한다. 필요 시 Phase 2에서 DB 분리/공개 포트폴리오 분리로 확장한다.
```
