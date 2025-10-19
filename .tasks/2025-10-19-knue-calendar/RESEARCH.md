---
id: TASK-2025-10-19-KNUE-RESEARCH
version: 1.0.0
scope: folder:.tasks/2025-10-19-knue-calendar
status: active
supersedes: []
depends: []
last-updated: 2025-10-19
owner: codex
---

## Context
- KNUE 공지 RSS (`https://www.knue.ac.kr/rssBbsNtt.do?bbsNo=28`) exposes `<item>` entries containing `title`, `link`, `pubDate`, `description`, and optional attachment metadata (`filename1`, `url1`, `preview1`).
- 첨부 미리보기 URL은 `preview1` 로 제공되며, `?atchmnflNo=...` 쿼리 값을 추출하여 `https://knue-www-preview-parser-cf.kangdongouk.workers.dev/<atchmnflNo>` 에 전달하면 워커가 실제 미리보기 컨텐츠를 반환.
- 프로젝트 목표: RSS 신규 게시물을 분석하고, AI 요약/추출 정보를 토대로 Google Calendar 일정 생성. 기존 일정과 유사한 경우 중복 생성 방지.
- Cloudflare Workers 환경에서 4시간마다 스케줄러(CRON)로 동작해야 함.
- 첨부가 이미지라면 OCR 수행하여 일정 메모에 포함 필요.

## Open Questions
- Google Calendar API Credentials 저장 위치 및 인증 방식 (Service Account vs OAuth) → 워커 Secrets 로 관리 예정.
- AI 분석 모델: OpenAI API 활용 가정 (모델/비용/토큰 제한 고려 필요).
- OCR 구현: Cloudflare Workers 내에서 직접 수행 (예: Tesseract WASM) vs 외부 API 호출? 성능/비용 Trade-off 평가 필요.

## Preliminary Notes
- 유사도 비교는 제목/날짜/본문을 벡터화하여 비교하거나, 간단한 해시/문자열 유사도(Jaccard, cosine) 활용 가능. 워커 KV/D1에 이벤트 요약 히스토리 저장 필요.
- Google Calendar 중복 검출을 위해 최근 일정 목록을 가져와 비교 (시간 범위 및 maxResults 제한 고려).
