---
id: SPEC-KNUE-RSS-CALENDAR-001
version: 1.0.0
scope: global
status: active
supersedes: []
depends: []
last-updated: 2025-10-19
owner: codex
---

# KNUE RSS Calendar Sync Specification

## Functional Requirements
1. Worker 실행 시 RSS feed (`bbsNo=28`)를 읽고 각 `<item>`을 구조화하여 처리한다.
2. `nttNo` 기준으로 신규 게시물만 처리하기 위해 상태 저장(KV/D1)한다.
3. 각 신규 게시물에 대해 AI 분석을 수행하여 다음 정보를 추출한다:
   - 핵심 요약 (한 문단)
   - 주요 일정(날짜, 시간)
   - 장소 또는 URL 정보
   - 신청/문의 링크
4. 첨부 미리보기(`preview1`)가 존재하면:
   - URL에서 `atchmnflNo` 추출 후 `https://knue-www-preview-parser-cf.kangdongouk.workers.dev/<id>`로 호출해 콘텐츠 확보.
   - 콘텐츠 타입이 이미지이면 OCR 수행, 텍스트/HTML이면 텍스트를 정제하여 활용.
5. Google Calendar 이벤트는 종일(all-day) 이벤트로 추가하며, 설명(description)에 다음을 포함한다:
   - AI 요약 결과 (구조화된 bullet 혹은 문단)
   - 원문 링크 및 신청/다운로드 링크
   - OCR/미리보기 추출 텍스트 (필요 시 요약)
6. 캘린더 중복 방지는 다음 조건을 모두 검증한다:
   - 동일한 `nttNo`가 이미 기록되어 있는지 확인.
   - 최근 60일 내 이벤트 중 제목·날짜·요약을 비교하여 유사도 >= 0.85 이면 skip.
7. 처리 성공 시 상태 저장소에 `nttNo`, 생성된 이벤트 ID, 처리 시각을 저장한다.
8. 오류 발생 시 로그로 원인을 남기고, 실패 항목은 다음 실행에 재시도된다.

## Non-Functional Requirements
- 스케줄러는 4시간 간격 Cron (`0 */4 * * *`).
- 외부 API 키는 Cloudflare Secrets 로 유지한다.
- 외부 호출 실패 시 exponential backoff (최대 3회).
- 테스트 커버리지: 파서, 미리보기 파이프라인, 중복 로직 포함.
