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
- 기존 SQLite 데이터 이전: [PostgreSQL 전환 안내](docs/POSTGRESQL_MIGRATION.md) 참조
- 최초 색인 시 임베딩 모델 다운로드 필요, 실제 답변 생성 시 설정한 공급자의 크레딧 사용
- 기존 데이터 사용 가능, 전체 원본 재수집 시 `uv run --frozen python -m backend.scripts.prepare_data` 실행

## 사용 범위

- 일반 도감 수록 여부와 Champions 참가 가능 여부 구분
- Champions 적격성·전투 규칙·데미지·승률의 미검증 정보는 확정 답변 대상에서 제외
- 개인용 로컬 단일 프로세스 실행 기준, 공개 배포 시 별도 인증·운영 설정 필요
- 실제 키·개인 문서·대화 DB·로컬 캡처는 Git 제외 대상

## 문서와 출처

- [요구사항](docs/REQUIREMENTS.md) · [아키텍처](docs/ARCHITECTURE.md) · [API 계약](docs/API_SPEC.md)
- [출처·이용 조건](docs/DATA_SOURCES.md) · [구현·검증 결과](docs/CATALOG_EXPANSION.md)
- [백엔드 구조·실행 경로](docs/BACKEND_STRUCTURE.md)
- 데이터: [PokéAPI](https://pokeapi.co/docs/v2), [프로젝트 라이선스](data/licenses/POKEAPI_LICENSE.md)
- 이미지: [PokéAPI sprites](https://github.com/PokeAPI/sprites), Pokémon © The Pokémon Company
