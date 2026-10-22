# 백엔드 디렉토리 구조

변경일: 2026-10-22. 기존 기능 범위를 유지한 구조 정리임.

## 구성 기준

- FastAPI 버전별 필수 디렉토리 구조는 없음. [공식 다중 파일 구성 문서](https://fastapi.tiangolo.com/tutorial/bigger-applications/)의 Python 패키지·`APIRouter`·`include_router()` 방식 적용함.
- `backend/app`에 실행 코드를 모으고 API·설정·스키마·서비스·RAG·전투 계산 분리함.
- 테스트와 운영 스크립트는 앱 외부에 유지함. 추가 의존성·새 기능 단계 도입 없음.

```text
backend/
├── app/
│   ├── main.py                 # 앱 생성·lifespan·라우터 연결
│   ├── api/
│   │   ├── router.py           # /api 라우터 통합
│   │   ├── dependencies.py     # Depends 기반 앱별 서비스·설정 주입
│   │   ├── responses.py        # 응답 봉투·camelCase 변환
│   │   ├── validation.py       # 세션·규칙·준비 상태·팀 입력 확인
│   │   ├── jobs.py             # HTTP 작업 접수·202 응답
│   │   └── routers/            # system·pokemon·conversations·knowledge·teams·battle
│   ├── core/                   # config·errors·예외 처리·미들웨어
│   ├── schemas.py              # Pydantic 요청·도감·RAG 데이터 계약
│   ├── services/               # knowledge·discovery·백그라운드 jobs
│   ├── rag/                    # 그래프·검색·프롬프트·모델·벡터 저장소
│   ├── battle/                 # 전투 입력 모델·일반 타입 분석 엔진
│   ├── data_preparation/       # PokéAPI 수집 어댑터
│   ├── catalog.py              # JSON 도감 조회
│   ├── storage.py              # SQLite·캐시
│   └── http_client.py          # 원본 수집 HTTP 클라이언트
├── scripts/                    # 수집·색인·검증 명령
└── tests/                      # 자동 테스트
```

## 변경과 실행

| 원인 | 수정 | 결과 |
|---|---|---|
| `main.py`에 라우트·예외·세션·작업 실행 집중 | 기능별 라우터와 공통 모듈 분리 | 앱 진입점은 생성·연결 담당 |
| 실행 코드와 테스트·스크립트가 같은 계층에 배치 | 실행 코드를 `backend/app`으로 이동 | 앱·운영 명령·테스트 경계 명확화 |
| `models.py`에 Pydantic 계약 배치 | `app/schemas.py`로 이동 | ORM 모델과 구분 가능한 이름 사용 |
| 앱 이동 시 저장 경로 변경 가능 | 설정의 저장소 루트 계산 수정 | 루트 `.env`·`data/`·`runtime/` 경로 유지 |

저장소 루트에서 실행:

```bash
uv run --frozen uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
uv run --frozen python -m backend.scripts.index_data
uv run --frozen pytest -q
```

- 앱 import는 `backend.app.*` 사용. 기존 `backend.main:app` 실행 명령은 새 경로로 변경 필요함.
- API URL·HTTP 메서드·OpenAPI·응답 형식·쿠키·세션 소유권 검사 유지함.
- 기존 단계별 결과 문서·증거 스냅샷의 이전 파일 경로는 당시 기록으로 보존함.

## 검증

| 항목 | 결과 |
|---|---|
| 변경 전 자동 테스트 | 43개 통과 |
| 변경 후 `.venv/bin/pytest -q` | 46개 통과 |
| 추가 회귀 검증 | 기본 데이터 경로·앱별 설정 분리·전투 자료 로딩 전 세션 검사 통과 |
| `.venv/bin/ruff check backend` | 통과 |
| 변경 전후 `app.openapi()` 비교 | 동일함. 경로·파라미터·operationId·스키마 유지 확인함 |
| 수집·색인·검증 스크립트 5개 import | 통과. 실제 수집·색인·유료 모델 호출은 미실행임 |

## 한계와 다음 단계

- 실제 모델 호출·브라우저 E2E·외부 공개 배포 검증은 미실행임.
- 새로운 기능·전투 규칙·데이터 출처 변경 없음. Champions 미확인 정보 처리 유지함.
- 다음 실행부터 변경된 Uvicorn 모듈 경로 사용 필요함. 서버 재시작 시 기존 작업 복구 동작 유지함.
