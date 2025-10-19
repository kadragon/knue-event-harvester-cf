---
id: SPEC-KNUE-RSS-CALENDAR-001
version: 1.1.0
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
3. 각 신규 게시물에 대해 AI 분석을 수행하여 캘린더 이벤트 정보를 직접 추출한다. 하나의 게시물에 여러 행사가 포함된 경우 각 행사를 개별 이벤트로 분리:
- 이벤트 제목 (title)
- 이벤트 설명 (description, 이모지를 포함한 항목 형식)
- 시작 날짜 (startDate, YYYY-MM-DD, 연도 조정 로직 적용)
- 종료 날짜 (endDate, YYYY-MM-DD)
- 시작 시간 (startTime, HH:MM, optional)
- 종료 시간 (endTime, HH:MM, optional)
4. Google Calendar 이벤트는 AI가 시간 정보를 추출하면 시간 이벤트로, 그렇지 않으면 종일(all-day) 이벤트로 추가하며, 설명(description)에 다음을 포함한다:
- AI 생성 이벤트 설명
- 원문 링크 및 첨부 파일 링크
5. 캘린더 중복 방지는 다음 조건을 모두 검증한다:
- 동일한 `nttNo`가 이미 기록되어 있는지 확인.
- 최근 60일 내 이벤트 중 제목·날짜·요약을 비교하여 유사도 >= 0.85 이면 skip.
6. 처리 성공 시 상태 저장소에 `nttNo`, 생성된 이벤트 ID, 처리 시각을 저장한다.
7. 오류 발생 시 로그로 원인을 남기고, 실패 항목은 다음 실행에 재시도된다.

## Non-Functional Requirements
- 스케줄러는 4시간 간격 Cron (`0 */4 * * *`).
- 외부 API 키는 Cloudflare Secrets 로 유지한다.
- 외부 호출 실패 시 exponential backoff (최대 3회).
- 테스트 커버리지: 파서, AI 이벤트 추출, 중복 로직 포함.
