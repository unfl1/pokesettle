# PostgreSQL 상태 저장 전환

변경일: 2026-10-22 (Asia/Seoul)

## 구현

| 원인 | 수정 | 결과 |
|---|---|---|
| 상태 저장에 SQLite 사용 | PostgreSQL·psycopg로 교체 | 세션·대화·팀·작업·캐시를 PostgreSQL에 저장함 |
| SQLite 전용 SQL·행 순서 사용 | 매개변수·upsert·identity `seq` 적용 | 기존 API·대화 순서·세션 소유권 유지함 |
| 동시 작업 요청·상태 갱신 경합 | 트랜잭션 advisory lock·`FOR UPDATE` 적용 | 동일 요청 ID 중복 생성과 상태 덮어쓰기 방지함 |
| 이전 색인의 완료 캐시 재사용 위험 | 읽기 전용 이전·manifest/완료 캐시 제외·원문 재색인 | 실제 Chroma 청크 확인 후 PostgreSQL에 완료 상태 생성함 |

| 저장 대상 | 저장소 |
|---|---|
| 세션·대화·메시지·팀·작업·캐시·원문·manifest | PostgreSQL의 `sessions`, `conversations`, `messages`, `teams`, `jobs`, `cache` |
| 포켓몬 메타·문서 청크·임베딩 | 로컬 ChromaDB `pokemon_meta`·`pokemon_docs` |
| 도감·출처·규칙 기준 스냅샷 | `data/` JSON |

- PDF 5쪽의 `langchain-chroma 1.1.0`·`ChromaDB 1.5.9` 지정 유지함.
- 기존 `runtime/chroma`·`runtime/embedding_model` 사용함. pgvector 확장 설치 불필요함.
- `PROJECT_SPEC.md`, `AGENTS.md`, README, 아키텍처·요구사항 문서의 저장 기술 갱신함.

## 실행

`.env.example`을 참고해 다음 항목 설정 필요함:

- `POSTGRES_PASSWORD`: 로컬 Compose DB 비밀번호.
- `DATABASE_URL`: 같은 사용자·비밀번호·포트·DB로 구성한 연결 URL. 비밀번호의 예약 문자는 URL 인코딩 필요함.
- `DATABASE_SCHEMA`: 기본 `poketact`. 소문자 영문·숫자·밑줄 사용함.
- `RUNTIME_DIR`: 기본 저장소의 `runtime`. Chroma 벡터·임베딩 모델 보관 경로임.
- 기존 모델 공급자 설정 유지함. DB 연결 문자열은 설정 객체의 `repr`에서 제외함.

```bash
docker compose up -d --wait postgres
uv sync --python 3.12 --frozen --group dev
uv run --frozen python -m backend.scripts.index_data
uv run --frozen uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

- 기존 PostgreSQL 사용 시 Compose 시작 생략 가능함. UTF-8 DB·스키마 생성 권한 필요함.
- Compose DB는 `127.0.0.1`에만 노출함. named volume에 데이터 유지함.
- Chroma는 Python 내장 영속 클라이언트로 실행함. 별도 Chroma 서버 불필요함.
- 앱 모듈 import는 DB 연결을 수행하지 않음. 실제 서비스 초기화는 FastAPI lifespan에서 수행함.

## 기존 데이터 이전

기존 서버를 중지하고 빈 PostgreSQL 스키마를 대상으로 **색인 전에** 실행 필요함:

```bash
uv run --frozen python -m backend.scripts.migrate_sqlite runtime/state.sqlite3
uv run --frozen python -m backend.scripts.index_data
```

- SQLite는 읽기 전용 연결·단일 읽기 스냅샷으로 처리함. 원본 파일 삭제·수정 없음.
- 대상 상태 테이블에 데이터가 존재하면 이전 거부함. 복사는 하나의 PostgreSQL 트랜잭션으로 처리함.
- 세션·대화·메시지·팀·작업·원문/HTTP 캐시 이전함. 메시지와 대화는 SQLite 삽입 순서 보존함.
- `manifest`·`query_complete` 캐시는 제외함. `index_data`가 기준 JSON과 이전한 `document` 원문 캐시로 Chroma 색인을 검증·재구축함.
- 이전된 원문은 번들 JSON 색인 전에 읽어 보존하고 번들 색인 후 재적용함.
- 앱 재시작 시 `queued`·`running` 작업은 기존 동작과 동일하게 `interrupted` 복구함.
- 이전 도구 재실행 시 데이터 덮어쓰기 없음. 새 `DATABASE_SCHEMA`를 지정한 별도 이전 필요함.

## 검증

```bash
POKETACT_TEST_DATABASE_URL="$DATABASE_URL" uv run --frozen pytest -q
uv run --frozen ruff check backend
uv run --frozen ruff format --check backend
```

- 테스트마다 고유 PostgreSQL 스키마와 임시 Chroma 경로 사용함. 종료 시 해당 PostgreSQL 스키마만 삭제함.
- 테스트 계정에 스키마 생성·삭제 권한 필요함.
- `POKETACT_TEST_DATABASE_URL` 미설정 시 DB 의존 테스트는 명시적으로 skip 처리함. skip을 통과로 집계하지 않음.
- PostgreSQL 18 + ChromaDB 1.5.9에서 전체 회귀 테스트 51개 통과함. 동시 요청·SQLite 이전·롤백·대화 순서·세션 격리·팀 CRUD·Chroma/manifest 재시작 복원·이전 원문 버전 보존 검증함.
- 실제 메타 1,351건·문서 청크 3,505건 색인·근거 6건 검색·API 상태 조회 확인함. 원본 SQLite 해시 동일함.
- Ruff 검사·포맷 검사·Git 공백 검사·uv 잠금 파일 정합성 검사 통과함.
- 상세 결과는 [검증 기록](evidence/postgresql.json) 참조.

## 한계

- 기존 단일 FastAPI 프로세스 운영 범위 유지함. 다중 워커의 수집·작업 복구는 미지원임.
- PostgreSQL과 Chroma는 단일 원자 트랜잭션을 공유하지 않음. manifest 대조·재실행으로 중간 실패 복구함.
- 운영 `.env`·실제 DB 연결은 자동 변경하지 않음. 검증은 별도 임시 DB에서 수행함.
- Compose의 Docker 실행·새 모델 다운로드·모델 공급자 실제 호출·브라우저 화면 재검증은 미실행임.

## 출처·라이선스

확인일: 2026-10-22 (Asia/Seoul)

- [Psycopg 공식 문서](https://www.psycopg.org/psycopg3/docs/): 연결·행 사전·트랜잭션·SQL 매개변수 참고함. 배포 패키지 라이선스 원문 유지함.
- [Chroma 공식 문서](https://docs.trychroma.com/): 기존 영속 클라이언트·메타데이터 필터·임베딩 구현 유지함.
- [all-MiniLM-L6-v2 모델 카드](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): Apache-2.0 모델, 영어 중심·384차원임.
- [ONNX export 프로젝트](https://github.com/chroma-core/onnx-embedding): Apache-2.0 프로젝트. 기존 Chroma 로컬 모델 캐시 재사용함.
