---
id: TASK-2025-10-19-KNUE-SPEC
version: 1.0.0
scope: folder:.tasks/2025-10-19-knue-calendar
status: active
supersedes: []
depends: []
last-updated: 2025-10-19
owner: codex
---

## Acceptance Criteria (Delta)
1. Cloudflare Worker 스케줄러(4시간 주기)가 RSS (`bbsNo=28`)를 조회하여 신규 게시물을 탐지한다.
2. 신규 게시물에 대해 다음 정보를 수집해 Google Calendar 이벤트를 생성한다:
   - 제목: RSS `title`
   - 시작/종료일: `pubDate` 기반 (종일 이벤트로 처리)
   - 설명: RSS `description` + AI 요약/추출 인사이트
   - 첨부: `filename1`, `url1` 존재 시 일정 설명에 다운로드 링크 포함
   - `preview1` 존재 시 미리보기 분석결과 (텍스트 추출 또는 OCR 결과) 포함
3. 미리보기 URL이 이미지인 경우 OCR 통해 텍스트를 추출하여 설명에 추가한다.
4. AI 분석은 중요 키포인트(행사명, 일정, 장소, 신청 링크 등)를 요약하여 설명에 포함한다.
5. Google Calendar 내 동일/유사 이벤트가 이미 존재하는 경우(제목+날짜+설명 유사도 기반) 중복 생성을 방지한다.
6. 처리된 게시물 ID(또는 해시)는 지속 저장소(KV 또는 D1)에 기록하여 재처리를 방지한다.
7. 오류 발생 시 Sentry 유사 로깅 또는 console error 로그 출력, 실패한 항목은 다음 실행에서 재시도 가능해야 한다.
8. 프로젝트는 wrangler 구성, 환경변수/시크릿 정의, 로컬 테스트 지침을 포함한다.
