# Feature: Intro / Landing Page (소개 & 메인 랜딩 통합)

## 1. Objective

곶간지기의 소개 페이지를 메인 랜딩 페이지로 전환한다.

목표:

1. 방문자의 공감을 유도한다 (불안 → 구조 문제 인식)
2. 곶간지기의 중장기 구조 관리 방식을 명확히 전달한다
3. 공개 트랙레코드 페이지로 자연스럽게 연결한다
4. 두 가지 전환을 만든다:
   - 나의 트랙레코드 생성 (로그인 유도)
   - 무료 구조 점검 요청 (컨설팅 리드 확보)

## 2. Route & Navigation

### 2.1 Routes

- `/` → Intro / Landing Page
- `/archive` → Public Judgment Archive (기존 유지)
- `/login` → Login
- `/consulting` → 구조 점검 요청 (신규 생성)

### 2.2 Header 변경

Primary Button:
- "나의 트랙레코드 만들기"

Secondary Link:
- "공개 기록 보기"

기존 "로그인" 버튼은 제거.
비로그인 상태에서 기록 생성 클릭 시 `/login`으로 리다이렉트.

## 3. Page Structure

총 5개 섹션으로 구성한다.

### Section 1: Hero

#### Copy

Title:
투자에서 가장 어려운 건  
종목 선택이 아닙니다.

Subtitle:
흔들리지 않는 구조입니다.

Description:
시장에 따라 사고 팔지만,  
구조 없이 버티는 투자는 오래가지 않습니다.

곶간지기는  
중장기 포트폴리오를 유지하며  
시장 변동 속에서도 방향을 관리합니다.

#### CTA

Primary:
[ 공개 포트폴리오 보기 ] → `/archive`

Secondary:
[ 무료 구조 점검 받기 ] → `/consulting`

### Section 2: 공감 블록

Title:
이런 경험 있으신가요?

Bullets:
- 시장이 오르면 뒤늦게 따라 붙고
- 떨어지면 불안해서 정리하고
- 1년이 지나도 계좌는 제자리

Closing:
이건 실력이 부족해서가 아닙니다.  
구조가 없기 때문입니다.

### Section 3: 곶간지기의 방식

Title:
곶간지기의 방식

Bullets:
- 중장기 기준을 먼저 설정합니다
- 비중을 관리합니다
- 결과를 공개 기록합니다

Closing:
예측하지 않습니다.  
구조를 유지합니다.

### Section 4: 증거 (트랙레코드 연결)

Title:
말이 아니라 기록입니다.

Display:
- 공개 판단 수 (API 연동)
- 평균 가중 수익률
- 스냅샷 기반 기록 안내 문구

CTA:
[ 전체 기록 확인하기 ] → `/archive`

### Section 5: 전환 블록 (Dual CTA)

#### Block A: Self Record

Title:
직접 기록해보세요

Description:
계좌 연결 없이  
판단과 비중만 기록할 수 있습니다.

Button:
[ 나의 트랙레코드 만들기 ]

Logic:
- 비로그인 → `/login`
- 로그인 → `/dashboard`

#### Block B: Consulting

Title:
구조 설계가 필요하다면

Description:
곶간지기 매니저가  
포트폴리오 구조를 점검해드립니다.

- 무료 1회
- 중장기 중심
- 단기 매매 조언 없음

Button:
[ 무료 구조 점검 요청 ] → `/consulting`

### 4. Design Requirements

Tone:
- 차분함
- 과장 없음
- 금융 광고 느낌 제거

Layout:
- Max width: 960px
- Section padding: 80px top/bottom
- 명확한 수직 리듬 유지

Color:
- Primary: Deep Navy
- Accent: Dark Green
- Section Divider: Light Gray

### 5. Components

Required Components:

- HeroSection
- EmpathySection
- MethodSection
- TrackRecordSummary
- DualCTASection
- PrimaryButton
- SecondaryButton
- StatCard
- BulletList

### 6. Data Integration

TrackRecordSummary must:

- Fetch:
  - public_position_count
  - weighted_average_return
  - snapshot_reference_text
- Show loading state
- Show fallback UI if API fails

### 7. Conversion Flow

Flow A:
Landing → Archive → 관심 → 구조 점검 요청

Flow B:
Landing → 공감 → 무료 구조 점검 클릭

Flow C:
Landing → 나의 트랙레코드 만들기 → 로그인 → 기록 시작

### 8. Acceptance Criteria

- 랜딩이 문제-해결 구조로 읽힌다
- 수익률이 자랑처럼 보이지 않는다
- 로그인 대신 행동 버튼이 있다
- 상담 전환 버튼이 명확하다
- 모바일 가독성 확보

### 9. Success Metrics

- Archive 클릭률
- 트랙레코드 생성 클릭률
- 구조 점검 요청 전환율
- 평균 체류 시간
