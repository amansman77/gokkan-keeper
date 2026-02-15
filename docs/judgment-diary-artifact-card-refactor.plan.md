# judgment-diary-artifact-card-refactor.plan.md

## 0. 목표
판단일지 리스트 카드를 “기록 카드”에서 “투자 태도 아티팩트 카드”로 전환한다.

### 성공 기준
- 제목이 시각적으로 가장 강하다.
- 한 줄 판단이 콘텐츠의 중심이다.
- Action은 보조 정보로만 보인다.
- 카드 내 텍스트 블록은 최대 2개.
- 3초 안에 읽히는 구조.

## 1. 데이터 전제
카드에 필요한 데이터:

```ts
type JudgmentEntry = {
  id: string
  title: string
  summary: string  // 한 줄 판단
  action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH' | 'REBALANCE'
  createdAt: string
}
```

⚠ summary는 반드시 1~2문장 이내. (120자 초과 시 잘라서 표시)

## 2. 카드 구조 변경
### ❌ 기존 구조 (제거)
- Action을 상단 좌측에 큰 텍스트로 표시
- summary를 일반 본문처럼 렌더링
- 좌측 인용선 스타일 제거
- 메타 정보 다중 노출 제거

### ✅ 새로운 구조
```
[제목]                        [Action Badge]

[한 줄 판단]
```

선택적으로:
- createdAt은 카드 하단 작은 회색 텍스트

## 3. 시각적 위계 정의
### 3.1 제목 스타일
- font-size: 22px
- font-weight: 700
- line-height: 1.4
- margin-bottom: 12px

### 3.2 한 줄 판단 스타일
- font-size: 17px (1줄이면 18px)
- font-weight: 400~500
- line-height: 1.8
- color: #444
- padding: 20~24px
- background: #f8f9fb
- border-radius: 12px
- box-shadow 제거
- border 제거

### 3.3 Action 배지
- font-size: 12px
- padding: 4px 10px
- border-radius: 999px
- font-weight: 600
- position: 제목 오른쪽 정렬

색상 맵:
| Action    | Background | Text    |
| --------- | ---------- | ------- |
| BUY       | #e6f7ee    | #1e7f4f |
| SELL      | #fdecea    | #b42318 |
| HOLD      | #f2f4f7    | #667085 |
| WATCH     | #e7f0ff    | #175cd3 |
| REBALANCE | #f3e8ff    | #7a5af8 |

## 4. 레이아웃 규칙
- max-width: 720px
- margin: 24px auto
- padding: 32px
- border-radius: 16px
- background: #ffffff
- box-shadow: 0 4px 12px rgba(0,0,0,0.05)

카드 간 간격: 24px

제목과 한 줄 판단 간격:
- margin-bottom: 16~20px

## 5. 불필요 요소 제거
Agent는 다음 요소가 렌더링되지 않도록 수정:
- Action 텍스트 별도 줄 표시
- 반복 summary 표시
- 구분선(divider)
- 과도한 메타 정보
- “기록 느낌” UI 요소

## 6. UX 규칙
Agent는 다음을 보장해야 한다:
- 제목이 카드에서 가장 먼저 시각적으로 읽힘
- summary가 시각적으로 강조 블록으로 보임
- Action은 보조 정보임을 시각적으로 명확히 함
- 카드 텍스트 블록은 최대 2개

## 7. 확장 고려
이 구조는 향후 다음 기능 확장을 고려한다:
- 태그 필터
- “내 투자 원칙 모음” 자동 추출
- SNS 공유 카드 변환 (OG 이미지 생성)
- 월간 태도 아카이브

따라서 구조는 단순하게 유지.

## 8. Acceptance Criteria
Agent는 다음 조건을 만족해야 완료로 판단:
- [ ] Action이 제목보다 시각적으로 약함
- [ ] 제목이 가장 큰 텍스트
- [ ] summary가 배경 강조 블록 형태
- [ ] 카드 내 텍스트 블록 2개
- [ ] 모바일 가독성 16px 이상 유지
- [ ] 기존 데이터 모델 변경 없음

## 9. 철학적 기준 (Non-functional)
판단일지는:
- 투자 관리 도구가 아니다.
- 매매 기록장이 아니다.
- 투자 태도를 축적하는 아카이브다.

UI는 이 철학을 전달해야 한다.
