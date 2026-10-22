# PostgreSQL + pgvector 저장·검색 통합

변경일: 2026-10-22 (Asia/Seoul)

## 구현

| 원인 | 수정 | 결과 |
|---|---|---|
| 상태 저장에 SQLite 사용 | PostgreSQL·psycopg로 교체 | 세션·대화·팀·작업·캐시를 PostgreSQL에 저장함 |
| SQLite 전용 SQL·행 순서 사용 | 매개변수·upsert·identity `seq` 적용 | 기존 API·대화 순서·세션 소유권 유지함 |
| 동시 작업 요청·상태 갱신 경합 | 트랜잭션 advisory lock·`FOR UPDATE` 적용 | 동일 요청 ID 중복 생성과 상태 덮어쓰기 방지함 |
| 이전 색인의 완료 캐시 재사용 위험 | 읽기 전용 이전·manifest/완료 캐시 제외·원문 재색인 | 실제 PostgreSQL 벡터 청크 확인 후 PostgreSQL에 완료 상태 생성함 |

| 저장 대상 | 저장소 |
|---|---|
| 세션·대화·메시지·팀·작업·캐시·원문·manifest | PostgreSQL의 `sessions`, `conversations`, `messages`, `teams`, `jobs`, `cache` |
| 포켓몬 메타·문서 청크·임베딩 | PostgreSQL `vector_collections`·`vector_entries`의 `pokemon_meta`·`pokemon_docs` 논리 컬렉션 |
| 도감·출처·규칙 기준 스냅샷 | `data/` JSON |

- 원본 PDF 5쪽의 Chroma 지정은 확인된 사실임. 사용자가 PostgreSQL + pgvector 통합을 선택함. 과제 측 대체 허용 확인과 구분함.
- 기존 `runtime/embedding_model` 캐시 재사용함. ChromaDB·langchain-chroma 의존성과 런타임 저장 경로 제거함.
- 메타데이터는 JSONB 동등 필터, 벡터는 `<->` 정확 L2 검색 적용함. 모델·차원 불일치와 비유한 벡터 입력 거부함.
- `docs/design/PROJECT_SPEC.md`, `AGENTS.md`, README, 아키텍처·요구사항 문서의 저장 기술 갱신함.

## 실행

`.env.example`을 참고해 다음 항목 설정 필요함:

- `POSTGRES_PASSWORD`: 로컬 Compose DB 비밀번호.
- `DATABASE_URL`: 같은 사용자·비밀번호·포트·DB로 구성한 연결 URL. 비밀번호의 예약 문자는 URL 인코딩 필요함.
- `DATABASE_SCHEMA`: 기본 `poketact`. 소문자 영문·숫자·밑줄 사용함.
- `RUNTIME_DIR`: 기본 저장소의 `runtime`. 로컬 임베딩 모델 캐시 경로임. 벡터 데이터는 PostgreSQL에 저장함.
- 기존 모델 공급자 설정 유지함. DB 연결 문자열은 설정 객체의 `repr`에서 제외함.

```bash
docker compose up -d --wait postgres
uv sync --python 3.12 --frozen --group dev
uv run --frozen python -m backend.scripts.index_data
uv run --frozen uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

- 기존 PostgreSQL 사용 시 Compose 시작 생략 가능함. UTF-8 DB·pgvector 설치·스키마 생성 권한 필요함. `CREATE EXTENSION vector WITH SCHEMA public` 실행 권한 또는 관리자의 사전 확장 생성 필요함.
- Compose DB는 `127.0.0.1`에만 노출함. named volume에 데이터 유지함.
- Compose는 pgvector 포함 PostgreSQL 이미지를 사용함. 별도 벡터 DB 서비스 불필요함.
- 앱 모듈 import는 DB 연결을 수행하지 않음. 실제 서비스 초기화는 FastAPI lifespan에서 수행함.

## 기존 데이터 이전

기존 서버를 중지하고 빈 PostgreSQL 스키마를 대상으로 **색인 전에** 실행 필요함:

```bash
uv run --frozen python -m backend.scripts.migrate_sqlite runtime/state.sqlite3
uv run --frozen python -m backend.scripts.index_data
```

- SQLite는 읽기 전용 연결·단일 읽기 스냅샷으로 처리함. 원본 파일 삭제·수정 없음.
- 대상 상태 테이블 또는 벡터 색인에 데이터가 존재하면 이전 거부함. 복사는 하나의 PostgreSQL 트랜잭션으로 처리함.
- 세션·대화·메시지·팀·작업·원문/HTTP 캐시 이전함. 메시지와 대화는 SQLite 삽입 순서 보존함.
- 이미 PostgreSQL 상태 저장을 사용 중이면 SQLite 이전을 다시 실행하지 않고 `index_data`만 실행함. 기존 캐시·원문에서 새 벡터 색인 구성 가능함.
- `manifest`·`query_complete` 캐시는 제외함. `index_data`가 기준 JSON과 이전한 `document` 원문 캐시로 pgvector 색인을 검증·재구축함.
- 이전된 원문은 번들 JSON 색인 전에 읽어 보존하고 번들 색인 후 재적용함.
- 앱 재시작 시 `queued`·`running` 작업은 기존 동작과 동일하게 `interrupted` 복구함.
- 이전 도구 재실행 시 데이터 덮어쓰기 없음. 새 `DATABASE_SCHEMA`를 지정한 별도 이전 필요함.

## 검증

```bash
POKETACT_TEST_DATABASE_URL="$DATABASE_URL" uv run --frozen pytest -q
uv run --frozen ruff check backend
uv run --frozen ruff format --check backend
```

- 테스트마다 고유 PostgreSQL 스키마 사용함. 종료 시 해당 PostgreSQL 스키마만 삭제함.
- 테스트 계정에 스키마 생성·삭제 권한 필요함.
- `POKETACT_TEST_DATABASE_URL` 미설정 시 DB 의존 테스트는 명시적으로 skip 처리함. skip을 통과로 집계하지 않음.
- PostgreSQL 18 + pgvector 0.8.1에서 전체 회귀 테스트 53개 통과함. 동시 요청·SQLite 이전·롤백·대화 순서·세션 격리·팀 CRUD·벡터/manifest 재시작 복원·거리/필터/차원 검증·기존 색인 이전 거부·이전 원문 버전 보존 검증함.
- 실제 메타 1,351건·문서 청크 3,505건 색인·근거 6건 검색·API 상태 조회 확인함. 원본 SQLite 해시 동일함.
- Ruff 검사·포맷 검사·Git 공백 검사·uv 잠금 파일 정합성 검사 통과함.
- 현재 통합 구성은 [벡터 저장소](../../backend/app/rag/vector_store.py), 저장·이전 동작은 [PostgreSQL 테스트](../../backend/tests/test_postgresql.py) 참조

## 한계

- 기존 단일 FastAPI 프로세스 운영 범위 유지함. 다중 워커의 수집·작업 복구는 미지원임.
- 상태·벡터는 같은 DB이지만 청크 배치·원문·manifest를 개별 트랜잭션으로 게시함. manifest 대조·재실행으로 중간 실패 복구함.
- HNSW·IVFFlat 근사 색인 미도입임. 규모 증가 시 실측 후 도입 검토 대상임.
- 운영 `.env`·실제 DB 연결은 자동 변경하지 않음. 검증은 별도 임시 DB에서 수행함.
- Compose의 Docker 실행·새 모델 다운로드·모델 공급자 실제 호출·브라우저 화면 재검증은 미실행임.

## 출처·라이선스

확인일: 2026-10-22 (Asia/Seoul)

- [Psycopg 공식 문서](https://www.psycopg.org/psycopg3/docs/): 연결·행 사전·트랜잭션·SQL 매개변수 참고함. 배포 패키지 라이선스 원문 유지함.
- [pgvector 공식 문서](https://github.com/pgvector/pgvector): PostgreSQL License. 벡터 타입·L2 거리·정확 검색·Docker 구성 참고함.
- [all-MiniLM-L6-v2 모델 카드](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): Apache-2.0 모델, 영어 중심·384차원임.
- [ONNX export 프로젝트](https://github.com/chroma-core/onnx-embedding): Apache-2.0 프로젝트. 기존 로컬 모델 캐시 재사용함. 배포 URL의 Chroma 명칭은 모델 호스팅 주소이며 ChromaDB 런타임 의존성과 구분함.

- 모델 신규 다운로드는 SHA-256 `913d7300ceae3b2dbc2c50d1de4baacab4be7b9380491c27fab7418616a16ec3` 검증 후 정규 파일 두 개만 추출함.
