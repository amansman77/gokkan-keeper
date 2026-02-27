# Gokkan Keeper — Schema & Meta Quality Upgrade Plan

## 🗓 Date

2026-02-26

## 🎯 Objective

1. meta description 과도 길이 문제 해결
2. JSON-LD description 정제
3. Article 스키마 완성형 필드 추가
4. 검색 스니펫 품질 개선
5. CTR 개선 기반 확보

## 1️⃣ 문제 정의

현재 상태:

* meta description = 본문 전체
* JSON-LD description = 본문 전체
* 마크다운 헤더(`##`, `-`, `1.` 등) 포함
* 길이 과도 (Google이 무시할 확률 상승)

## 2️⃣ 개선 전략

### 핵심 원칙

| 필드                 | 전략                   |
| ------------------ | -------------------- |
| meta description   | 120~200자 이내          |
| schema description | meta description과 동일 |
| articleBody        | 본문 전체                |
| markdown 제거        | 필수                   |
| 공백 정리              | 필수                   |

## 3️⃣ 구현 작업

### 3.1 description 정제 유틸 추가

#### 작업 파일

```txt
apps/web/src/lib/seo.ts
```

### 3.1.1 stripMarkdown 함수 추가

```ts
function stripMarkdown(text: string): string {
  return text
    .replace(/#+\s/g, "")        // 헤더 제거
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold 제거
    .replace(/`(.*?)`/g, "$1")   // 코드 제거
    .replace(/[-*]\s/g, "")      // 리스트 제거
    .replace(/\d+\.\s/g, "")     // 번호 리스트 제거
    .replace(/\n+/g, " ")        // 줄바꿈 제거
    .trim();
}
```

### 3.1.2 truncate 함수 추가

```ts
function truncate(text: string, maxLength = 180): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}
```

### 3.1.3 sanitizeDescription 함수

```ts
export function sanitizeDescription(raw: string): string {
  const clean = stripMarkdown(raw);
  return truncate(clean, 180);
}
```

## 4️⃣ meta description 개선

### 4.1 적용 위치

`setSeo()` 내부

#### 변경 전

```ts
description: entry.summary
```

#### 변경 후

```ts
description: sanitizeDescription(entry.summary)
```

## 5️⃣ Article 스키마 완성형 업그레이드

### 5.1 적용 파일

```txt
apps/web/src/pages/JudgmentDiaryDetail.tsx
```

### 5.2 완성형 schemaData 구조

```ts
const cleanDescription = sanitizeDescription(entry.summary);

const schemaData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: entry.title,
  description: cleanDescription,
  articleBody: stripMarkdown(entry.content || entry.summary),
  author: {
    "@type": "Person",
    name: "Hosung Hwang"
  },
  datePublished: entry.createdAt,
  dateModified: entry.updatedAt || entry.createdAt,
  articleSection: "Judgment Diary",
  inLanguage: "ko-KR",
  publisher: {
    "@type": "Organization",
    name: "Gokkan Keeper"
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${SITE_BASE_URL}${location.pathname}`
  }
};
```
