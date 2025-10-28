# 작업 계획: 일정 설명 내용 개선
**생성일:** 2025-10-28
**상태:** 진행 중
**관련 SPEC:** SPEC-IMPROVE-EVENT-DESC-001

---

## 목표
Google Calendar에 추가되는 이벤트 설명을 개선하여:
1. 원본 HTML 본문 제거로 간결함 향상
2. 링크 중복 제거로 사용성 개선
3. 이미지 파일 자동 첨부로 즉시 열람 가능

---

## 단계별 계획

### STEP 1: 요구사항 검증 및 설계 (완료 예정)
**목표:** 현재 코드 분석 및 변경 범위 파악

**작업:**
- [ ] `buildDescription()` 함수 상세 분석
- [ ] `createEvent()` 함수 분석
- [ ] Google Calendar Attachments API 확인
- [ ] 현재 테스트 코드 상태 파악

**결과물:** 분석 노트 및 설계 결정

---

### STEP 2: 링크 중복 제거 구현 (AC-1)
**목표:** 링크 배열에서 중복 제거 및 정렬

**작업:**
1. **TDD Red:** 테스트 작성
   - [ ] `deduplicateLinks()` 유닛 테스트
   - [ ] 케이스: 원문 링크 우선순위
   - [ ] 케이스: URL 정규화
   - [ ] 케이스: 빈 배열 처리

2. **구현 (GREEN):**
   - [ ] `deduplicateLinks()` 함수 작성
   - [ ] URL 정규화 로직 추가
   - [ ] `buildDescription()`에 적용

3. **테스트 검증:**
   - [ ] 모든 유닛 테스트 통과
   - [ ] 통합 테스트 실행

**결과물:**
- `src/lib/utils.ts` (새 파일): `deduplicateLinks()` 함수
- `test/lib/utils.test.ts` (새 파일): 유닛 테스트

**체크리스트:**
- [ ] RED: 테스트 작성 및 실패 확인
- [ ] GREEN: 함수 구현 및 테스트 통과
- [ ] 통합 테스트 실행

---

### STEP 3: 원본 HTML 본문 제거 구현 (AC-2)
**목표:** `buildDescription()`에서 HTML 본문 섹션 제거

**작업:**
1. **TDD Red:** 테스트 작성
   - [ ] HTML 본문이 설명에 포함되지 않는지 테스트
   - [ ] 다른 섹션(요약, 포인트, 링크)은 포함되는지 테스트

2. **구현 (GREEN):**
   - [ ] `buildDescription()`에서 `htmlDescription` 파라미터 제거
   - [ ] HTML 본문 섹션 삭제

3. **테스트 검증:**
   - [ ] 모든 테스트 통과
   - [ ] 기존 기능 회귀 테스트

**파일 변경:**
- `src/index.ts`: `buildDescription()` 함수 수정

**체크리스트:**
- [ ] 함수 서명 변경 검증
- [ ] 호출처 업데이트
- [ ] 테스트 통과

---

### STEP 4: 첨부파일 정보 본문 제거 구현 (AC-3)
**목표:** `buildDescription()`에서 첨부파일 정보 섹션 제거

**작업:**
1. **TDD Red:** 테스트 작성
   - [ ] 첨부파일 정보가 설명에 포함되지 않는지 테스트

2. **구현 (GREEN):**
   - [ ] `buildDescription()`에서 `attachmentText` 파라미터 제거
   - [ ] 첨부파일 정보 섹션 삭제
   - [ ] `processNewItem()`의 호출 코드 수정

3. **테스트 검증:**
   - [ ] 모든 테스트 통과

**파일 변경:**
- `src/index.ts`: `buildDescription()` 호출 코드 수정

**체크리스트:**
- [ ] 함수 서명 변경 검증
- [ ] 호출처 모두 업데이트
- [ ] 테스트 통과

---

### STEP 5: 이미지 첨부 기능 구현 (AC-4, AC-5)
**목표:** 첨부파일을 Google Calendar에 자동 첨부

**작업:**
1. **유틸리티 함수 작성:**
   - [ ] `isImageFile()`: 이미지 파일 판단
   - [ ] `buildAttachmentFromFile()`: RssItem → GoogleCalendarAttachment 변환

2. **TDD Red:** 테스트 작성
   - [ ] `isImageFile()` 유닛 테스트
   - [ ] JPG, PNG, GIF 등 포함
   - [ ] PDF, DOC 등 제외
   - [ ] `buildAttachmentFromFile()` 테스트

3. **구현 (GREEN):**
   - [ ] 함수 구현
   - [ ] `createEvent()` 수정 (attachments 처리)
   - [ ] `processNewItem()` 수정 (attachment 전달)

4. **테스트 검증:**
   - [ ] 모든 유닛 테스트 통과
   - [ ] 통합 테스트 실행
   - [ ] Google Calendar API 호출 검증

**파일 변경:**
- `src/types.ts`: `GoogleCalendarAttachment` 타입 추가
- `src/lib/utils.ts`: 유틸리티 함수 추가
- `src/lib/calendar.ts`: `createEvent()` 수정
- `src/index.ts`: `processNewItem()` 수정
- `test/lib/utils.test.ts`: 유틸 테스트 추가
- `test/lib/calendar.test.ts`: Calendar 테스트 추가

**체크리스트:**
- [ ] RED: 테스트 작성 및 실패 확인
- [ ] GREEN: 함수 구현 및 테스트 통과
- [ ] Google Calendar API 호출 검증

---

### STEP 6: 전체 통합 테스트 및 검증 (최종)
**목표:** 모든 변경사항 통합 검증

**작업:**
1. **회귀 테스트:**
   - [ ] 기존 기능 모두 동작 확인
   - [ ] 이벤트 생성 엔드-투-엔드 테스트
   - [ ] Google Calendar에 실제 추가 테스트

2. **테스트 커버리지:**
   - [ ] 전체 커버리지 80% 이상 확인
   - [ ] 새로운 함수 100% 커버리지

3. **성능 검증:**
   - [ ] 링크 중복 제거 성능 (1000개 링크 기준)
   - [ ] 첨부파일 처리 성능

4. **문서 업데이트:**
   - [ ] SPEC 최종 검증
   - [ ] 주요 변경사항 기록

**체크리스트:**
- [ ] 모든 유닛 테스트 통과
- [ ] 모든 통합 테스트 통과
- [ ] 커버리지 확인
- [ ] 성능 벤치마크
- [ ] 문서 검증

---

## 파일 변경 요약

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/index.ts` | 수정 | `buildDescription()`, `processNewItem()` |
| `src/types.ts` | 추가 | `GoogleCalendarAttachment` 타입 |
| `src/lib/calendar.ts` | 수정 | `createEvent()` - attachments 처리 |
| `src/lib/utils.ts` | 신규 | 유틸리티 함수 (`deduplicateLinks`, `isImageFile`, `buildAttachmentFromFile`) |
| `test/index.test.ts` | 수정 | `buildDescription()` 테스트 |
| `test/lib/calendar.test.ts` | 수정 | `createEvent()` 테스트 |
| `test/lib/utils.test.ts` | 신규 | 유틸리티 함수 테스트 |

---

## 일정

| 단계 | 예상 시간 | 상태 |
|------|---------|------|
| STEP 1 | 30분 | 대기 |
| STEP 2 | 1시간 | 대기 |
| STEP 3 | 30분 | 대기 |
| STEP 4 | 30분 | 대기 |
| STEP 5 | 1.5시간 | 대기 |
| STEP 6 | 1시간 | 대기 |
| **총계** | **5시간** | - |

---

## 의사결정 사항

### 1. 링크 정규화 방식
- URL 비교: scheme + host + pathname 기준
- 쿼리 파라미터는 무시 (페이지는 같으나 필터만 다른 경우)

### 2. 이미지 파일 판단 방식
- MIME type 우선 사용 (Content-Type)
- 확장자 기반 fallback (filename에서 추출)

### 3. Google Calendar Attachments
- fileUrl: 공개 URL만 지원 (download 가능해야 함)
- 최대 5개 첨부파일까지 지원
- 실패 시 이벤트는 계속 생성 (attachment 오류는 무시)

### 4. 하위 호환성
- `buildDescription()` 함수 서명 변경 (파라미터 제거)
- 기존 호출처 모두 업데이트 필요
- API 레벨에서만 attachments 추가 (하위 호환성 유지)

---

## 리스크 및 완화 전략

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| Google Calendar API 변경 | 중 | API 버전 고정, 공식 문서 참고 |
| 첨부파일 URL 만료 | 중 | preview URL 우선 사용, fallback 처리 |
| 메모리 사용량 증가 | 낮음 | 이미지 Base64 인코딩 최소화 |
| 성능 저하 | 낮음 | 링크 중복 제거 O(n) 복잡도 유지 |

---

## 참고

- **SPEC 문서:** `.spec/calendar/improve-event-description.spec.md`
- **기존 SPEC:** `.spec/calendar/knue-rss-calendar.spec.md`
- **브랜치:** `feat/improve-calendar-event-description`

