# PokeTact

Pokémon Champions 랭크 싱글 준비·복기를 목표로 하는 근거 기반 지식 서비스입니다. 현재 **Phase 2 챗봇 중심 화면과 API 통합**까지 구현했습니다. 포켓몬별 대화·기록 복원, 출처 확인, 자연어 조건 검색, 근거 가이드를 제공합니다. 팀·전투 계산은 후속 단계입니다.

현재 데이터는 **일반 PokéAPI 기본 1,025종 + 별도 폼 326개, 총 1,351개 항목**과 종별 설명 문서입니다. 수집 시점 원본의 전체 pokemon 리소스를 포함하며 코드에 도감 상한을 고정하지 않습니다. 독립 능력치가 없는 외형 전용 폼은 별도 채팅 항목으로 나누지 않습니다. Champions 참가 가능 명단이라는 뜻은 아닙니다. 참가 가능 여부·육성·레벨·데미지·승률은 미확인으로 두고 배틀 계산을 제공하지 않습니다.

## 실행

Python 3.10 이상(검증 환경 3.12), [uv](https://docs.astral.sh/uv/)를 사용합니다. 과제 PDF 지정 버전은 `pyproject.toml`, 전이 의존성까지 확정한 버전은 `uv.lock`에 있습니다.

```bash
uv sync --python 3.12 --frozen --group dev
```

`.env.example`을 참고해 **서버 전용 `.env`**를 설정합니다. 이미 로컬 설정 파일이 있다면 덮어쓰지 마세요. 필요한 값은 API 키, 모델 ID, 공급자의 base URL입니다. 키를 화면·코드·Git에 넣지 않습니다.

GMS 사용 시 공식 [Quickstart](https://gms.ssafy.io/api/v1/guides/Quickstart)에 따라 다음 구성을 사용합니다:

```dotenv
OPENAI_API_KEY=여기에_본인의_GMS_키를_로컬에서_설정
OPENAI_BASE_URL=https://gms.ssafy.io/gmsapi/api.openai.com/v1
CHAT_MODEL=gpt-4.1-mini
LANGSMITH_TRACING=false
```

일반 OpenAI 키를 사용하는 경우 `OPENAI_BASE_URL`은 비워 둡니다. 지원하는 구조화 출력 모델을 지정해야 합니다. 모델 호출은 해당 공급자의 크레딧을 사용합니다.

```bash
# 배포된 pokemon.json과 종별 문서가 있으면 수집은 생략할 수 있습니다.
# 기본값은 전체 종·별도 폼입니다. --count는 개발용 종 수 제한입니다.
uv run --frozen python -m backend.scripts.prepare_data

# 첫 실행은 로컬 임베딩 모델 다운로드가 필요합니다.
uv run --frozen python -m backend.scripts.index_data

uv run --frozen uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 1
```

API 문서는 서버 실행 후 [로컬 Swagger UI](http://127.0.0.1:8000/docs)에서 확인할 수 있습니다. 서버는 개인용 로컬 단일 프로세스 기준입니다. 초기 수집·일괄 색인 스크립트와 서버의 쓰기 작업을 동시에 실행하지 마세요.

## 챗봇 화면 실행

Node.js 20.19+ 또는 22.12+와 pnpm을 사용합니다. 검증 환경은 Node.js 24와 pnpm 11입니다. 백엔드를 먼저 실행한 뒤 별도 터미널에서:

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

[로컬 챗봇](http://127.0.0.1:5173/)에서 포켓몬을 고르고 질문합니다. 대화가 주 화면이며, 도감 수치와 출처는 필요할 때 펼쳐 봅니다. 모바일의 포켓몬 검색도 기본적으로 접혀 있습니다. 이름 검색·조건 검색 결과는 같은 대화 화면으로 연결됩니다.

목록·조건 검색은 “더 보기”로 전체 항목에 접근합니다. 목록에는 스프라이트, 선택 프로필에는 일러스트를 표시하며 실패 시 스프라이트·대체 아이콘 순으로 전환합니다. 같은 종의 별도 폼도 고유 ID·능력치·대화 기록으로 구분합니다.

Vite가 `/api`를 127.0.0.1:8000으로 전달합니다. 키는 백엔드 루트 `.env`에만 두고 `VITE_` 환경변수로 옮기지 않습니다. 개발 서버는 로컬 주소에만 바인딩합니다. 실사용 배포에는 같은 출처에서 화면과 API를 연결할 배포 설정이 필요합니다.

대화는 익명 세션 쿠키와 연결된 서버 SQLite에 저장됩니다. 같은 브라우저에서 새로고침해도 복원되며, 쿠키 만료·삭제 후에는 접근할 수 없습니다. 진행 중 작업 ID만 탭의 sessionStorage에 보관하고 질문·답변 전문은 저장하지 않습니다.

## API 사용 순서

1. `GET /api/status`에서 색인 수와 모델 설정 상태를 확인합니다.
2. `POST /api/session`으로 HttpOnly 세션 쿠키를 받습니다.
3. `GET /api/pokemon` 또는 `GET /api/pokemon/pokemon:25`로 항목을 선택합니다.
4. `POST /api/chat`에 아래 형태로 질문합니다. 응답은 202와 `statusUrl`입니다.
5. 같은 세션 쿠키로 `GET statusUrl`을 조회해 진행 단계와 완료 결과를 받습니다.

```json
{
  "pokemonId": "pokemon:25",
  "question": "피카츄의 타입과 특성 이름을 알려줘",
  "clientRequestId": "a7ee1797-1128-462f-95f1-c988973946a2"
}
```

새 질문마다 새 UUID를 사용합니다. 동일 요청 ID와 본문은 동일 작업을 반환하며, ID가 같고 본문이 다르면 409입니다. 기존 대화를 이어갈 때는 이전 결과의 `conversationId`를 추가합니다. 포켓몬·규칙이 다르면 대화를 분리합니다.

별도 `POST /api/documents/collect`로 질문에 필요한 문서만 준비할 수도 있습니다. `/api/chat`은 이 준비를 자동 수행하므로 선행 호출은 필수가 아닙니다. 현재 규칙 레지스트리는 비어 있으며 등록하지 않은 `regulationId`는 422로 거부합니다. 미검증 M-C 적격 목록을 임의 등록하지 않았습니다.

추가 Phase 2 API:

- `POST /api/conversations`, `GET /api/conversations?pokemonId=...`, `GET /api/conversations/{id}/messages`: 세션·포켓몬별 기록 생성·조회.
- `POST /api/pokemon/{id}/guide`: `clientRequestId`와 선택적 `conversationId`, `regulationId`. 같은 RAG 흐름으로 일반 도감 가이드를 생성하고 대화에 저장합니다.
- `POST /api/pokemon/search`: `{query,limit?,offset?}`. 예: “전기 타입이고 스피드 종족값이 90 이상”. 모델 해석을 표시하고 실제 필드로 AND 조건을 검증합니다. “빠른”·기술/면역·전략 등 미지원 조건은 구체화를 요청합니다. 결과의 완전성은 **해석된 구조화 조건과 확보된 도감 범위**에 한정됩니다.

## RAG와 데이터

- `pokemon_meta`: 항목당 1개 텍스트, 고정 ID upsert. 선택 포켓몬의 메타는 항상 근거에 포함합니다.
- `pokemon_docs`: 별도 종별 설명/관련 리소스 청크. 항목·문서·인덱스 버전·순번을 포함하는 ID로 충돌을 막습니다.
- Prompt 1 검색어 추출 → PokéAPI 리소스 목록에서 후보 검색 → Prompt 2 선별 → 본문 수집·청킹·색인. 자체 문서는 선별·길이 규칙보다 우선해 유지합니다.
- LangGraph `retrieve → generate`, Prompt 3 근거 기반 생성. 답변에서 실제 인용한 근거만 출처 목록에 남깁니다. 미지원 질문은 유보합니다.
- HTTP 원문·검색 후보·검색어·문서 선별 완료 상태를 SQLite에 캐시합니다. 청킹 설정 변경은 저장 본문으로 재색인하며 이전 청크를 제거합니다. 같은 검색어라도 질문이 바뀌면 저장 후보를 다시 선별합니다.
- 백그라운드 작업 상태는 SQLite에 저장하고 재시작 후 진행 중 작업은 `interrupted`로 표시합니다.

현재 외부 검색은 PokéAPI의 종·해당 포켓몬의 특성·타입 **정확한 리소스 이름 검색**입니다. 일반 웹 전략 검색이나 위키백과 수집은 아직 제공하지 않습니다. 종별 본문은 원래 게임 버전 표기를 유지하며 Champions 전용 전략으로 취급하지 않습니다.

`CHUNK_SIZE=1000`, `CHUNK_OVERLAP=200`, `TOP_K=6`이 초기값입니다. Top-k는 선택 메타 1개를 포함한 총 근거 수입니다. `runtime/`에는 SQLite·Chroma·원문 캐시·임베딩 모델이 저장됩니다. 이 경로와 `.env`는 Git 제외 대상입니다.

로컬 ONNX `all-MiniLM-L6-v2`를 사용합니다. 영어 중심 모델이므로 한국어 질문의 검색 품질은 제한이 있습니다. 현재 검색어의 영문 리소스 이름을 질문과 함께 사용하며, 한국어 의미 검색의 충분한 품질을 보장하지 않습니다. 검증된 모델 교체 시에는 별도 저장 경로로 전체 재색인해야 합니다. 지원 모델을 자동으로 바꾸지 않습니다.

## 검증

```bash
uv run --frozen pytest -q
uv run --frozen ruff check backend
uv run --frozen ruff format --check backend

# 실제 데이터와 로컬 임베딩만 검사
uv run --frozen python -m backend.scripts.verify_phase1

# 설정한 공급자의 실제 모델을 호출: 메타/외부문서 인용·유보·캐시 확인
uv run --frozen python -m backend.scripts.verify_phase1 --live
```

화면 및 Phase 2 검증:

```bash
pnpm --dir frontend build
# 기본 브라우저는 macOS Chrome. 다른 환경은 실행 파일을 지정합니다.
CHROME_PATH=/path/to/chrome pnpm --dir frontend test:e2e
# 백엔드 실행 중 실제 공급자 모델 호출
uv run --frozen python -m backend.scripts.verify_phase2 --live
```

브라우저 테스트는 결정적 API 대역을 사용합니다. 실제 GMS/API/브라우저 연결은 별도로 검사했습니다. [Phase 2 검증 보고서](docs/PHASE2_RESULTS.md)에 결과와 한계를 기록했습니다.

단위 테스트는 명시적인 테스트 대역을 사용하며 실제 모델 품질을 대신하지 않습니다. 실제 데이터·임베딩·GMS 실행 증거는 [검증 결과](docs/TEST_RESULTS.md)와 [증거 JSON](docs/evidence/phase1.json)에 별도로 기록합니다. API 키나 프롬프트 전문은 증거 파일에 저장하지 않습니다.

## 출처와 문서

전체 기초 데이터와 종별 설명은 [PokéAPI CSV](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)로 일괄 수집하며, 질문에 필요한 관련 문서는 [PokéAPI v2](https://pokeapi.co/docs/v2)로 추가 수집합니다. 출처 URL·수집 시각·해시·이용 조건과 원래 게임 버전을 기록하고, 프로젝트 [라이선스 원문](data/licenses/POKEAPI_LICENSE.md)을 보존합니다. 이미지는 [PokéAPI sprites](https://github.com/PokeAPI/sprites)의 원본 주소를 연결하며 이미지 파일을 Git에 넣지 않습니다. 외부 네트워크 연결이 필요합니다. 이미지 저작권이 Pokémon Company에 있음을 화면과 데이터에 명시하며 저장소 라이선스를 캐릭터 권리의 포괄 허가로 해석하지 않습니다.

최신 범위·검증·한계는 [전체 도감·이미지 보완 보고서](docs/CATALOG_EXPANSION.md)를 참조하세요. 초기 100종을 기준으로 한 Phase 1·2 증거는 당시 실행 기록으로 보존합니다.

- [요구사항 및 단계 계획](docs/REQUIREMENTS.md)
- [아키텍처와 데이터 설계](docs/ARCHITECTURE.md)
- [API 계약과 현재 구현 범위](docs/API_SPEC.md)
- [출처·규칙 검증 기록](docs/DATA_SOURCES.md)

Phase 3·4는 아직 시작하지 않았습니다. Streamlit은 PDF 준비 기술 목록에 따라 지정 버전의 `assignment-ui` 선택 의존성으로 보존했으며, UI를 구현하지 않은 Phase 1 기본 설치에는 포함하지 않습니다. React 제출 경로의 수용 여부는 여전히 별도 확인 항목입니다.
