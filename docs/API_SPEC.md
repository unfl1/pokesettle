# API 계약 설계

작성일: 2026-10-21. Phase 0 계약 초안. 실행 가능한 서버·Pydantic 모델·OpenAPI 파일은 아직 작성하지 않았다. 예시 ID와 문장은 형식 설명용이며 실제 수집·분석 결과가 아니다.

> Phase 1 업데이트: 아래 표는 설계 당시 계획이다. 현재 `/api/status`, `/api/session`, `/api/pokemon`, `/api/pokemon/{id}`, `/api/regulations`, `/api/documents/collect`, `/api/chat`, `/api/jobs/{jobId}`를 구현했다. 대화 저장은 채팅의 최소 내부 기능으로 제공하고 대화 목록·조회 API, 탐색·가이드·UI는 Phase 2에 남겼다. 실제 OpenAPI는 [스냅샷](evidence/openapi.json), 검증은 [TEST_RESULTS.md](TEST_RESULTS.md)를 참조한다. 근거의 적용 범위는 현재 `game`, `battleFormat`, `regulationId` 필드로 표시한다.

관련 문서: [요구사항](REQUIREMENTS.md), [아키텍처·데이터](ARCHITECTURE.md), [출처](DATA_SOURCES.md).

## 1. 공통 규약

- `/api`, JSON UTF-8. JSON은 camelCase, 내부 Python은 snake_case로 명시 변환한다.
- 문자열 ID, UTC ISO 8601 시각. 알 수 없는 값은 null, 확인된 빈 목록은 `[]`.
- 성공: `{ "data": ..., "requestId": "...", "warnings": [] }`.
- 실패: `{ "error": {"code":"...", "message":"안전한 한국어 안내", "retryable":false, "details":[]}, "requestId":"..." }`. details에는 입력 필드/코드만, 키·프롬프트·서버 경로·traceback은 넣지 않는다.
- 목록은 `items`, `total`, `limit`, `offset`. `1 <= limit <= 100`, 기본 20, `offset >= 0`. 검색 문자열 1~200자, 질문/자연어 조건 1~2000자, 앞뒤 공백 제거.
- 개인용 로컬 배포를 기본으로 한다. 서버가 임의 세션을 발급하고 HttpOnly, SameSite=Lax 쿠키로 소유권을 확인한다. 세션별 대화·작업·팀 접근을 검사한다. 개발 origin allowlist와 변경 요청의 Origin 검사 적용. 외부 공개 인증·계정 체계는 범위 밖이다.
- 작업 요청에는 `clientRequestId`(UUID)를 받는다. 같은 세션·종류·ID·본문이면 같은 작업을 반환하고, 같은 ID에 다른 본문이면 409. 실패 작업의 의도적 재시도는 새 ID를 쓴다.
- `regulationId`는 외부 설정 참조다. 생략 시 일반 지식 범위이며 '현재 합법'으로 판정하지 않는다. 모르는 ID는 422, 확인되지 않은 규칙에 의존하는 분석은 보류한다.

## 2. 공통 결과 모델

| 모델 | 주요 필드 |
|---|---|
| `Fact` | `text`, `verificationStatus`, `origin`(`source`/`user_input`/`engine`), `scope`, `evidenceIds` |
| `Assumption` | `text`, `reason`, `affectedFields`. 규칙의 미확인을 검증된 사실로 대체하지 않음 |
| `Unknown` | `field`, `reason`, `requiredFor`. 미확인 규칙·상대 세트 등 |
| `Citation` | `evidenceId`, `number`, `documentId`, `title`, `sourceType`, `sourceUrl` 또는 `fileName/pageStart/pageEnd`, `pokemonId`, `revisionId`, `collectedAt`, `licence`, `scope` |
| `Calculation` | `status`: `not_requested/verified/unsupported/insufficient_input`, `engineVersion`, `rulesetVersion`, `inputs`, `outputs`, `limitations`. 계산하지 않은 outputs는 null |
| `GroundedResult` | `answerStatus`: `answered/partial/abstained`, `answer`, `facts`, `assumptions`, `unknowns`, `calculation`, `citations`, `citationNotice`, `regulationId` |

Citation의 sourceType은 `metadata/api/wiki/web/pdf/curated` 중 실제 유형이다. 메타 출처는 로컬 상세 페이지 링크와 원 제공자 URL을 구분한다. URL은 수집 기록에서만 채우고 LLM 출력 URL을 그대로 신뢰하지 않는다. 인용 번호는 답변 내 `[근거 n]`과 정확히 일치해야 한다. retrieved 전체와 실제 cited는 다르며 API에는 실제 인용만 표시한다.

## 3. 단계별 엔드포인트

표의 단계는 구현 예정이며 이번 작업에서 생성한 엔드포인트는 없다.

| 메서드 / 경로 | 목적 | 예정 단계 |
|---|---|---|
| GET `/api/status` | 키 설정 여부·메타/문서 건수·준비 상태 | Phase 1 |
| POST `/api/session` | 익명 로컬 세션 쿠키 생성/유효 세션 유지 | Phase 1 |
| GET `/api/pokemon` | 이름·타입·검증/적격 상태 필터 목록 | Phase 1 |
| GET `/api/pokemon/{id}` | 메타·출처·필드 검증 상태 상세 | Phase 1 |
| GET `/api/regulations` | 알려진 규칙 스냅샷·기간·검증 수준 | Phase 1 |
| POST `/api/documents/collect` | 선택 항목 문서 준비 작업, 캐시 우선 | Phase 1 |
| POST `/api/chat` | 수집 필요성 확인 후 RAG 답변 작업 접수 | Phase 1 |
| GET `/api/jobs/{jobId}` | 처리 단계·결과·안전한 오류 | Phase 1 |
| POST `/api/conversations` | 선택 항목의 대화 생성 | Phase 2, Phase 1 채팅 검증 시 최소 저장 계약 선행 |
| GET `/api/conversations?pokemonId=...` | 세션·항목별 대화 목록 | Phase 2 |
| GET `/api/conversations/{id}/messages` | 저장 메시지·실제 인용 복원 | Phase 2 |
| POST `/api/pokemon/search` | 자연어 조건 탐색 | Phase 2 |
| POST `/api/pokemon/{id}/guide` | 근거 기반 운용 가이드 작업 접수 | Phase 2 |
| POST `/api/teams`, GET `/api/teams`, GET/PUT/DELETE `/api/teams/{id}` | 팀 저장·조회·수정·삭제 | Phase 3 |
| POST `/api/teams/analyze`, POST `/api/teams/select` | 매치업·선출 후보 분석 | Phase 3 |
| POST `/api/battle/analyze`, POST `/api/battle/recommend` | 현재 상성·공격/교체/메가 시나리오 | Phase 3 |
| POST `/api/battle/damage` | 검증된 계산 입력에 대한 데미지/조건부 KO | Phase 4 선택 |
| POST `/api/chat/stream` | SSE 선택 확장 | 선택. 필수 진행 상태는 polling으로 충족 |

메타/문서 초기 일괄 색인과 강제 갱신은 서버 운영 스크립트로 제공할 계획이다. 사용자 화면에 임의 URL 수집·삭제/전체 재색인 API를 노출하지 않는다.

## 4. 상태·목록·상세

`GET /api/status`의 data:

```json
{
  "ready": false,
  "modelConfigured": false,
  "metadataCount": 0,
  "documentChunkCount": 0,
  "missing": ["MODEL_KEY_MISSING", "INDEX_NOT_READY"],
  "regulationVerificationStatus": "unknown"
}
```

이 예시는 준비 전 상태 형식이다. 키 값이나 내부 경로는 반환하지 않는다. 서버가 살아 있으나 준비 전이면 이 엔드포인트는 200으로 상태를 알려 주고 채팅 요청은 503으로 거절한다.

`GET /api/pokemon` query: `q?`, `type?`, `regulationId?`, `eligibilityStatus?`, `limit?`, `offset?`. 적격 필터는 확인된 판정만 일치시킨다. 알려지지 않은 적격을 true로 변환하지 않는다. 미지원 조건은 무시하지 않고 422.

`PokemonSummary`: `pokemonId`, `nameKo`, `nameEn`, `types`, `championsEligibilityStatus`, `verificationStatus`, `scope`. `PokemonDetail`은 `baseStats`, `abilities`, `availableMoves`, `megaForms`, `description`, `eligibleRegulations`, `fieldProvenance`, `sources`를 추가한다. 세부 타입·null 규칙은 ARCHITECTURE의 데이터 계약과 일치한다.

`GET /api/regulations`: ID·게임·포맷·UTC 적용 기간·규칙별 검증 상태·source IDs·확인일. 명단 미확인이면 `eligibleEntries:null`이며 빈 목록으로 전체 부적격을 암시하지 않는다. 현재 날짜에 해당하는 규칙과 검증 여부를 별개 필드로 반환한다.

## 5. 문서 준비와 작업 상태

`POST /api/documents/collect` 요청:

```json
{
  "pokemonId": "pokemon:example",
  "question": "이 포켓몬의 역할을 설명해 줘",
  "regulationId": null,
  "clientRequestId": "0e7f3b49-4cdf-48fa-908a-0e1234567890"
}
```

서버가 등록된 출처 어댑터로만 검색하고 캐시·자체 문서 포함 규칙을 적용한다. 강제 갱신은 이 요청에서 허용하지 않는다. 202 응답 data는 `jobId`, `status:"queued"`, `statusUrl`이다. 진행 위치는 `Location` 헤더에도 둔다.

`GET /api/jobs/{jobId}`:

| 필드 | 계약 |
|---|---|
| `status` | `queued/running/completed/failed/interrupted` |
| `stage` | `validating/extracting_queries/searching/filtering/collecting/indexing/retrieving/generating/validating_citations/saving/done` 중 적용 단계 |
| `progress` | `{completedUnits,totalUnits}` 또는 null. 총량 미확인 시 가짜 퍼센트 금지 |
| `cache` | 검색어/원문 cache hit·miss 수. 디버그 프롬프트 비노출 |
| `result` | 완료 시 종류별 결과, 나머지는 null |
| `error` | 실패 시 공통 안전 오류, 나머지는 null |
| `createdAt`, `updatedAt` | UTC 시각 |

polling 기본 1초, 장기 작업은 2~5초로 간격 확대한다. 다른 세션의 job은 404. 완료가 되어도 `answerStatus=abstained`일 수 있으며 유보는 서버 오류가 아니다. 수집 결과는 `documentCount`, `chunkCount`, 채택 문서 제목/출처, `subjectDocumentStatus`를 포함한다. 필수 자체 문서가 없으면 성공 완료로 보고하지 않는다.

## 6. 대화와 RAG 응답

`POST /api/conversations`: `{pokemonId,regulationId?}`→201 data `{conversationId,pokemonId,regulationId,createdAt}`.

`POST /api/chat` 요청:

```json
{
  "pokemonId": "pokemon:example",
  "conversationId": null,
  "question": "이 포켓몬을 어떤 역할로 사용할 수 있어?",
  "regulationId": null,
  "clientRequestId": "cdb84dc3-311b-4b21-91d5-0e1234567890"
}
```

conversationId가 null이면 선택 항목·규칙으로 새 대화를 생성한다. 기존 ID이면 소유 세션·pokemonId·regulationId 일치를 검사하고 불일치는 409. 규칙 변경은 새 대화로 분리해 과거 맥락 혼입을 막는다. 채팅은 202 작업 응답을 반환하고, 서버가 필요한 수집을 거쳐 retrieve/generate를 수행한다. UI가 별도 수집 요청을 먼저 호출할 필요는 없다.

완료된 chat job의 result는 `{conversationId,userMessageId,assistantMessageId,...GroundedResult}`다. 근거 부족 예시:

```json
{
  "answerStatus": "abstained",
  "answer": "수집된 문서에서 이 역할을 확인할 수 없습니다.",
  "facts": [],
  "assumptions": [],
  "unknowns": [{"field":"strategyRole","reason":"질문을 지지하는 근거 부족","requiredFor":"운용 가이드"}],
  "calculation": {"status":"not_requested","engineVersion":null,"rulesetVersion":null,"inputs":null,"outputs":null,"limitations":[]},
  "citations": [],
  "citationNotice": "이 답변에 인용된 근거가 없습니다.",
  "regulationId": null
}
```

예시는 GroundedResult 부분만 보여 준다. 정상 주장에는 번호·실제 인용 목록이 있어야 한다. 전체 검색 근거는 메타를 포함해도 질문 관련 근거 부족이면 이와 같이 유보할 수 있다. `GET .../messages`는 `messageId`, `role`, `content`, `createdAt`, assistant의 GroundedResult 스냅샷을 페이지 단위로 돌려준다.

`POST /api/pokemon/{id}/guide`는 `conversationId?`, `regulationId?`, `clientRequestId`를 받는다. 서버의 가이드 질문 템플릿으로 역할·주의점·적용 포맷을 요청하고 동일 RAG 작업과 GroundedResult를 사용한다. 모델이 일반 지식으로 채운 가이드를 별도 성공 경로로 제공하지 않는다.

## 7. 자연어 조건 탐색

`POST /api/pokemon/search` 요청은 `{query,regulationId?,limit?,offset?}`. 응답 data는:

- `status`: `matched/no_results/needs_clarification`.
- `interpretedFilters`: 필드·operator·value 배열. 예: `{field:"baseStats.speed",operator:"gte",value:100}`.
- `items`: PokemonSummary + `matchedConditions`, `supportingEvidenceIds`, `conversationTarget:{pokemonId}`.
- `unknownConditions`, `excludedUnknownCount`, `total`, `limit`, `offset`, `completeness`: `complete_for_structured_filters/limited_semantic_candidates`.

정확 조건은 실제 필드로 검증한다. 속성 미확인은 일치 목록에서 제외하고 이유를 표시한다. 모호한 해석은 clarification 안내를 반환하며 뜻을 임의 확정하지 않는다. 유사도 점수는 관련도일 뿐 확률이 아니며, 필요 없으면 UI에 노출하지 않는다.

## 8. 후속 팀·전투 계약

이 절은 Phase 3·4의 방향만 고정한다. 상세 규칙 미확인 상태이므로 실행용 최종 스키마는 해당 단계에서 검증 후 확정한다. 미구현 경로를 호출 가능한 기능으로 표시하지 않는다.

| 요청 | 입력 | 출력·제약 |
|---|---|---|
| 팀 CRUD | 이름, regulationId, 멤버 슬롯·CombatSet | teamId, 버전, 적격 검사 상태. 팀 크기·중복 규칙은 검증된 설정에서 읽음 |
| teams/analyze | 내 팀·상대 preview, 규칙 | 위협·커버리지·역할 설명+GroundedResult. 미공개 세트는 가정 |
| teams/select | 양쪽 팀/규칙 | 합법 후보·선출/리드·평가 요소. 6→3 확인 후 20개 조합 열거. 점수는 휴리스틱 척도 |
| battle/analyze | BattleState·규칙 | 검증된 타입 관계, 알려진 제약, 미확인 |
| battle/recommend | BattleState·가정 시나리오 | 공격/교체/메가 연계 후보·이유·위험·대안. 합법 행동 정의 검증 필요 |
| battle/damage | 공격·방어 세트, 기술, 필드·규칙·조건 | 계산 분포·조건부 KO·정확한 조건 및 엔진 버전. 미지원/입력 부족이면 수치 null |

공통 facts/assumptions/unknowns/calculation/citations를 재사용한다. 알려지지 않은 레벨·육성·기술 효과를 몰래 기본값으로 채우지 않는다. 미지원 공식은 422 `UNSUPPORTED_MECHANICS`, 입력 부족은 422 `INSUFFICIENT_BATTLE_INPUT`. 데이터는 있으나 전략적 결론을 지지하지 못하는 경우는 정상 유보다.

팀 저장·갱신은 201/200, 삭제는 204를 사용한다. 분석은 장기 실행 시 동일 202/job 계약을 재사용한다. 상세 필드와 동시 갱신 정책은 Phase 3에서 확정한다.

## 9. 오류·검증 매핑

| HTTP / code | 상황 | 사용자 표시·재시도 |
|---|---|---|
| 401 `SESSION_REQUIRED` | 세션 없음/만료 | 세션 생성 안내 |
| 404 `POKEMON_NOT_FOUND` / `RESOURCE_NOT_FOUND` | ID 없음 또는 타 세션 리소스 | 선택/목록 갱신 |
| 409 `CONVERSATION_SCOPE_MISMATCH` | 항목·규칙과 대화 불일치 | 해당 범위 새 대화 생성 |
| 409 `REQUEST_CONFLICT` | 같은 clientRequestId 다른 입력 | 새 요청 ID로 전송 |
| 422 `INVALID_INPUT` / `UNKNOWN_REGULATION` | 길이·필드·ID 검증 실패 | 안전한 필드 오류 |
| 503 `INDEX_NOT_READY` | 필수 메타 색인 미완료 | 데이터 준비 안내 |
| 503 `MODEL_KEY_MISSING` | 서버 키/모델 설정 누락 | 서버 설정 안내, 실제 키 비노출 |
| 502/504 `SOURCE_UNAVAILABLE` / `MODEL_TIMEOUT` | 외부 출처/모델 실패 | 가능한 경우 재시도 |
| 502 `SUBJECT_DOCUMENT_UNAVAILABLE` | 자체 문서 확보 실패 | 문서 준비 미완료 안내, 완료로 위장 금지 |
| 502 `GENERATION_INVALID` | 제한 재시도 후 출력 검증 실패 | 안전한 오류, 내부 전문 비노출 |
| 500 `INTERNAL_ERROR` | 예상 외 실패 | requestId와 일반 안내 |

접수 후 실패는 GET job 자체를 500으로 바꾸지 않고 200 data.status=`failed`와 같은 code를 담은 error로 표현한다. 동기 단계 실패만 표의 HTTP 코드를 사용한다. 조건 검색 빈 결과는 200 `no_results`, 근거 부족은 200 결과/완료 job의 `abstained`이며 장애와 구분한다.

## 10. 계약 검증 계획

- Phase 1: 입력·응답 Pydantic 검증, 색인/키 누락, 잘못된 출력·인용 ID·작업 실패, 캐시, 타 세션 접근, 요청 중복을 확인한다.
- Phase 2: 항목 전환/재접속 기록, 수집·생성 상태, 실제 인용 링크, 빈 결과·유보·오류 화면을 통합 검증한다.
- 일반 요청이 `TOP_K`·프롬프트·모델 키를 덮어쓰지 못하도록 한다. 설정 변화 검증은 서버 설정에서 수행한다.
- SSE를 추가한다면 상태·최종 결과·오류와 ID 계약을 polling과 동일하게 유지하고 최종 인용 검증 전의 토큰을 검증된 답변으로 표시하지 않는다.

이번 단계에서는 위 계약의 문서 일관성만 점검하며, API 동작 테스트 통과를 주장하지 않는다.
