# PokeSettle

Pokémon Champions 랭크 싱글 준비와 복기를 위한 RAG 기반 포켓몬 전략 챗봇

[서비스 바로가기](https://www.pokesettle.com)

## 주요 기능

| 기능 | 내용 |
| --- | --- |
| 전략 챗봇 | 포켓몬과 대면 상황에 맞춘 질의응답, 답변 근거 확인, 대화 기록 저장 |
| 포켓몬 도감 | 이름과 타입으로 검색, 종별 능력치와 특성 및 기술 조회 |
| 메타 순위 | 자주 쓰는 포켓몬과 주요 세팅, 출처와 기준일 확인 |
| 6:6 시나리오 | 양쪽 팀 구성, 선출 후보와 공격 및 교체 시나리오 비교 |

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | Next.js App Router, React, TypeScript, Tailwind CSS |
| 백엔드 | Python, FastAPI |
| RAG | LangChain, LangGraph |
| 데이터 | PostgreSQL, pgvector, JSON |

## 로컬 실행

필요 환경: Python 3.10 이상 3.14 미만, Node.js 20.19+ 또는 22.12+, uv, pnpm, Docker Compose

`.env.example`을 루트 `.env`로 복사한 뒤 모델 키와 DB 연결 정보 설정

```bash
docker compose up -d --wait postgres
uv sync --python 3.12 --frozen --group dev
uv run --frozen python -m backend.scripts.index_data
uv run --frozen python -m backend.scripts.index_strategy
pnpm --dir backend/calculator install --frozen-lockfile --ignore-scripts
uv run --frozen uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

별도 터미널에서 프론트엔드 실행

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

[로컬 화면](http://127.0.0.1:3000/) | [API 문서](http://127.0.0.1:8000/docs)

- 최초 색인 시 임베딩 모델 다운로드 필요, AI 답변 생성 시 설정한 공급자 요금 적용
- 모델별 일일 예산과 배포 설정은 [운영 지침](docs/guides/OPERATIONS.md) 참고

## 사용 범위

- 도감 수록 여부와 Champions 참가 가능 여부 구분
- 미확인 규칙과 승률은 확정 답변에서 제외, 참조 데미지 계산과 실제 게임 결과 구분
- 메타 순위는 사용률 기준이며 승률이나 참가 가능 판정과 구분
- Pokémon 공식 서비스와 무관한 비공식 팬 프로젝트

## 문서와 출처

- [아키텍처](docs/design/ARCHITECTURE.md) | [API 계약](docs/design/API_SPEC.md) | [프로젝트 명세](docs/design/PROJECT_SPEC.md)
- [설정과 배포](docs/guides/OPERATIONS.md) | [데이터 출처와 이용 조건](docs/guides/DATA_SOURCES.md)
- 데이터: [PokéAPI](https://pokeapi.co/docs/v2), [라이선스](data/licenses/POKEAPI_LICENSE.md)
- 이미지: [PokéAPI sprites](https://github.com/PokeAPI/sprites), Pokémon © The Pokémon Company
