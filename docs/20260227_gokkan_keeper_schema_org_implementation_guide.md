# Gokkan Keeper — schema.org 적용 가이드

## 🎯 목표

판단일지 상세 페이지에 `Article` 구조화 데이터(JSON-LD)를 적용한다.

Google이 다음을 명확히 이해하도록 한다:

* 이 페이지는 글이다
* 작성자가 있다
* 날짜가 있다
* 제목과 요약이 있다
* 사이트 브랜드가 있다

## 1️⃣ 적용 대상 페이지

### 적용 필수

* `/judgment-diary/:slug`

### 선택 적용

* 홈 → WebSite
* archive → CollectionPage

우선은 **Article부터 적용**.

## 2️⃣ Article 구조 설계

### 기본 구조

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "제목",
  "description": "요약",
  "author": {
    "@type": "Person",
    "name": "Hosung Hwang"
  },
  "datePublished": "2026-02-26",
  "dateModified": "2026-02-26",
  "publisher": {
    "@type": "Organization",
    "name": "Gokkan Keeper",
    "logo": {
      "@type": "ImageObject",
      "url": "https://도메인/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://도메인/judgment-diary/slug"
  }
}
```

## 3️⃣ React 적용 방법 (JSON-LD 삽입)

### 3.1 적용 파일

```id="zuj3xg"
apps/web/src/pages/JudgmentDiaryDetail.tsx
```

### 3.2 구현 예시

```tsx id="ptd93l"
import { Helmet } from "react-helmet-async";

const schemaData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: diary.title,
  description: diary.summary,
  author: {
    "@type": "Person",
    name: "Hosung Hwang"
  },
  datePublished: diary.createdAt,
  dateModified: diary.updatedAt || diary.createdAt,
  publisher: {
    "@type": "Organization",
    name: "Gokkan Keeper"
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `https://도메인/judgment-diary/${diary.slug}`
  }
};

<Helmet>
  <script type="application/ld+json">
    {JSON.stringify(schemaData)}
  </script>
</Helmet>
```

## 4️⃣ 필드 매핑 기준

| schema 필드     | 데이터 소스          |
| ------------- | --------------- |
| headline      | diary.title     |
| description   | diary.summary   |
| datePublished | diary.createdAt |
| dateModified  | diary.updatedAt |
| author        | 고정값             |
| publisher     | 고정값             |
