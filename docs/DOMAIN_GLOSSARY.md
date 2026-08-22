# Domain glossary

이 문서는 Gokkan Keeper에서 사용하는 도메인 언어의 기준입니다. 코드, API,
화면 문구, 문서를 작성할 때 아래의 정식 용어와 영문 식별자를 사용합니다.
과거 기획 문서의 표현이 이 문서와 다르면 현재 코드와 이 문서를 우선합니다.

## 핵심 언어

| 정식 용어 | 코드 식별자 | 정확한 의미 | 혼동하지 말 것 |
| --- | --- | --- | --- |
| 곶간 지기 | Gokkan Keeper | 서비스와 기록 철학의 브랜드명 | 도메인 객체 이름이 아님 |
| 곳간 | `Granary` | 하나의 목적과 기준 통화를 가진 자산 관리 단위 | 계좌, 포트폴리오, 보유 종목 |
| 스냅샷 | `Snapshot` | 특정 날짜의 한 곳간에 대한 수동 평가 기록 | 거래 내역, 실시간 시세 |
| 포지션 | `Position` | 종목·현금·ETF 등 하나의 보유 자산 기록 | 곳간 전체 금액, 매매 주문 |
| 판단일지 항목 | `JudgmentDiaryEntry` | 판단의 맥락·행동·회고를 기록한 공개 글 한 건 | 스냅샷, 주문 기록 |
| 공개 포트폴리오 | `PublicPortfolio` | `isPublic`인 포지션으로 계산한 익명 공개용 읽기 모델 | 사용자의 전체 곳간 또는 전체 포지션 |
| 공개 기록 | `/archive` | 공개 포트폴리오를 보여 주는 화면 이름 | 판단일지 목록 자체 |
| 트랙레코드 | 별도 모델 없음 | 공개 포트폴리오와 판단일지가 쌓여 형성하는 제품 개념 | 테이블이나 API 리소스 이름 |

브랜드에는 `곶간`을 쓰고, 자산 관리 단위에는 `곳간`을 쓴다. 코드의
`Granary`를 한국어로 설명할 때는 항상 “곳간”이라고 적는다.

## 객체 관계와 생명주기

```text
Granary (곳간)
  1 ── N Snapshot (시점별 곳간 평가)
  1 ── N Position (개별 보유 자산, 연결은 선택 가능)

PublicPortfolio
  = 공개 설정된 Position들의 파생 읽기 모델

JudgmentDiaryEntry
  = 독립된 공개 판단 기록; Granary/Snapshot의 하위 객체가 아님
```

- 스냅샷은 한 곳간에 반드시 속한다. 같은 곳간과 날짜의 조합은 하나뿐이다.
- 포지션의 `granaryId`는 선택 사항이다. 곳간이 삭제되면 포지션은 삭제되지
  않고 연결만 해제된다.
- 공개 포트폴리오는 저장된 별도 포트폴리오 객체가 아니다. 공개 포지션을
  조회 시점에 시세와 환율로 보강해 만든다.
- 곳간의 공개 관련 필드는 이전 버전 호환용이다. 현재 공개 포트폴리오의
  포함 여부는 포지션의 `isPublic`이 결정한다.

## 금액과 가격 필드

모든 금액은 별도 표기가 없으면 연결된 곳간의 `currency`를 따른다. 포지션이
곳간에 연결되지 않은 경우 시장/종목 정보로 통화를 추론할 수 있으므로,
통화를 임의로 확정하지 않는다.

### Snapshot

| 필드 | 의미 |
| --- | --- |
| `date` | 평가 기준일 (`YYYY-MM-DD`). 레코드 생성 시각이 아님 |
| `totalAmount` | 해당 기준일의 곳간 전체 평가금액 |
| `availableBalance` | 선택 입력인 현금성 예수금 |
| `profitLoss` | 선택 입력인 평가손익 금액. 수익은 양수, 손실은 음수 |
| `createdAt` | 스냅샷 레코드를 실제로 생성한 시각 |

신규 작성 화면은 `availableBalance + profitLoss`를 `totalAmount`의 편의상
초깃값으로 계산할 수 있지만, 이는 도메인 불변식이 아니다. 사용자가
`totalAmount`를 직접 입력할 수 있으므로 API나 집계 코드에서 세 값의 등식을
가정하면 안 된다.

### Position

| 필드 | 의미 |
| --- | --- |
| `quantity` | 보유 수량 |
| `avgCost` | 단위당 평균 취득가 |
| `currentValue` | 레거시 수동 값. 수량이 있으면 단가, 없으면 총 평가금액으로 해석 |
| `currentUnitPrice` | 외부 시세 또는 수동 값에서 정규화한 현재 단가 |
| `currentMarketValue` | 현재 단가와 수량으로 계산·보강한 총 평가금액 |
| `profitLoss` | 사용자가 저장한 평가손익 금액 |
| `profitLossPercent` | 사용자가 저장한 수익률(퍼센트 값, `0.5`는 0.5%) |
| `weightPercent` | 저장 호환 필드. 현재 공개 비중 계산의 우선 입력이 아님 |

평가금액이 필요하면 `getPositionMarketValue()`를 사용한다. 이 함수는
`currentMarketValue`를 우선하고, 없으면 `currentValue`와 `quantity`의 레거시
규칙을 적용한다. 새 코드에서 `currentValue`라는 이름만 보고 단가 또는 총액을
단정하지 않는다.

## 공개 포트폴리오 계산 용어

- `allocationPercent`: 공개 포지션 평가금액을 보고 통화(KRW) 기준으로 정규화한
  뒤 전체 공개 평가금액에서 차지하는 비율이다. 저장된 `weightPercent`를 그대로
  노출한 값이 아니다.
- `returnPercent`: 저장된 `profitLossPercent`를 우선하고, 없으면 현재 단가와
  `avgCost`로 추정한다.
- `isEstimatedReturn`: `returnPercent`가 저장값이 아니라 가격으로 계산됐음을
  나타낸다.
- `currentPriceSource`: `MANUAL`, `FSC_STOCK_PRICE_API`, `YAHOO_FINANCE` 중 현재
  가격의 출처다. 값과 함께 기준일 `currentPriceAsOf`도 보존한다.
- `PublicPortfolioWarning`: 가격·환율·수익률 입력 부족으로 결과가 불완전할 때
  반환하는 경고다. 오류처럼 전체 응답을 버리는 신호가 아니다.

## 판단일지 용어

- `action`: 당시 판단한 행동(`BUY`, `SELL`, `HOLD`, `REBALANCE`, `WATCH`). 실제
  주문 체결을 의미하지 않는다.
- `decision`: 무엇을 판단했는지 기록한 본문 필드다.
- `outcome`, `whatWasRight`, `whatWasWrong`, `lesson`, `nextAction`: 사후 회고
  필드이며 최초 판단과 구분한다.
- `assets`: 글에서 다루는 자산 참조다. `Position` 외래 키가 아니다.
- `positionChange`: 비중 변화에 대한 서술형 기록이다. 실제 `Position`을
  갱신하지 않는다.

## 명명 규칙

- DB 열은 `snake_case`, TypeScript와 JSON은 `camelCase`를 사용한다.
- HTTP 쓰기 입력에는 `CreateX`/`UpdateX`, 저장·응답 객체에는 `X`, 파생 읽기
  모델에는 목적을 드러내는 `XResponse`/`XEntry`를 사용한다.
- “공개”는 인증이 필요 없다는 뜻과 데이터 공개 설정이라는 두 의미가 있다.
  라우트에는 `anonymous/public route`, 데이터에는 `isPublic position`이라고
  구체적으로 적는다.
- `portfolio`, `archive`, `track record`를 새 코드의 동의어로 바꾸어 쓰지 않는다.
  각각 읽기 모델, 화면 경로, 제품 개념이라는 위 표의 의미를 따른다.
