---
id: SPEC-IMPROVE-EVENT-DESC-001
version: 1.0.0
scope: local
status: active
depends: [SPEC-KNUE-RSS-CALENDAR-001]
last-updated: 2025-10-28
owner: codex
---

# 일정 설명 내용 개선 사양

## Intent
Google Calendar에 추가되는 이벤트의 설명 내용을 개선하여 사용성을 향상시킨다.
- 원본 HTML 본문 제거로 간결함 증대
- 링크 중복 제거로 관련 자료 효율성 향상
- 이미지 파일 첨부 기능으로 즉시 열람 가능

## Scope

### In
- `buildDescription()` 함수 로직 수정
- `createEvent()` 함수의 attachments 처리 추가
- 링크 중복 제거 유틸리티 함수 추가

### Out
- RSS 파싱 로직 변경
- AI 요약 생성 로직 변경
- 이벤트 기본 정보 추출 로직 변경

---

## Behaviour (GWT)

### AC-1: 링크 중복 제거
**GIVEN** AI가 추출한 링크와 원문 링크가 있을 때
**WHEN** `buildDescription()` 호출
**THEN** 중복된 링크는 1개만 유지되고, 원문 링크를 우선순위로 함

```typescript
// 예시
input: {
  item.link: "https://example.com/notice/123",
  summary.links: [
    "https://example.com/notice/123",  // 중복
    "https://www.forms.google.com/d/...",
    "https://www.youtube.com/watch?v=..."
  ]
}

output: "관련 링크:\n- https://example.com/notice/123\n- https://www.forms.google.com/d/...\n- https://www.youtube.com/watch?v=..."
```

### AC-2: 원본 HTML 본문 제거
**GIVEN** RSS item에 HTML 본문이 있을 때
**WHEN** `buildDescription()` 호출
**THEN** "원문 본문:" 섹션이 제거되어 더 간결한 설명이 생성됨

```typescript
// 변경 전
description = "요약\n\n주요 포인트\n\n관련 링크\n\n첨부파일: file.pdf\n\n원문 본문:\n<html>...</html>"

// 변경 후
description = "요약\n\n주요 포인트\n\n관련 링크"
```

### AC-3: 첨부파일 정보 본문 제거
**GIVEN** RSS item에 첨부파일 정보가 있을 때
**WHEN** `buildDescription()` 호출
**THEN** "첨부파일:" 섹션이 제거됨 (파일은 Google Calendar attachments로 첨부)

```typescript
// 변경 전
description = "요약\n\n...관련 링크\n\n첨부파일: notice.pdf"

// 변경 후
description = "요약\n\n...관련 링크"
// event.attachments[]에 파일이 첨부됨
```

### AC-4: 이미지 파일 자동 첨부
**GIVEN** 첨부파일이 이미지(jpg, jpeg, png, gif, bmp, webp)일 때
**WHEN** `createEvent()` 호출
**THEN** 이미지를 Google Calendar 첨부파일로 추가하여 캘린더에서 직접 열람 가능

```typescript
// 예시
attachment: {
  filename: "poster.jpg",
  url: "https://example.com/download/123",
  preview: "https://example.com/preview?atchmnflNo=456"
}

// createEvent() 내부에서
event.attachments = [
  {
    fileUrl: "https://example.com/download/123",
    mimeType: "image/jpeg",
    title: "poster.jpg"
  }
]
```

### AC-5: 비이미지 파일 처리
**GIVEN** 첨부파일이 이미지가 아닐 때(PDF, HWP, DOC 등)
**WHEN** `createEvent()` 호출
**THEN** Google Calendar 첨부파일로 추가 (Google이 지원하는 경우) 또는 스킵

---

## Examples (Tabular)

| Case | Input | Expected Output |
|------|-------|-----------------|
| 링크 중복 | links=["A", "A", "B"], item.link="A" | "A\nB" (원문 A 우선) |
| HTML 본문 제거 | htmlDescription="<p>내용</p>" | 본문 없음 |
| PDF 첨부 | filename="file.pdf" | attachments[]에 추가 |
| JPG 첨부 | filename="image.jpg" | attachments[]에 추가 |
| 첨부 없음 | attachment=undefined | attachments=[] |

---

## API (Summary)

### 변경 대상 함수

#### 1. `buildDescription()`
**위치:** `src/index.ts:99-131`

**변경 사항:**
- 링크 중복 제거 로직 추가
- HTML 본문 섹션 제거
- 첨부파일 정보 섹션 제거

**Signature:**
```typescript
function buildDescription(
  item: RssItem,
  summary: AiSummary,
  htmlDescription: string,
  attachmentText: string  // ← 더 이상 사용 안 함
): string
```

#### 2. `createEvent()`
**위치:** `src/lib/calendar.ts`

**변경 사항:**
- `attachments` 필드 추가 처리

**Signature:**
```typescript
async function createEvent(
  env: CalendarEnv,
  token: string,
  input: CalendarEventInput,
  meta: ProcessedRecord,
  descriptionExtras?: string,
  attachments?: GoogleCalendarAttachment[]  // ← NEW
): Promise<GoogleCalendarEvent>
```

### 새로운 유틸리티 함수

#### `deduplicateLinks()`
```typescript
/**
 * 링크 배열에서 중복을 제거하고 정렬
 * 원문 링크를 우선순위로 배치
 */
function deduplicateLinks(
  primaryLink: string | undefined,
  secondaryLinks: string[]
): string[]
```

#### `isImageFile()`
```typescript
/**
 * 파일명으로부터 이미지 여부 판단
 */
function isImageFile(filename: string | undefined): boolean
```

#### `buildAttachmentFromFile()`
```typescript
/**
 * RssItem의 첨부파일 정보를 Google Calendar attachment로 변환
 */
function buildAttachmentFromFile(
  item: RssItem
): GoogleCalendarAttachment | undefined
```

---

## Data & State

### 수정 타입

**RssItem** (기존, 변경 없음)
```typescript
export interface RssItem {
  attachment?: {
    filename?: string;
    url?: string;
    preview?: string;
  };
}
```

**GoogleCalendarAttachment** (신규)
```typescript
export interface GoogleCalendarAttachment {
  fileUrl: string;
  mimeType: string;
  title: string;
}
```

**Google Calendar Event Body** (API 레벨)
```typescript
{
  "attachments": [
    {
      "fileUrl": "https://...",
      "mimeType": "image/jpeg",
      "title": "poster.jpg"
    }
  ]
}
```

---

## Tracing

**Spec ID:** SPEC-IMPROVE-EVENT-DESC-001

**Trace To:**
- Test: `test/index.test.ts` (buildDescription 테스트)
- Test: `test/lib/calendar.test.ts` (createEvent 테스트)
- Impl: `src/index.ts` (buildDescription, deduplicateLinks, isImageFile)
- Impl: `src/lib/calendar.ts` (createEvent, buildAttachmentFromFile)
- Impl: `src/types.ts` (GoogleCalendarAttachment 타입 추가)

---

## Implementation Notes

### 1. 링크 중복 제거 알고리즘
- URL 정규화 (scheme + host + pathname 기준)
- Set 사용하여 O(n) 시간복잡도 유지
- 쿼리 파라미터는 무시 (동일 페이지 링크로 간주)

### 2. 이미지 파일 판단
- MIME 타입 기반 (Content-Type)
- 확장자 기반 fallback (filename에서 추출)

### 3. Google Calendar Attachments API
- Cloudflare Workers 무료 플랜에서 지원
- fileUrl은 공개 URL이어야 함 (다운로드 가능)
- 최대 5개 첨부파일까지 지원

### 4. 롤백 전략
- 기존 코드와 신규 기능을 분리
- attachments는 선택적 필드로 처리
- 이미지 첨부 실패해도 이벤트는 생성되도록 방어 로직 추가

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Google Calendar API 변경 | API 버전 고정, 공식 문서 참고 |
| 첨부파일 URL 만료 | preview URL 우선 사용, fallback 처리 |
| 메모리 사용량 증가 | 이미지 Base64 인코딩 최소화 |

