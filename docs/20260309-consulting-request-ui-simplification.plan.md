# Consulting Request UI Simplification

## Project
곶간지기 무료 구조 점검 요청 UI 단순화

## Goal
현재 `무료 구조 점검 요청` 폼의 진입 장벽을 낮춰, 회사 동료와 초기 사용자들이 **복잡한 자산 컨설팅 신청서**가 아니라 **쉽게 포트폴리오 점검을 요청하는 흐름**으로 인식하도록 개선한다.

핵심 목표는 다음과 같다.

1. 사용자가 `스샷 보내면 되나요?`라고 느낀 니즈를 그대로 수용한다.
2. 입력 항목을 최소화하여 요청 완료율을 높인다.
3. 초기에는 수동 분석 기반 컨설팅 요청 흐름을 빠르게 검증한다.
4. 추후 자동 포트폴리오 분석 기능으로 확장 가능한 구조를 남긴다.

## Background

### Current Problem
현재 UI는 다음 이유로 진입 장벽이 높다.

- `Portfolio Size Range`
- `Risk Tolerance`
- `Investment Horizon`
- `Discord Handle`

위 항목들은 초기 사용자에게 다음과 같은 부담을 준다.

- “제대로 써야 할 것 같다”
- “내가 뭘 써야 하는지 모르겠다”
- “그냥 포트폴리오 보여주고 질문하면 되는 거 아닌가?”
- “복잡해서 요청을 못하겠다”

실제 사용자 반응도 이를 뒷받침한다.

- 한 동료: `제 증권 목록을 스샷찍어서 보내주면 되는건가요?`
- 다른 동료: `컨설팅을 받고 싶은데 복잡해서 요청을 못하겠네요.`

즉, 현재 문제는 기능 부족보다 **요청 UI의 복잡성**이다.

## Product Hypothesis
다음 가설을 검증한다.

> 사용자는 전문적인 설문형 입력보다, `포트폴리오 스크린샷 업로드 + 현재 고민 한 줄 + 연락처` 형태의 매우 간단한 요청 방식을 선호한다.

이 가설이 맞다면:

- 요청 수가 증가한다.
- 사용자 문의 품질이 오히려 좋아진다.
- 사용자는 `컨설팅 신청`보다 `구조 점검 요청`으로 더 자연스럽게 반응한다.

## Target User
1. 주변 동료
2. 초기 공개 포트폴리오 방문자
3. 포트폴리오는 있지만 구조적 판단 기준은 없는 개인 투자자
4. 빠르게 의견을 받고 싶은 사용자

## UX Direction

### Before
전문 컨설팅 신청서 같은 느낌

### After
`내 포트폴리오를 보여주고 현재 고민을 적으면, 1회 무료 구조 점검을 받을 수 있다`는 느낌

### Desired User Flow
1. 페이지 진입
2. 설명 문구 확인
3. 포트폴리오 스크린샷 업로드
4. 현재 고민 한 줄 입력
5. 이메일 입력
6. 요청 제출 완료

## Required UI Changes

### Section Title
기존:
- 무료 구조 점검 요청

유지 가능. 다만 부제는 더 쉽게 바꾼다.

### Subtitle
기존:
- 중장기 포트폴리오 구조 중심으로 무료 1회 점검을 제공합니다.

변경안:
- 포트폴리오 스크린샷과 현재 고민을 보내주시면 무료 1회 구조 점검을 제공합니다.

대체안:
- 지금 가진 포트폴리오가 괜찮은지 궁금하신가요? 스크린샷과 고민을 보내주시면 무료로 구조를 점검해드립니다.

### Input Fields
#### Keep
- Email
- Current Concern

#### Add
- Portfolio Screenshot Upload (required or strongly encouraged)

#### Remove
- Portfolio Size Range (optional)
- Risk Tolerance
- Investment Horizon
- Discord Handle (optional)

### Recommended Final Fields
1. `Email` (required)
2. `Portfolio Screenshot` (required)
3. `Current Concern` (required)
4. `Additional Note` (optional, only if needed later)

## Recommended Form Copy

### Heading
무료 포트폴리오 구조 점검 요청

### Description
포트폴리오 스크린샷과 현재 고민을 보내주시면  
무료 1회 구조 점검을 제공합니다.

### Email Label
이메일

Placeholder:
- 예: name@example.com

### Screenshot Label
포트폴리오 스크린샷

Helper text:
- 보유 종목과 비중이 보이도록 캡처해 주세요.
- 민감한 정보는 가려도 됩니다.

Upload CTA:
- 이미지 업로드
- 또는 스크린샷 첨부

### Concern Label
현재 고민

Placeholder examples:
- 지금 비중이 적절한지 모르겠습니다.
- 전쟁/급락장에서 버텨도 되는 구조인지 궁금합니다.
- 종목이 너무 많은지 알고 싶습니다.
- 현금 비중을 늘려야 할지 고민입니다.

### Submit Button
무료 구조 점검 요청 보내기

Alternative:
- 포트폴리오 점검 요청하기

### Success Message
요청이 접수되었습니다.  
검토 후 이메일로 답변드리겠습니다.

## Functional Requirements

### 1. File Upload Support
- 이미지 업로드 지원 (`png`, `jpg`, `jpeg`, `webp`)
- 모바일 업로드 친화적 UI
- 파일 크기 제한 설정 (예: 10MB 이하)
- 업로드 실패 시 오류 메시지 제공

### 2. Form Validation
- 이메일 필수
- 현재 고민 필수
- 스크린샷 필수
- 잘못된 이메일 형식 검증
- 허용되지 않는 파일 형식 차단

### 3. Admin/Review Workflow
초기에는 수동 운영을 전제로 한다.

검토자가 확인할 수 있어야 하는 것:
- 이메일
- 업로드 이미지
- 사용자의 고민
- 접수 시각
- 상태값

## Non-Goals (for this iteration)
이번 단계에서 하지 않을 것:

1. OCR 기반 자동 종목 인식
2. 증권사 API 연동
3. 자동 비중 계산
4. 자동 리밸런싱 추천
5. 장기 위험성 스코어 자동화

이번 목표는 어디까지나 **요청 전환율 개선**이다.

## Implementation Strategy

### Phase 1 — Fast UI Simplification
목표: 빠르게 사용자 마찰 제거

작업:
- 기존 폼 필드 제거
- 스크린샷 업로드 필드 추가
- 설명 문구 개선
- 모바일 UI 정리
- 제출 후 성공 메시지 정리

### Phase 2 — Internal Ops Readiness
목표: 실제 요청 처리 가능 상태 확보

작업:
- 제출 데이터 저장
- 업로드 이미지 접근 가능하게 정리
- 관리자 확인용 목록
- 상태값 추가

## Detailed Task Breakdown

### Task A. Copy Rewrite
- [ ] 섹션 제목/부제 문구 수정
- [ ] 필드 라벨 한글 중심으로 정리
- [ ] placeholder 문구 사용자 언어로 변경
- [ ] helper text 추가

### Task B. Form Simplification
- [ ] `Portfolio Size Range` 제거
- [ ] `Risk Tolerance` 제거
- [ ] `Investment Horizon` 제거
- [ ] `Discord Handle` 제거
- [ ] `Portfolio Screenshot Upload` 추가
- [ ] 필수값 재설정

### Task C. Mobile UX Optimization
- [ ] iPhone 화면 기준 여백 조정
- [ ] 업로드 영역 터치 쉽게 개선
- [ ] textarea 가독성 개선
- [ ] 버튼 문구와 크기 개선

### Task D. Backend/Data Handling
- [ ] 파일 업로드 처리
- [ ] 제출 payload 업데이트
- [ ] submission model 수정
- [ ] 저장 실패/업로드 실패 예외 처리
- [ ] 관리자 확인 가능한 형태로 저장 (Discord)

### Task E. QA
- [ ] 모바일 Safari 테스트
- [ ] 데스크탑 테스트
- [ ] 이미지 업로드 테스트
- [ ] 필수값 validation 테스트
- [ ] 제출 완료 후 확인 테스트

## Data Model

### Submission
```ts
type ConsultingRequest = {
  id: string
  email: string
  concern: string
  screenshotUrl: string
  status: 'new' | 'reviewing' | 'replied'
  sourcePage?: string
  createdAt: string
  updatedAt: string
}
```

## Acceptance Criteria

### Product Acceptance
1. 사용자는 1분 이내에 요청을 제출할 수 있다.
2. 사용자는 별도 설명 없이도 `스크린샷 올리고 고민 적으면 되는구나`를 이해할 수 있다.
3. 기존보다 폼이 덜 복잡하게 느껴진다.
4. 동료 테스트에서 `이제는 요청할 수 있겠다` 반응을 얻는다.

### Functional Acceptance
1. 이메일, 고민, 스크린샷이 정상 저장된다.
2. 모바일에서 업로드가 정상 작동한다.
3. 제출 오류 시 사용자에게 이해 가능한 메시지가 보인다.
4. 운영자가 요청 내용을 확인할 수 있다.

## User Test Plan
최소 3명에게 아래를 요청한다.

### Test Prompt
- 이 화면을 보고 무엇을 해야 하는지 바로 이해되는지
- 제출까지 몇 초/몇 분 걸리는지
- 어떤 부분이 아직도 부담스러운지
- 스크린샷 업로드 방식이 자연스러운지

### Success Signal
다음 말이 나오면 성공 신호다.

- “아 그냥 스샷 올리면 되는 거네요.”
- “이제는 요청할 수 있겠어요.”
- “복잡하지 않네요.”

## Risks
1. 스크린샷 품질이 너무 낮을 수 있음
2. 민감 정보 노출 우려
3. 운영자가 수동 처리할 시간이 부족할 수 있음
4. 요청은 많아지지만 실제 분석 응답 속도가 느려질 수 있음

### Mitigations
- 업로드 helper text 제공
- 민감 정보 가림 안내
- 초기에는 `무료 1회` 명확화
- 운영 가능한 범위 내에서 수동 처리

## Future Opportunities
이 흐름이 검증되면 다음으로 확장 가능하다.

1. OCR 기반 종목 인식
2. 공개 포트폴리오 자동 생성
3. 구조 진단 리포트 자동 초안
4. `왜 버텼는가` 같은 판단 기준 템플릿화
5. 개인별 곶간 분류 및 비중 시각화

## Final Intent
이번 작업의 본질은 폼 디자인 수정이 아니라,
**곶간지기의 초기 사용자 니즈를 가장 낮은 마찰로 받아들이는 것**이다.

사용자는 전문 투자 설문을 작성하고 싶은 것이 아니라,
**내 포트폴리오를 보여주고 지금 고민을 묻고 싶어 한다.**

따라서 이번 개선의 핵심은 다음 한 줄로 요약된다.

> 복잡한 컨설팅 신청서를 없애고, 스크린샷 기반의 쉬운 구조 점검 요청 흐름으로 바꾼다.
