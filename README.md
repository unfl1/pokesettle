# PokeTact

Pokémon Champions 랭크 싱글 준비·복기를 위한 근거 기반 포켓몬 전략 챗봇

## 주요 기능

- 포켓몬 선택 후 문서 근거를 활용한 질의응답
- 포켓몬별 대화 기록 저장·복원 및 실제 인용 자료 확인
- 자연어 조건 검색과 근거 기반 운용 가이드
- 유사도·MMR 검색 설정과 근거 중복 억제
- 일반 도감 기본 1,025종·별도 폼 326개, 총 1,351개 항목 제공
- 포켓몬 이미지·모바일 화면·진행 상태·오류 재시도 지원

## 기술 구성

| 영역 | 구성 |
|---|---|
| 프론트엔드 | React, TypeScript, Vite, Tailwind CSS |
| 백엔드 | Python, FastAPI |
| RAG | LangChain, LangGraph, pgvector |
| 저장 | PostgreSQL, JSON 기준 자료 |

## 로컬 실행

필요 환경: Python 3.10 이상·3.14 미만, Node.js 20.19+ 또는 22.12+, uv, pnpm, PostgreSQL + pgvector 또는 Docker Compose.

1. 의존성 설치 및 `.env.example`을 참고한 서버 전용 `.env` 설정
2. 모델 키·모델 이름·공급자 연결 주소를 개인 환경에 설정
3. PostgreSQL 준비 후 데이터 색인 및 백엔드·프론트엔드 실행

```bash
docker compose up -d --wait postgres
uv sync --python 3.12 --frozen --group dev
uv run --frozen python -m backend.scripts.index_data
uv run --frozen uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

별도 터미널에서 화면 실행:

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

- 접속: [로컬 챗봇](http://127.0.0.1:5173/)
- API 확인: [로컬 Swagger UI](http://127.0.0.1:8000/docs)
- DB 연결: `.env`의 `DATABASE_URL`·`DATABASE_SCHEMA` 설정, Compose 사용 시 `POSTGRES_PASSWORD` 설정 필수
- 검색 방식: 기본 유사도 검색, `.env`의 `SEARCH_MODE=mmr` 설정으로 다양성을 고려한 검색 선택
- 추가 출처: `WIKIPEDIA_ENABLED=true` 설정 시 피카츄·리자몽 종 배경용 Wikipedia 후보 수집 지원, [출처·구성 안내](docs/guides/DATA_SOURCES.md) 참조
- 기존 SQLite 데이터 이전: [PostgreSQL 전환 안내](docs/guides/POSTGRESQL_MIGRATION.md) 참조
- 최초 색인 시 임베딩 모델 다운로드 필요, 실제 답변 생성 시 설정한 공급자의 크레딧 사용
- AI 호출은 입력·최대 출력·재시도를 사전 예약하며 하루 최대 23만 예약 토큰에서 차단, 한국 시간 오전 9시 초기화. `USAGE_DAILY_TOKENS`로 더 낮게 설정 가능
- 무료 혜택은 OpenAI 계정의 데이터 공유·대상 모델·잔액 조건 충족 필요. 같은 조직의 다른 앱·직접 API 호출은 앱 한도에 포함되지 않아 별도 과금 가능
- 기존 데이터 사용 가능, 전체 원본 재수집 시 `uv run --frozen python -m backend.scripts.prepare_data` 실행

선택형 참조 데미지 API 사용 시 계산 의존성 설치:

```bash
pnpm --dir backend/calculator install --frozen-lockfile --ignore-scripts
```

- API: `POST /api/battle/damage`, [입력·지원 범위](docs/design/API_SPEC.md#참조-데미지-계산-api) 참조
- Node.js가 PATH에 없으면 `.env`의 `DAMAGE_NODE_BINARY`에 실행 파일 절대 경로 지정
- 특성·도구·상태·필드 효과 없는 조건을 명시한 참조 계산, 실제 게임 피해·적격성·KO/승률 검증과 구분

## 사용 범위

- 일반 도감 수록 여부와 Champions 참가 가능 여부 구분
- Champions 적격성·전투 규칙·데미지·승률의 미검증 정보는 확정 답변 대상에서 제외
- 개인용 로컬 단일 프로세스 실행 기준, 공개 배포 시 별도 인증·운영 설정 필요
- 실제 키·개인 문서·대화 DB·로컬 캡처는 Git 제외 대상

## 문서와 출처

- [전체 문서](docs/README.md) · [프로젝트 명세](docs/design/PROJECT_SPEC.md)
- [요구사항](docs/design/REQUIREMENTS.md) · [아키텍처](docs/design/ARCHITECTURE.md) · [API 계약](docs/design/API_SPEC.md)
- [출처·이용 조건](docs/guides/DATA_SOURCES.md)
- [백엔드 구조·실행 경로](docs/design/BACKEND_STRUCTURE.md)
- [Docker 백엔드 배포](docs/guides/DOCKER_DEPLOYMENT.md)
- [S3·CloudFront 프론트엔드 배포](docs/guides/FRONTEND_DEPLOYMENT.md)
- [GitHub Actions 자동 배포·Grafana 운영 관측](docs/guides/OPERATIONS.md)
- 데이터: [PokéAPI](https://pokeapi.co/docs/v2), [프로젝트 라이선스](data/licenses/POKEAPI_LICENSE.md)
- 이미지: [PokéAPI sprites](https://github.com/PokeAPI/sprites), Pokémon © The Pokémon Company

조건부 전략 RAG의 초기 자료 색인:

```bash
uv run --frozen python -m backend.scripts.index_strategy
```

- 현재 망나뇽·기본 이상해꽃·기본 리자몽 3종의 직접 작성한 조건부 전략과 기초 기술·특성 자료 지원
- 전략 설명은 일반 규칙 기반 가정이며 실전 검증·현행 Champions 추천 세트와 구분
