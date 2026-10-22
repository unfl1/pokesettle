# API 계약 설계

작성일: 2026-10-21. Phase 0 계약 초안. 실행 가능한 서버·Pydantic 모델·OpenAPI 파일은 아직 작성하지 않음. 예시 ID와 문장은 형식 설명용이며 실제 수집·분석 결과가 아님.


현재 API 확인: [실행 중 Swagger UI](http://127.0.0.1:8000/docs)·[라우터 정의](../../backend/app/api/routers/) 참조, 아래 설계 예시와 실제 구현이 다르면 실행 중 API 계약 우선

관련 문서: [요구사항](REQUIREMENTS.md), [아키텍처·데이터](ARCHITECTURE.md), [출처](../guides/DATA_SOURCES.md).

## 1. 공통 규약

- `/api`, JSON UTF-8. JSON은 camelCase, 내부 Python은 snake_case로 명시 변환함.
- 문자열 ID, UTC ISO 8601 시각. 알 수 없는 값은 null, 확인된 빈 목록은 `[]`.
- 성공: `{ "data": ..., "requestId": "...", "warnings": [] }`.
- 실패: `{ "error": {"code":"...", "message":"안전한 한국어 안내", "retryable":false, "details":[]}, "requestId":"..." }`. details에는 입력 필드/코드만, 키·프롬프트·서버 경로·traceback은 넣지 않음.
- 목록은 `items`, `total`, `limit`, `offset`. `1 <= limit <= 100`, 기본 20, `offset >= 0`. 검색 문자열 1~200자, 질문/자연어 조건 1~2000자, 앞뒤 공백 제거.
- 개인용 로컬 배포를 기본으로 함. 서버가 임의 세션을 발급하고 HttpOnly, SameSite=Lax 쿠키로 소유권을 확인함. 세션별 대화·작업·팀 접근을 검사함. 개발 origin allowlist와 변경 요청의 Origin 검사 적용. 외부 공개 인증·계정 체계는 범위 밖임.
- 작업 요청에는 `clientRequestId`(UUID)를 받음. 같은 세션·종류·ID·본문이면 같은 작업을 반환하고, 같은 ID에 다른 본문이면 409. 실패 작업의 의도적 재시도는 새 ID를 사용함.
- `regulationId`는 외부 설정 참조임. 생략 시 일반 지식 범위이며 '현재 합법'으로 판정하지 않음. 모르는 ID는 422, 확인되지 않은 규칙에 의존하는 분석은 보류함.

## 2. 공통 결과 모델

| 모델 | 주요 필드 |
|---|---|
| `Fact` | `text`, `verificationStatus`, `origin`(`source`/`user_input`/`engine`), `scope`, `evidenceIds` |
| `Assumption` | `text`, `reason`, `affectedFields`. 규칙의 미확인을 검증된 사실로 대체하지 않음 |
| `Unknown` | `field`, `reason`, `requiredFor`. 미확인 규칙·상대 세트 등 |
| `Citation` | `evidenceId`, `number`, `documentId`, `title`, `sourceType`, `sourceUrl` 또는 `fileName/pageStart/pageEnd`, `pokemonId`, `revisionId`, `collectedAt`, `licence`, `scope` |
| `Calculation` | `status`: `not_requested/verified/unsupported/insufficient_input`, `engineVersion`, `rulesetVersion`, `inputs`, `outputs`, `limitations`. 계산하지 않은 outputs는 null |
| `GroundedResult` | `answerStatus`: `answered/partial/abstained`, `answer`, `facts`, `assumptions`, `unknowns`, `calculation`, `citations`, `citationNotice`, `regulationId` |

Citation의 sourceType은 `metadata/api/wiki/web/pdf/curated` 중 실제 유형임. 메타 출처는 로컬 상세 페이지 링크와 원 제공자 URL을 구분함. URL은 수집 기록에서만 채우고 LLM 출력 URL을 그대로 신뢰하지 않음. 인용 번호는 답변 내 `[근거 n]`과 정확히 일치해야 함. retrieved 전체와 실제 cited는 다르며 API에는 실제 인용만 표시함.

## 3. 단계별 엔드포인트

Phase 1·2 경로와 Phase 3의 일반 타입 시나리오 경로 구현. Champions 현행 규칙 판정과 Phase 4 경로는 미구현임.

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
| POST `/api/conversations` | 포켓몬과 독립된 새 대화 생성 | Phase 2, Phase 1 채팅 검증 시 최소 저장 계약 선행 |
| GET `/api/conversations` | 세션 전체 대화 목록 | Phase 2 |
| GET `/api/conversations/{id}/messages` | 저장 메시지·실제 인용 복원 | Phase 2 |
| POST `/api/pokemon/search` | 자연어 조건 탐색 | Phase 2 |
| POST `/api/pokemon/{id}/guide` | 근거 기반 운용 가이드 작업 접수 | Phase 2 |
| POST `/api/teams`, GET `/api/teams`, GET/PUT/DELETE `/api/teams/{id}` | 팀 저장·조회·수정·삭제 | Phase 3 |
| POST `/api/teams/analyze`, POST `/api/teams/select` | 매치업·선출 후보 분석 | Phase 3 |
| POST `/api/battle/analyze`, POST `/api/battle/recommend` | 현재 상성·공격/교체/메가 시나리오 | Phase 3 |
| POST `/api/battle/damage` | 검증된 계산 입력에 대한 데미지/조건부 KO | Phase 4 선택 |
| POST `/api/chat/stream` | SSE 선택 확장 | 선택. 필수 진행 상태는 polling으로 충족 |

메타/문서 초기 일괄 색인과 강제 갱신은 서버 운영 스크립트로 제공할 계획임. 사용자 화면에 임의 URL 수집·삭제/전체 재색인 API를 노출하지 않음.

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

이 예시는 준비 전 상태 형식임. 키 값이나 내부 경로는 반환하지 않음. 서버가 살아 있으나 준비 전이면 이 엔드포인트는 200으로 상태를 알려 주고 채팅 요청은 503으로 거절함.

`GET /api/pokemon` query: `q?`, `type?`, `regulationId?`, `eligibilityStatus?`, `limit?`, `offset?`. 적격 필터는 확인된 판정만 일치시킴. 알려지지 않은 적격을 true로 변환하지 않음. 미지원 조건은 무시하지 않고 422.

- `PokemonSummary`: `pokemonId`, `nameKo`, `nameEn`, `types`, `championsEligibilityStatus`, `verificationStatus`, `scope`.
- `PokemonDetail`은 `baseStats`, `abilities`, `availableMoves`, `megaForms`, `description`, `eligibleRegulations`, `fieldProvenance`, `sources`를 추가함.
- 세부 타입·null 규칙은 ARCHITECTURE의 데이터 계약과 일치함.

`GET /api/regulations`: ID·게임·포맷·UTC 적용 기간·규칙별 검증 상태·source IDs·확인일. 명단 미확인이면 `eligibleEntries:null`이며 빈 목록으로 전체 부적격을 암시하지 않음. 현재 날짜에 해당하는 규칙과 검증 여부를 별개 필드로 반환함.

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

서버가 등록된 출처 어댑터로만 검색하고 캐시·자체 문서 포함 규칙을 적용함. 강제 갱신은 이 요청에서 허용하지 않음. 202 응답 data는 `jobId`, `status:"queued"`, `statusUrl`임. 진행 위치는 `Location` 헤더에도 둠.

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

polling 기본 1초, 장기 작업은 2~5초로 간격 확대함. 다른 세션의 job은 404. 완료가 되어도 `answerStatus=abstained`일 수 있으며 유보는 서버 오류가 아님. 수집 결과는 `documentCount`, `chunkCount`, 채택 문서 제목/출처, `subjectDocumentStatus`를 포함함. 필수 자체 문서가 없으면 성공 완료로 보고하지 않음.

## 6. 대화와 RAG 응답

`POST /api/conversations`: `{pokemonId?,regulationId?}`→201 data `{conversationId,pokemonId,regulationId,createdAt}`.

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

conversationId가 null이면 새 대화 생성. 기존 ID는 소유 세션·regulationId 일치를 검사하고 다른 포켓몬 질문도 같은 대화에서 허용. 채팅의 pokemonId는 선택 입력이며 생략하면 질문 속 이름·전투 상태·직전 대화 주제로 검색 대상 결정 규칙 변경은 새 대화로 분리해 과거 맥락 혼입을 방지함. 채팅은 202 작업 응답을 반환하고, 서버가 필요한 수집을 거쳐 retrieve/generate를 수행함. UI가 별도 수집 요청을 먼저 호출할 필요는 없음.

완료된 chat job의 result는 `{conversationId,userMessageId,assistantMessageId,...GroundedResult}`임. 근거 부족 예시:

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

예시는 GroundedResult 부분만 보여 제공함. 정상 주장에는 번호·실제 인용 목록이 있어야 함. 전체 검색 근거는 메타를 포함해도 질문 관련 근거 부족이면 이와 같이 유보할 수 있음. `GET .../messages`는 `messageId`, `role`, `content`, `createdAt`, assistant의 GroundedResult 스냅샷을 페이지 단위로 반환함.

`POST /api/pokemon/{id}/guide`는 `conversationId?`, `regulationId?`, `clientRequestId`를 받음. 서버의 가이드 질문 템플릿으로 역할·주의점·적용 포맷을 요청하고 동일 RAG 작업과 GroundedResult를 사용함. 모델이 일반 지식으로 채운 가이드를 별도 성공 경로로 제공하지 않음.

## 7. 자연어 조건 탐색

`POST /api/pokemon/search` 요청은 `{query,regulationId?,limit?,offset?}`. 응답 data는:

- `status`: `matched/no_results/needs_clarification`.
- `interpretedFilters`: 필드·operator·value 배열. 예: `{field:"base_stats.speed",operator:"gte",value:"100"}`.
- `items`: PokemonSummary + `matchedConditions`, `supportingEvidenceIds`, `conversationTarget:{pokemonId}`.
- `unknownConditions`, `excludedUnknownCount`, `total`, `limit`, `offset`, `completeness`: `complete_for_structured_filters` (LLM 해석의 의미적 정확성까지 보증하지 않음).

정확 조건은 실제 필드로 검증함. 속성 미확인은 일치 목록에서 제외하고 이유를 표시함. 모호한 해석은 clarification 안내를 반환하며 뜻을 임의 확정하지 않음. 유사도 점수는 관련도일 뿐 확률이 아니며, 필요 없으면 UI에 노출하지 않음.

## 8. 후속 팀·전투 계약

이 절은 Phase 3·4의 방향만 고정함. 상세 규칙 미확인 상태이므로 실행용 최종 스키마는 해당 단계에서 검증 후 확정함. 미구현 경로를 호출 가능한 기능으로 표시하지 않음.

| 요청 | 입력 | 출력·제약 |
|---|---|---|
| 팀 CRUD | 이름, regulationId, 멤버 슬롯·CombatSet | teamId, 버전, 적격 검사 상태. 팀 크기·중복 규칙은 검증된 설정에서 읽음 |
| teams/analyze | 내 팀·상대 preview, 규칙 | 위협·커버리지·역할 설명+GroundedResult. 미공개 세트는 가정 |
| teams/select | 양쪽 팀/규칙 | 합법 후보·선출/리드·평가 요소. 6→3 확인 후 20개 조합 열거. 점수는 휴리스틱 척도 |
| battle/analyze | BattleState·규칙 | 검증된 타입 관계, 알려진 제약, 미확인 |
| battle/recommend | BattleState·가정 시나리오 | 공격/교체/메가 연계 후보·이유·위험·대안. 합법 행동 정의 검증 필요 |
| battle/damage | 공격·방어 세트, 기술, 필드·규칙·조건 | 계산 분포·조건부 KO·정확한 조건 및 엔진 버전. 미지원/입력 부족이면 수치 null |

공통 facts/assumptions/unknowns/calculation/citations를 재사용함. 알려지지 않은 레벨·육성·기술 효과를 몰래 기본값으로 채우지 않음. 미지원 공식은 422 `UNSUPPORTED_MECHANICS`, 입력 부족은 422 `INSUFFICIENT_BATTLE_INPUT`. 데이터는 있으나 전략적 결론을 지지하지 못하는 경우는 정상 유보임.

팀 저장·갱신은 201/200, 삭제는 204를 사용함. 분석은 장기 실행 시 동일 202/job 계약을 재사용함. 상세 필드와 동시 갱신 정책은 Phase 3에서 확정함.

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

접수 후 실패는 GET job 자체를 500으로 바꾸지 않고 200 data.status=`failed`와 같은 code를 담은 error로 표현함. 동기 단계 실패만 표의 HTTP 코드를 사용함. 조건 검색 빈 결과는 200 `no_results`, 근거 부족은 200 결과/완료 job의 `abstained`이며 장애와 구분함.

## 10. 계약 검증 계획

- Phase 1: 입력·응답 Pydantic 검증, 색인/키 누락, 잘못된 출력·인용 ID·작업 실패, 캐시, 타 세션 접근, 요청 중복을 확인함.
- Phase 2: 항목 전환/재접속 기록, 수집·생성 상태, 실제 인용 링크, 빈 결과·유보·오류 화면을 통합 검증함.
- 일반 요청이 `TOP_K`·프롬프트·모델 키를 덮어쓰지 못하도록 함. 설정 변화 검증은 서버 설정에서 수행함.
- SSE를 추가한다면 상태·최종 결과·오류와 ID 계약을 polling과 동일하게 유지하고 최종 인용 검증 전의 토큰을 검증된 답변으로 표시하지 않음.

Phase 0에서는 문서만 점검함. Phase 1·2 실행 검증과 남은 한계는 각 결과 문서에서 구분함.

## Phase 2 구현 세부사항

- 대화 목록은 `pokemonId` 생략 시 세션 전체 목록, 지정 시 기존 항목 필터 호환 유지, `limit` 기본 20/최대 100, `offset` 기본 0이며 최신 생성 순임. 메시지는 작성 순으로 기본 50/최대 100임. 다른 세션의 대화는 404임. 세션 쿠키는 7일 유효하며 이 기간은 장기 보존·삭제 정책을 뜻하지 않음.
- guide는 일반 도감의 타입·종족값·문서의 특성 설명을 먼저 요청함. 문서에 없는 역할·추천 세트·Champions 전용 전략은 미확인으로 남김. 결과는 GroundedResult에 `feature:pokemon_guide`, `guideScope:generic_reference`, `guideLimitations`가 추가됨. 대화에는 짧은 사용자 요청과 최종 결과를 저장함.
- 조건 필드: `name`, `types`, `abilities`, `champions_eligibility_status`, `base_stats.{hp,attack,defense,sp_attack,sp_defense,speed}`. 필드 식별자 문자열은 snake_case임. 값은 문자열이며 숫자 비교는 질문에 명시된 정수만 허용함. 이름은 eq/contains, 타입·특성·적격성은 eq, 수치는 eq/gte/lte/gt/lt만 허용함. OR와 질적 기준·미검증 전투 효과는 확인 요청 대상임.
- 메타 컬렉션 전체를 의미 검색한 뒤 전체 도감에 정확 조건을 적용함. 상위 일부 후보만으로 전체 일치를 주장하지 않음. 검증된 일치 집합은 의미 순위로 정렬함. `baseStats`, `sourceUrl`, `matchedConditions`, `supportingEvidenceIds`를 반환함. 실제 UI는 해석 조건과 미확인 제외 수를 표시하고 항목 선택으로 원문 상세를 연결함.
- 현재 확보된 100종은 한 번에 표시함. API는 페이지를 지원하지만 프론트엔드의 도감·탐색은 첫 100종, 대화 목록도 최신 100개까지 표시함. 메시지는 모든 페이지를 읽음. 대규모 카탈로그 확장 시 목록 페이지 UI를 추가해야 함.

## 전체 도감·이미지 보완 (2026-10-21)

이 절은 앞의 초기 100종 표시 제한을 대체함. 도감과 조건 검색은 100개 단위로 “더 보기”를 제공하며 전체 항목에 접근함. 대화 목록은 기존처럼 최신 100개이며 메시지는 모든 페이지를 읽음. 조건 검색은 동일한 질문·규칙·도감 스냅샷·프롬프트·모델 설정의 구조화 해석을 캐시해 다음 페이지에서 모델을 다시 호출하지 않음. 정확한 속성 조건은 매번 실제 자료에 대조함.

- `PokemonSummary`·상세·조건 검색 항목에 `speciesId`, `isDefault`, `formIdentifier`, `images` 추가.
- `pokemonId`는 pokemon 리소스 ID, `speciesId`는 여러 폼이 공유하는 종 ID임. 기존 기본 종의 ID와 대화는 유지함.
- `images`: `artworkUrl`, `spriteUrl`, `sourceUrl`, `rightsNotice`, `checkedAt`, `availability:checked_on_display`. 주소가 항상 존재한다고 보증하지 않으며 화면에서 실패를 처리함. 이미지 URL이 없어도 포켓몬 선택·대화는 가능함.
- `/api/status`의 `metadataCount`는 종·별도 폼을 합한 항목 수, `speciesCount`는 고유 종 수, `alternateVarietyCount`는 기본 폼 이외 항목 수임.
- 종별 설명은 폼 사이에서 공유할 수 있지만 각 폼의 타입·능력치·특성은 선택한 폼의 메타를 사용함. 별도 폼 수록과 Champions 적격성은 별개임.

## Phase 3 실행 계약

- 팀 CRUD 및 분석은 기존 익명 세션 필요. 모델 키·벡터 색인 준비 여부와 독립 실행.
- POST/PUT 팀 본문: `{name, members}`. 멤버: `{pokemonId, moves, hpPercent, item, ability}`. 기술: `{name, type, category}`.
- 초안은 0–6마리, 기술 0–4개 허용. 빈 팀 이름·알 수 없는 ID·타입·0–100 밖의 HP·같은 종의 중복은 422. 폼이 달라도 종 ID 기준 중복 검사.
- GET `/api/teams`: `{items,total}`. 생성 201, 조회·갱신 200, 삭제 204(본문 없음). 타 세션 자원은 404, 유효 세션 없으면 401.
- POST `/api/teams/analyze`: `{own,opponent}`. 각각 1–6마리. 멤버별 `coverage`, `defense`, `sharedWeaknesses`, `roleGaps` 반환.
- POST `/api/teams/select`: 양쪽 6마리 필수, 쓰러진 멤버 입력 거부. `candidateCount=20`, `scoreKind=heuristic_not_probability`, `candidates`와 점수 구성 반환. 합법 판정·승률 아님.
- POST `/api/battle/analyze`, `/api/battle/recommend`: 동일 타입 비교 결과. 팀 본문에 `ownActive`, `opponentActive`(0부터 시작), `opponentAttackTypes`, `megaUsed`, `megaTargetId`, `switchBlocked` 추가 가능. 상태 boolean 생략 시 null/미확인.
- 전투 결과: `options`의 공격/교체별 `comparisonOrder`, `multiplier`, `reason`, `risks`; 메가 `status`, `reason`, `typeComparison`. `recommendedAction=null`, `recommendationStatus=insufficient_battle_information` 유지.
- 계산 공통: `scope=generic`, `regulationId=null`, `facts`, 문자열 배열 `assumptions`·`unknowns`, 출처 배열 `citations`, `calculation.status=type_only`. `damage`, `koProbability`, `winProbability`는 null. 기존 RAG `GroundedResult`와 별도 타입.
- 타입 자료 누락은 `TYPE_CHART_NOT_READY` 503. 잘못된 슬롯·중복 종·6마리 미충족·미지원 폼은 안전한 422, 도감 ID 없음은 404.
- 상세 구현과 미지원 조건은 [전투 계산 구현](../../backend/app/battle/engine.py) 참조. 앞의 설계 예시와 이 실행 계약이 다르면 본 절 및 실행 중 OpenAPI 우선.

## Phase 4 검색 설정 응답

`GET /api/status` 및 채팅·가이드 결과의 `retrieval` 필드 추가
저장 메시지에서도 실제 실행 시점 설정 복원 가능

```json
{
  "searchMode": "mmr",
  "topK": 6,
  "mmrFetchK": 30,
  "mmrLambdaMult": 0.5
}
```

- 검색 방식은 서버 환경변수로 설정, 요청별 임의 설정 변경 없음
- 원시 임베딩·DB 연결 문자열·서버 경로는 API 응답에 포함하지 않음
- 기존 답변·인용·페이지 조회 필드 유지, 기존 메시지에 `retrieval`이 없을 수 있음
- [검색 비교 명령](../../backend/scripts/compare_retrieval.py) 참조

## 참조 데미지 계산 API

- `POST /api/battle/damage`, 기존 세션 필요, 모델 키·벡터 색인과 독립 실행
- `backend/calculator` 의존성 설치와 Node.js 필요, 미설치·버전 불일치는 `DAMAGE_ENGINE_NOT_READY` 503
- 계산 엔진: `@smogon/calc 0.12.0`·Champions `generation=0`·참조 레벨 50, SV 모드로 대체 없음
- 싱글·명중·단일 타격·비급소·효과 없는 시나리오만 지원, `neutralConditions=true` 명시 필수
- 특성·도구·상태·필드·능력치 변화 및 기술의 부가 효과·반동·후속 턴 계산 제외, 관련 추가 필드 요청은 422

```json
{
  "attacker": {
    "pokemonId": "pokemon:25",
    "statPoints": {"hp": 0, "attack": 0, "defense": 0, "spAttack": 32, "spDefense": 0, "speed": 0},
    "alignment": "Hardy"
  },
  "defender": {
    "pokemonId": "pokemon:9",
    "statPoints": {"hp": 0, "attack": 0, "defense": 0, "spAttack": 0, "spDefense": 0, "speed": 0},
    "alignment": "Hardy"
  },
  "move": "Thunderbolt",
  "neutralConditions": true
}
```

- `statPoints`는 6개 필드 모두 필요, 각 값 정수 0–32·합계 66 이하, 본가 EV·IV·레벨 입력과 구분
- `alignment`는 참조 엔진의 25개 영문 정렬 식별자, 허용 값은 Swagger 스키마 참조
- 기술: Tackle·Body Slam·Thunderbolt·Flamethrower·Surf·Ice Beam·Psychic·Shadow Ball·Energy Ball·Dragon Claw·Crunch·Earthquake
- 미등록 도감 ID는 404, 엔진 미지원 종/폼·기술은 `DAMAGE_UNSUPPORTED_INPUT` 422, 잘못된 육성·조건은 422
- 응답: `scope=champions_reference_scenario`, `verificationStatus=assumed`, `inGameVerified=false`, `legalityVerified=false`
- `engine`에 이름·버전·generation·level, `inputs`에 요청 조건, `calculation.damage`에 최소/최대·16개 정수 피해값·양측 참조 능력치·기술 속성 포함
- `defenderCurrentHp`: 선택 입력, 1 이상의 정수 실수치 HP, null·생략 시 참조 최대 HP 가정
- 계산된 방어자 최대 HP 초과 시 `DAMAGE_HP_OUT_OF_RANGE` 422, 0·소수·문자열·불리언 거부
- `calculation.conditionalKo`: `currentHp`·`maximumHp`·`hpBasis`(`provided`/`full_hp_assumed`)·`qualifyingRolls`·`totalRolls`·`outcome`(`all`/`some`/`none`)·`scope=single_hit_reference_candidates`
- 조건부 KO 비교식: 피해 후보 >= 기준 HP인 후보 개수 / 전체 16개 후보, 중복 피해값도 각각 보존
- `calculation.status=reference_scenario`, `koProbability`·`winProbability`는 null 유지, 후보 개수를 실제 확률로 변환하지 않음
- 타입 무효는 16개 0으로 반환, 미지원 출력은 성공으로 변환하지 않음
- 5초 실행 제한, 시간 초과는 `DAMAGE_ENGINE_TIMEOUT` 504, 원본 stderr·서버 경로·환경 키는 응답 제외
- 출력 수치는 고정 참조 엔진의 계산 결과, 실제 게임 실측·레귤레이션 합법성·기술 습득 확인과 구분

## 대화형 전투 상태와 조건부 판단

- 기존 `POST /api/chat`에서 전투 질문의 명시적 입력 변경분을 해석, 대화 ID별 전투 상태를 PostgreSQL에 보관
- 상태 항목: 내/상대 포켓몬·명시한 HP 비율·보유 기술 이름·명시한 공격 타입·특성·도구·교체 후보·교체 봉쇄·방어 타입 변경 요청
- 도감 선택이나 포켓몬 이름만으로 편·기술·아이템·공격 타입을 추정해 채우지 않음
- 후속 입력은 기존 상태와 병합, 능동 포켓몬 교체 시 이전 포켓몬의 HP·기술·도구 등 제거, 명시적 초기화·정보 정정 지원
- 사용자·대화 범위 검증 후 상태 조회, 메시지 저장과 상태 갱신은 같은 DB 트랜잭션으로 처리
- 결과의 `battleContext`에 입력 상태·일반 타입 배율·조건부 추천 방향·가정·추가 질문 포함
- 계산은 `sourceType=calculation` 근거로 전략 검색 결과와 함께 생성에 전달, 모델 유보 시에도 검증된 계산 입력에 한정한 조건부 설명 제공
- `probability=null` 유지, 타입 배율을 피해·생존·승률·추천 확률로 표시하지 않음
- `requestedDefensiveType`는 실제 테라 발동이 아닌 단일 방어 타입 가정 비교, 게임 지원·기술 보유와 구분
- 도감 화면은 기존 상세 API 사용 유지, 선택 메타를 챗봇 근거에 포함하는 과제 조건 유지

## 도감 기본 질문 바로 답변

- 기존 `POST /api/chat`에서 명시적인 타입·종족값·특성 이름·도감 설명·등록 기술 목록 질문은 로컬 도감에서 직접 응답
- 응답의 `feature=catalog_reference`·`answerPath=catalog_direct`, 기존 비동기 작업·대화 기록·원자료 인용 형식 유지
- 도감 전용 경로는 외부 문서 수집·벡터 검색·모델 호출 없음, 모델 키·메타 색인 준비 검사도 제외
- 전략·상성 비교·육성·추천·특성 활용 등 혼합 질문은 기존 RAG·계산 경로 유지
- 없는 설명·기술 목록은 미등록으로 안내, 모델로 보충하거나 현재 보유·현행 적격성으로 해석하지 않음
- 도감 화면은 기존 상세 API 사용 유지

### 대화형 조회·계산·전략 결합

- 명시한 내 기술·상대 공개 기술을 로컬 기술 메타데이터와 연결하여 타입·분류 조회
- `battleContext.knownMoves`: 사용자 보유 주장과 원본 기술 정보의 결합, 현행 게임 습득 적격성 검증과 구분
- `battleContext.switches`: 교체 후보별 공격 타입 배율·HP·타입 저항 기준 공동 비교 순서 제공, HP 0% 후보 제외
- `battleContext.preferredSwitchIds`: 현재 포켓몬보다 최대 피격 타입 배율이 낮은 최상위 후보, 실제 생존·최선 행동 순위와 구분
- 상대 HP·특성·도구·공개 기술·명시된 누적 공격 및 스피드 랭크를 대화 상태에 유지, 상대 변경 시 기존 상대 입력 초기화
- 후보별 HP 후속 입력은 해당 후보만 갱신하고 다른 후보 상태 유지
- 선택 포켓몬과 다른 대면 상대의 자료도 수집하여 전략 검색에 연결
- `battleContext.damageComparisons`: 양측 전체 육성 포인트·성격·기술·중립 참조 조건이 명시된 경우 기존 참조 계산기 결과 포함, 누락값 자동 보충 없음
- 상대 능력치 변화 입력과 중립 참조 조건이 충돌하면 피해 계산 제외, 조건 미입력 시 타입 시나리오와 추가 질문 제공


### 도감과 독립된 대화 및 초기화

- 도감 선택은 상세 정보만 변경, 대화 ID·기록·입력 초안 유지
- 새 대화 요청은 `{}` 허용, 초기화는 새 ID 생성과 초안 비우기로 처리
- 이전 기록은 전체 대화 목록에서 복원, 전투 상태는 새 ID로 분리
- 도감의 근거 운용 가이드 버튼 제거, 기존 가이드 API와 저장된 응답 표시 호환 유지

### 챗봇의 6대6 선출 비교

- `battleContext.state.ownTeamIds`·`opponentTeamIds`: 명시한 양쪽 엔트리, 각 6마리
- `battleContext.scope=generic_team_selection`: 준비된 타입표로 선출 20조합 평가, 상위 3개 후보와 후보별 선봉을 계산 근거에 포함
- `battleContext.selection.scoreKind=heuristic_not_probability`: 공격 커버·수비 대응·중복 약점 기반 비교 점수, 승률과 구분
- 6마리 미충족·중복 종은 선출을 생성하지 않고 입력 확인 요청
- 상대 팀 변경 질문은 내 엔트리를 유지하고 상대 엔트리를 갱신한 뒤 재평가
- 선출 질문은 준비된 로컬 자료와 RAG 색인을 사용하여 질문마다 외부 문서 수집을 반복하지 않음
- 현재 선봉·상대와 공격을 질문하면 선출 모드에서 대면 비교로 전환
