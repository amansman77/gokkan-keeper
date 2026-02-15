# 📘 Judgment Diary SEO 확장 구조 설계

`judgment-diary-seo-structure.plan.md`

---

# 0️⃣ 전략 요약

판단일지 하나는 SEO가 약하다.

하지만:

* 전략별 모음
* Action별 모음
* 원칙 자동 추출 페이지
* 월간 리포트 페이지

이 만들어지면 SEO 자산이 된다.

---

# 1️⃣ URL 체계 설계

## 1.1 메인 허브

```
/judgment-diary
```

H1:

> 추세 투자자의 판단일지 – 시장을 대하는 태도 기록

설명 600~800자 추가.

---

## 1.2 개별 판단일지

```
/judgment-diary/{slug}
```

예:

```
/judgment-diary/cash-is-position
/judgment-diary/rebalance-before-euphoria
```

Slug는 제목 기반 kebab-case.

---

## 1.3 Action별 아카이브

```
/judgment-diary/action/buy
/judgment-diary/action/hold
/judgment-diary/action/watch
/judgment-diary/action/rebalance
/judgment-diary/action/sell
```

각 페이지 상단에 SEO용 설명 추가:

예:

> 매수(BUY) 판단 모음 – 추세 투자자의 매수 기준과 타이밍 기록

---

## 1.4 전략(Strategy)별 페이지

```
/judgment-diary/strategy/trend
/judgment-diary/strategy/cash-management
/judgment-diary/strategy/rebalancing
/judgment-diary/strategy/risk-control
```

이건 태그 기반 자동 생성.

각 전략 페이지에 800자 이상 설명 추가.

---

## 1.5 원칙 모음 페이지 (강력 SEO 페이지)

```
/judgment-diary/principles
```

H1:

> 내가 반복하는 투자 원칙 15가지

AI가 판단일지에서 반복 문장 추출.

이 페이지는 검색 유입 핵심.

---

## 1.6 월간 태도 리포트

```
/judgment-diary/reports/2026-02
/judgment-diary/reports/2026-03
```

예:

> 2026년 2월 투자 판단 리포트 – 매수보다 대기를 선택한 달

이건 SEO + 브랜딩 자산.

---

# 2️⃣ 내부 링크 구조

각 상세 페이지 하단에:

### 자동 표시

* 같은 Action 3개
* 같은 전략 3개
* 최신 판단 3개

체류 시간 증가.

---

# 3️⃣ 사이트맵 구조

sitemap.xml에 포함:

```
/judgment-diary
/judgment-diary/{slug}
/judgment-diary/action/*
/judgment-diary/strategy/*
/judgment-diary/principles
/judgment-diary/reports/*
```

---

# 4️⃣ SEO 콘텐츠 레벨 설계

## 레벨 1 – 원자

* 개별 판단일지

## 레벨 2 – 카테고리

* Action별
* 전략별

## 레벨 3 – 체계

* 원칙 페이지
* 월간 리포트

---

# 5️⃣ 메타 전략

## Title Template

```
{제목} | 추세 투자자의 판단일지
```

## Meta Description Template

```
{한 줄 판단}. 추세 투자자가 시장을 대하는 태도를 기록한 판단일지입니다.
```

---

# 6️⃣ 성장 루프 설계

판단일지 작성
→ 태그 자동 분석
→ 전략 페이지 갱신
→ 원칙 페이지 갱신
→ 월간 리포트 생성
→ SNS 공유 카드 생성

이게 자동으로 돌아야 Growth Artifact가 된다.

---

# 🔥 가장 중요한 페이지

SEO 관점에서 핵심은:

```
/judgment-diary/principles
```

이건 장기적으로 “책 목차”가 된다.

---

# 🧠 전략적 질문

호성,

판단일지를:

* 개인 기록 플랫폼으로 유지할 건가?
* “추세 투자자의 공개 실험실”로 브랜딩할 건가?

후자라면 URL에 “trend-investor” 같은 브랜드 키워드를 넣는 것도 고려 가능하다.
