# PokeSettle 제품·구조·API 기준

정리일: 2026-11-11 KST · 현재 저장소 구현 기준, 운영 배포 여부와 별개임

- 목적: Pokémon Champions 랭크 싱글 준비·복기를 위한 근거 기반 전략 안내
- 우선순위: 현재 사용자 요청과 운영의 사용성·신뢰성·보안·비용·유지보수성
- 문서 역할: 제품 범위·모듈 책임·데이터 흐름·API 사용 규약을 이 문서에 통합함
- 설치는 [README](../../README.md), 운영은 [운영 지침](../guides/OPERATIONS.md), 출처·라이선스는 [데이터 출처](../guides/DATA_SOURCES.md) 참조
- 초기 Phase 계획·실험·작업 이력·학습 내용은 Git 제외 로컬 `docs/private/LEARNING_GUIDE.md`에서 관리함

## 제품 범위와 판단 기준

| 기능 | 현재 동작 | 판단 범위 |
| --- | --- | --- |
| 도감 | 이름·타입 검색, 종족값·특성·기술·번역·출처 조회 | 일반 원본 자료이며 Champions 참가·습득 가능 판정과 구분함 |
| 전략 챗봇 | 대화 기록과 입력 상태에 따라 도감 안내·상성 계산·RAG 선택 | 출처와 계산이 지지하는 내용만 설명함 |
| 자연어 조건 검색 | 조건을 구조화하고 전체 도감 필드로 검사함 | 명시한 수치·타입 등 지원 조건만 처리, 모호한 조건은 재질문함 |
| 팀·선출 | 팀 저장, 양쪽 6마리 중 3마리 조합 20개 비교, 선봉 후보 제시 | 일반 타입 기반 휴리스틱이며 승률·합법성 판정 아님 |
| 대면·피해 계산 | 타입별 공격·교체 후보와 지원 입력의 참조 피해 계산 | 타입 상성과 실제 생존·KO·승률 구분, 미지원 효과 추론 제외 |
| 메타 | 외부 사용률·세팅·출처·기준일 표시 | 사용률과 승률·현재 참가 가능 여부 구분함 |
| 보조 화면 | 포BTI·관동 수집 도감 | 성격 판정·공식 게임 기록·서버 보장 수집 데이터와 구분함 |

- `verified`·`assumed`·`unknown`을 근거의 확인 범위와 함께 관리함. 사용자 진술은 게임 규칙의 공식 검증과 구분함
- 출처의 게임·포맷·수집일을 보존하며 다른 게임·더블 자료를 Champions 싱글의 확정 사실로 변환하지 않음
- 현재 레귤레이션·종·폼·기술·도구의 적격성은 확인한 자료가 있을 때만 판정함. 특정 규칙 ID·기간을 현행으로 고정하지 않음
- 미입력 HP·기술·특성·도구·육성 수치 임의 생성, 휴리스틱의 확률 표기, 근거 없는 승리·피해량 단정 금지함

## 구성 요소와 책임

| 영역 | 코드 | 책임 |
| --- | --- | --- |
| 프런트 | [`frontend/src/app`](../../frontend/src/app/), [`features`](../../frontend/src/features/) | Next.js App Router·React·TypeScript·Tailwind UI, 서버 렌더링과 클라이언트 상태 분리 |
| API | [`backend/app/api`](../../backend/app/api/), [`main.py`](../../backend/app/main.py) | FastAPI 요청 검증·응답 모델·세션 의존성, 서비스 초기화·종료 |
| 채팅 서비스 | [`services/knowledge.py`](../../backend/app/services/knowledge.py) | 질문 종류·대화 주제·입력 상태·수집·RAG·저장 연결 |
| 작업 실행 | [`services/job_queue.py`](../../backend/app/services/job_queue.py), [`worker.py`](../../backend/app/worker.py) | PostgreSQL 대기열·작업 소유권·heartbeat·비동기 실행 |
| 검색·생성 | [`rag`](../../backend/app/rag/) | 로컬 ONNX 임베딩·pgvector·청킹·검색·LangGraph·구조화 생성·인용 검증 |
| 계산 | [`battle`](../../backend/app/battle/), [`backend/calculator`](../../backend/calculator/) | LLM과 분리된 일반 타입·선출·참조 피해 계산 |
| 수집 | [`data_preparation`](../../backend/app/data_preparation/), [`backend/scripts`](../../backend/scripts/) | 등록 출처 조회·원문 캐시·기준 데이터 준비·색인 |
| 저장 | [`storage.py`](../../backend/app/storage.py), [`core/usage.py`](../../backend/app/core/usage.py) | 세션·대화·팀·작업·캐시·사용량의 DB 정합성 |
| 테스트 | [`test`](../../test/) | Python·Playwright·AWS 테스트와 합성 API·검사 설정 |

- 프런트 의존성·버전은 `frontend/package.json`과 잠금 파일, 백엔드는 `pyproject.toml`·`uv.lock` 기준임
- 개발용 내장 worker와 운영의 API·worker 별도 프로세스를 지원함. 실제 동시 처리 능력은 설정값만으로 보장하지 않음
- 데이터 저장·검색·전투 계산·모델 설명의 책임을 분리하며 API 키와 DB 자격증명은 서버에만 보관함

## 데이터와 RAG

| 저장 대상 | 위치·구조 |
| --- | --- |
| 도감·번역·기술·타입·출처 스냅샷 | `data/pokemon.json`, `pokemon_names.json`, `catalog_details.json`, `battle_names.json`, `type_chart.json`, `sources.json` |
| 준비한 설명·전략 | `data/documents/species.json`, `data/strategy/notes.json` |
| 개인 상태·작업·캐시 | PostgreSQL `sessions`, `conversations`, `messages`, `teams`, `jobs`, `cache`, `job_queue`, `job_workers` |
| 사용량·예약·실행 슬롯 | PostgreSQL 사용량 집계·예약·lease 테이블 |
| 검색 벡터 | PostgreSQL `vector_collections`·`vector_entries`의 `pokemon_meta`·`pokemon_docs` 논리 컬렉션 |
| 로컬 모델·검증 산출물 | Git 제외 `runtime/`, 개인 학습 기록은 `docs/private/` |

- 내부 Python 필드는 snake_case, API 응답은 camelCase로 직렬화함. 종 ID와 폼의 Pokémon 리소스 ID 구분함
- `pokemon_meta`는 항목별 검색 텍스트, `pokemon_docs`는 항목과 연결된 문서 청크임. 같은 원문도 항목 연결을 구분해 저장함
- `all-MiniLM-L6-v2` ONNX 임베딩 사용, 모델 identity·차원 불일치와 비유한 벡터 거부함
- 원문·청킹 설정으로 색인 버전을 구분하고 manifest로 활성 청크를 확인함. 재색인 시 이전 버전 청크 정리함
- PostgreSQL JSONB 범위 필터·정확 L2 검색 사용, `SEARCH_MODE=mmr` 선택 시 후보의 관련도와 중복을 함께 고려함
- 관련 메타데이터와 문서를 총 Top-k 안에서 결합함. 검색된 근거와 답변에 실제 인용한 근거 구분함
- `CHUNK_SIZE`·`CHUNK_OVERLAP`·`TOP_K`·MMR 기본값·시간 제한은 [`core/config.py`](../../backend/app/core/config.py)와 `.env.example` 기준임

```text
기준 JSON·등록 출처 → 원문 캐시 → 청킹·임베딩 → pgvector

질문 → 세션·작업 접수 → worker → 질문·입력 상태 해석
  ├─ 기본 도감 조회 → 도감 링크·정형 정보
  ├─ 대면·선출 → 결정적 계산 → 근거 검색 → 계산 설명·필요한 보충 설명
  └─ 일반 전략 → 필요한 출처 수집·색인 → 근거 검색 → 근거 기반 생성
                                              ↓
                              인용 검증 → 답변·근거·대화 상태 저장
```

- 등록된 출처만 수집함. 일반 종별 질문의 검색 계획·후보 선택은 가능한 경우 로컬 처리하고 모호한 조건은 모델 해석을 사용함
- LangGraph 경로는 `START → retrieve → generate → END`임. `generate` 단계가 계산 답변을 직접 반환할 수 있어 그래프 실행과 답변 생성 모델 호출 수는 같지 않음
- 모델은 구조화된 주장과 근거 ID를 반환함. 서버가 유효 ID·인용·원문 버전을 검사하고 실제 사용한 출처만 표시함
- 근거 부족 시 부분 답변·유보를 허용함. 문서에 포함된 명령은 자료로 취급함
- 대화 이력은 해석용이며 현재 사실의 출처가 아님. 개인 대화·팀은 공용 벡터 자료에 자동 색인하지 않음
- 자연어 조건 검색은 해석 결과를 캐시하며, 유사도 후보 일부만 검사해 정확 조건의 전체 결과로 표시하지 않음

## 전투 입력과 답변

- 명시한 입력만 전투 상태에 반영하고 원문 인용으로 확인함. 포켓몬이 바뀌면 이전 멤버의 HP·기술·특성·도구를 이어받지 않음
- 선출 점수는 약점 공략 상대 수·모든 가정 공격을 반감하는 대응·중복 약점을 비교함. 정확한 식은 [`battle/engine.py`](../../backend/app/battle/engine.py), 기본 답변에는 계산식·점수·동점 처리 설명 제외함
- 기본 답변 순서: 추천 3마리·선봉 → 멤버별 공략·반감 대응 이유 → 실제 기술·특성·도구 추가 안내
- 기술 미입력 멤버는 자기 타입 공격을 가정함. 습득 가능 기술 전체를 실제 보유 기술로 취급하지 않음
- 멤버별 입력 기술은 로컬 자료의 타입·분류로 해석해 다시 계산함. 특성·도구는 입력을 보존하고 근거가 있을 때 보충 설명함. 효과를 타입 점수에 계산한 것으로 표시하지 않음
- 참조 피해 계산의 지원 기술·중립 조건·필수 육성 입력은 [`battle/damage.py`](../../backend/app/battle/damage.py)·[`calculate.cjs`](../../backend/calculator/calculate.cjs) 기준임. 불완전한 입력을 임의 기본값으로 채우지 않음

## 화면·URL·캐시 경계

- 기본 영어 `/`, 한국어 `/ko`, 일본어 `/ja`, 중국어 `/zh` 사용함. 기능 경로는 `/chat`·`/pokedex`·`/meta`·`/scenario`·`/pobti`임
- 도감·메타 상세는 공통 영문 슬러그, 번역 이름은 표시용임. 기존 주소의 308 연결·없는 ID의 404는 [`proxy.ts`](../../frontend/src/proxy.ts)에서 처리함
- 이름 스냅샷으로 라우트 인덱스를 빌드 시 생성하고 ID·slug 중복을 검사함. canonical·언어 대체 링크·사이트맵은 같은 라우트 자료 사용함
- 도감 본문·기술 카드·메타 자료·날짜·출처는 서버에서 렌더링하고 검색·필터·교체 입력 등 상호작용은 클라이언트가 처리함
- 공개 도감·메타 GET은 Next.js 데이터 캐시 사용, 개인 세션 쿠키 전달 제외함. 메타의 기준일·stale 정책은 별도로 적용함
- 개인 대화·팀은 요청별 QueryClient와 `no-store` 사용, 기존 세션의 초기 데이터를 하이드레이션함. 세션 없는 방문·조회 실패는 기존 클라이언트 경로로 복구함
- 언어·테마·수집 도감의 브라우저 저장과 서버 DB 저장은 구분함. 클라이언트 수집 기록의 조작 방지를 보장하지 않음
- CloudFront·Nginx·서버 캐시 설정과 실제 배포 절차는 운영 지침에서만 관리함

## API 사용 규약

- 실제 경로·필드·제약의 기준: [`라우터`](../../backend/app/api/routers/)·[`요청 모델`](../../backend/app/schemas.py)·[`응답 모델`](../../backend/app/api/schemas.py)·실행 중 [Swagger UI](http://127.0.0.1:8000/docs)
- 공통 접두사 `/api`, UTF-8 JSON, 문자열 ID 사용함. 시각은 API·저장에서 UTC 기준, 표시 시 지역 시간으로 변환함
- 성공 봉투는 `data`·`requestId`·`warnings`, 실패는 `error`·`requestId` 사용함. 오류는 안전한 코드·메시지·재시도 여부·필드 정보만 반환함
- `null`과 빈 목록을 구분함. 성공 HTTP 상태와 AI 답변의 `answered/partial/abstained` 상태 구분함
- `POST /api/session`에서 `pokecoach_session` 쿠키 생성·재사용, 개인 대화·작업·팀은 유효 세션과 소유권 검사함
- 변경 요청은 허용 Origin을 검사함. 익명 세션·CORS·원본 인증을 사용자 계정 인증으로 해석하지 않음

| 메서드 | 경로 | 역할·응답 |
| --- | --- | --- |
| GET | `/api/status`, `/api/regulations` | 준비 상태·알려진 규칙 스냅샷, 200 |
| POST | `/api/session` | 세션 유지·생성, 200 |
| GET | `/api/pokemon`, `/api/pokemon/{pokemon_id}` | 목록·상세, 200 |
| POST | `/api/pokemon/search` | 자연어 조건 검색, 200 |
| GET | `/api/meta/singles` | 외부 싱글 메타, 200 |
| POST | `/api/conversations` | 새 대화, 201 |
| GET | `/api/conversations`, `/api/conversations/{conversation_id}/messages` | 대화·메시지 목록, 200 |
| DELETE | `/api/conversations/{conversation_id}` | 소유 대화·메시지·전투 상태 삭제, 204 |
| POST | `/api/chat`, `/api/documents/collect`, `/api/pokemon/{pokemon_id}/guide` | 작업 접수, 202·Location |
| GET | `/api/jobs/{job_id}` | 작업 상태·결과·안전한 오류, 200 |
| GET·POST | `/api/teams` | 팀 목록 200·생성 201 |
| GET·PUT·DELETE | `/api/teams/{team_id}` | 조회·갱신 200·삭제 204 |
| POST | `/api/teams/analyze`, `/api/teams/select` | 일반 팀 상성·선출 비교, 200 |
| GET | `/api/battle/damage/moves/{pokemon_id}` | 참조 계산용 기술·지원 여부, 200 |
| POST | `/api/battle/analyze`, `/api/battle/recommend`, `/api/battle/damage` | 대면·행동·참조 피해 계산, 200 |

- 채팅 요청: `question`·UUID `clientRequestId` 필수, `conversationId`·`pokemonId`·`regulationId` 선택임
- 같은 세션·종류·요청 ID·본문은 기존 작업을 반환함. 같은 ID에 다른 본문은 409, 의도적 재시도는 새 요청 ID 사용함
- 접수 응답은 `jobId`·`status`·`statusUrl`, 조회 결과는 `status`·`stage`·`result`·`error`·`queuePosition` 등을 반환함
- 작업 상태는 `queued/running/completed/failed/interrupted`, 완료와 AI 답변의 정확성·완전성은 별개임
- worker는 claim·heartbeat로 소유권 유지, 만료 작업은 안전하게 중단하고 유료 모델 호출을 자동 재실행하지 않음
- `/api/status`는 프로세스 접속 가능 여부와 모델·색인·worker 준비 상태를 구분함. 모델 설정 여부만으로 공급자 호출 성공을 보장하지 않음
- SSE `/api/chat/stream`은 구현 경로가 아님. 클라이언트는 접수한 작업을 polling함
- 호출 한도·예산·시간 제한·서버 설정은 운영 지침에만 기재함. 요청·응답의 모든 예시와 초기 설계를 별도 문서로 복제하지 않음
