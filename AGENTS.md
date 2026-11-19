# AGENTS.md

## Project
PokeSettle is a RAG-based Pokémon Champions ranked singles strategy assistant.

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Backend: Python, FastAPI
- RAG: LangChain, LangGraph, PostgreSQL + pgvector
- Storage: JSON reference snapshots and PostgreSQL

## Sources of truth
- Current user requests and practical production needs take priority: usability, reliability, security, operating cost, and maintainability.
- `요구사항정의.pdf`: optional RAG design reference. Keep useful quality principles; do not impose assignment-specific counts, technologies, submissions, or approval gates.
- `docs/design/PROJECT_SPEC.md`: product, architecture, RAG quality, and production planning guidance.
- `docs/`: read only the relevant design documents for the task.
- Verify current Pokémon Champions mechanics and regulation eligibility before coding them. Do not transplant Scarlet/Violet mechanics without verification.

## Working rules
- Inspect existing code before editing; keep changes focused on the current product or production objective.
- Use snake_case in Python, camelCase in TypeScript, and clear module boundaries.
- 프런트·Node 도구 소스는 TypeScript(`.ts`·`.tsx`·`.cts`·`.mts`)로 작성하고 타입 검사함. 브라우저·CloudFront용 JavaScript는 실행/배포 시 생성하며 직접 작성한 JS 소스로 GitHub 언어 비율을 늘리지 않음. 정적 설정은 도구가 지원하는 JSON 사용 가능함.
- Keep UI, API, RAG, retrieval data, and battle calculations separate.
- Prefer simple solutions; avoid unnecessary abstractions and dependencies.
- Never commit secrets, invent source facts, fabricate damage/KO/win rates, or present heuristic scores as probabilities.
- Distinguish verified, assumed, and unknown battle information in outputs.
- Record data sources, licenses, and collection dates.
- 작업 후 lint·타입 검사·테스트·빌드를 일괄 실행하는 의무 절차 제거함. 사용자가 요청하거나 문제 진단에 필요한 명령만 선택 실행하고 실제 결과와 미확인 범위를 구분함.

## Workflow
- Perform all frontend and backend work on `develop` unless the user explicitly requests another branch.
- Treat a request to create a PR as one workflow: commit the requested changes locally, push `develop` to GitHub, then create or update a `develop` → `main` PR. Leave merging to the user unless explicitly requested.
- For major changes, state a short plan and implement in reviewable increments based on production priorities.
- Within the user's requested objective, choose implementation order and complete necessary related work autonomously.
- Explain changes, tests, limitations, and next steps in Korean.
- After each completed task, update the single ignored local learning guide at `docs/private/LEARNING_GUIDE.md` with what changed, why it changed, concepts the user should study, and relevant code paths. Keep Phase 0 through current work in this file; update its relevant sections instead of creating separate phase-specific learning notes.
- Keep documentation in the existing project instructions, specifications, API/architecture references, operations guide, source/license records, and the single local learning guide. Do not create additional Markdown files, per-directory READMEs, standalone work reports, submission documents, or checklists unless the user explicitly requests them. The default task document is the local learning note, not a public repository artifact.

## 작업별 판단과 검증

- 시작 기준: 제품 코드·배포·운영 작업은 관련 노션 기록 확인 후 이번 요청·사용 상황·변경 범위·정상 기대 결과·관련 오류/경계 조건의 기대 결과를 해당 주제에 짧게 정리함. 명확한 요구 범위에서는 합리적인 기준을 정해 진행하고 확인이 필요한 가정만 구분함. 버그 수정은 수정 전 재현 조건과 실제 결과 포함함. 단순 상담·표현 점검·기록 정리 자체의 대화 진행은 별도 프로젝트 작업 로그로 만들지 않음
- 리뷰 판단: 변경 후 요청·기대 결과·diff를 대조해 사용 흐름 단절·오류 처리·불필요한 반복 처리와 영향을 받는 경계를 점검함. 발견 사항은 원인 근거·수정 제안·채택/보류/기각 이유를 남김. 근거가 부족한 제안을 사실로 확정하거나 모든 AI 제안을 그대로 반영하지 않음. 의미 있는 발견이 없으면 점검 범위와 발견 없음 기록함
- 선택 검사: 수정 기능과 영향을 받는 기존 기능을 먼저 식별하고, 각 기대 결과를 확인할 수 있는 최소한의 테스트·수동 확인을 선택함. 검사 항목·선정 이유·관련 코드/화면·실행 환경을 기록함. 관련 기존 기능의 미검사 또는 검사 불필요 판단도 이유를 남김. 일괄 lint·타입 검사·테스트·빌드·전체 회귀를 의무화하지 않음
- 전후 비교: 버그·성능 수정은 가능한 같은 입력·환경·캐시·관측 조건으로 재확인함. 명령·실제 결과·통과/실패/건너뜀을 남기고 조건이 달라지면 비교 한계를 명시함. 원인과 관측 결과를 구분하며 근거 없이 개선 수치나 성공을 만들지 않음
- 배포 후 확인: 배포를 수행하거나 완료 여부를 점검하는 작업에서는 [운영 가이드](docs/guides/OPERATIONS.md#배포-후-실제-사용-흐름-확인)에 따라 실제 공개 브라우저·API·DB의 질문 입력→답변 표시→대화 저장·복원을 확인함. 릴리스·시각·질문 경로·결과를 노션에 남김. 배포하지 않은 작업에는 적용 여부를 배포 미수행으로 표시하고 배포를 임의로 시작하지 않음. 공개 smoke·합성 API 검사를 실제 사용 흐름 확인으로 대체하지 않음
- 운영 대응: 관측 기간·배포 버전·오류 코드·지연 지표·사용자 영향을 먼저 정리하고 우선순위 근거를 기록함. 사용자의 우선순위와 제약을 따르고 에이전트의 제안과 확정된 판단을 구분함. 가설→조사 근거→수정/보류 이유→같은 조건의 재관측→처리 결과·남은 문제를 같은 기록에 연결함. 자세한 측정 기준은 [운영 가이드](docs/guides/OPERATIONS.md#운영-이슈-판단과-처리-기록) 참조함
- 종료 판단: 시작 시 기대 결과별 충족·실패·미확인 상태와 리뷰 판단·선택 검사·배포/운영 적용 여부를 노션에 이어 기록함. 미확인 항목은 이유·사용자 영향·다음 확인 조건을 남김. 기록을 채우기 위해 관련 없는 검사·운영 변경·추가 승인 절차를 만들지 않음

## Notion 작업 기록

- 기록 대상: `https://app.notion.com/p/4048844397a98045a77ccc9477cf0aa6`와 아래 카테고리 페이지는 목차로 유지함. 메인·카테고리 본문에 작업 로그를 추가하지 않음. 관련 카테고리를 조회해 기능·문제별 하위 페이지를 찾은 뒤 해당 주제를 갱신함. 맞는 주제가 없으면 해당 카테고리 아래 주제 페이지 생성함

| 카테고리 | 페이지 ID | 기록 범위 |
| --- | --- | --- |
| 기능 안내 | `41788443-97a9-81e5-a973-c2fa8307e154` | 사용자 기능과 사용 제약 |
| 설계와 학습 | `41788443-97a9-8125-b4e4-db6091abd7f2` | 구조·RAG·개념·코드·이전 원문 |
| 문제 해결과 검증 | `41788443-97a9-81c4-adfb-ef57088f0fa6` | 재현·원인·수정·검사 근거 |
| 배포와 운영 | `41788443-97a9-8162-8ed0-f9554ca38183` | 릴리스·실환경 확인·지표·장애 대응 |
| 개발 환경과 작업 방식 | `41788443-97a9-81a4-81b5-c793672b778b` | MCP·개발 도구·현재 작업 기준 |

- 분량·주제: 주제 페이지에는 현재 설명·핵심 판단·최근 확인 결과를 유지함. 같은 문제의 후속 내용은 기존 설명을 갱신하되, 독립된 문제·원인·큰 릴리스나 긴 변경/검증 이력은 해당 주제 아래 별도 페이지로 분리하고 요약·링크만 남김. 날짜별 보고를 끝없이 append하지 않음. 같은 설명·원시 실행 로그·대화 진행 보고·자소서 표현 대조·중복 점검표를 반복 추가하지 않음. 실제 변경·판단 근거·검증 결과 중 다시 참고할 내용만 기록함
- 설명 그림: 이름만 적은 상자·화살표로 끝내지 않음. 실제 입력·자료 일부·코드 처리·상태 변화·화면/출력 중 설명에 필요한 구체 사례를 연결함. 문제 해결은 같은 조건의 수정 전후를 보여줌. 실제 실행 결과와 설명용 예시를 구분하고 출처·버전·코드 경로를 함께 표시함. 한글·수치·코드의 누락·겹침과 페이지 표시를 확인한 그림만 사용함
- 연결 경로: 사용자 Codex 설정의 `mcp_servers.notion`에 직접 등록한 공식 서버 `https://mcp.notion.com/mcp` 사용함. 기존 플러그인 호출과 구분하고 OAuth·설정 존재만으로 정상 동작을 판단하지 않음. 직접 등록 MCP 도구가 세션에 노출되면 해당 도구 사용함
- 세션 내 대체 호출: 직접 MCP 도구가 노출되지 않으면 로컬 비공개 도구 `python3 docs/private/notion_mcp.py fetch`로 목차 조회함. 이 도구는 Codex App Server의 공식 MCP 호출 API에서 서버명 `notion`을 사용하며 모델 턴을 실행하지 않음. 관련 주제는 `fetch --id <페이지 ID>`로 읽음. 작성 문법 확인 후 `append --id <주제/개별 기록 페이지 ID> --file <UTF-8 본문 파일>` 또는 `update --id <주제/개별 기록 페이지 ID> --file <content_updates JSON 배열 파일>` 사용하고 같은 페이지를 재조회함. 메인·카테고리 쓰기·전체 교체·삭제 기능은 제공하지 않음
- 연결 점검: 도구·로컬 호출 도구가 없거나 인증 실패 시 `codex mcp get notion --json`으로 설정 확인함. 인증 만료 시 `codex mcp login notion`으로 재인증한 뒤 조회 재시도함. 로컬 호출 도구는 Git 제외이며 다른 기기에서 자동 제공되지 않음. 누락·실패를 노션 기록 성공으로 보고하지 않음
- 작업 시작: 코드·설정 수정 전에 MCP로 관련 카테고리의 목차에서 주제·개별 기록을 찾아 조회함. 이전 재현 조건·판단 근거·수정·검증 범위·미해결 항목을 확인하고 현재 코드·운영 상태와 대조함. 과거 기록만으로 현재 동작을 확정하지 않음
- 작업 재개: 관련 기록의 날짜·제목 또는 링크와 이어 수행할 내용을 확인함. 추가 수정은 이전 판단을 바꾸는 이유와 새로 확보한 근거를 함께 남김
- 작업 종료: 로컬 학습 가이드 갱신과 함께 관련 주제·개별 기록을 갱신함. 과거 원인·판단·검증 결과를 필요한 범위에서 보존하고 의미 있는 변경만 이어 남김. 상세 이력이 길어지면 주제 하위 페이지로 분리함. 사용자의 별도 기록 요청 없이 수행함
- 기록 항목: 실제 작업과 관련 있는 목적·기대 결과·재현 조건·원인과 근거·리뷰 판단·수정 코드·검사 선정/제외 이유·실제 결과·미확인 범위를 짧게 기록함. 배포·운영 작업에는 릴리스·실환경 확인·우선순위·처리 결과 포함함. 관련 없는 항목·비해당 목록·중복 종료 보고로 분량을 늘리지 않음
- 사실 구분: 원인 확정·가설·미확인 상태 구분함. 테스트 미수행 시 이유를 명시하고 통과로 표시하지 않음. 로컬·합성 API·실제 모델·운영 검증과 커밋·PR·배포 상태 구분함. 필요한 검사만 선택하는 기존 원칙 유지함
- 저장 확인: MCP 쓰기 성공 응답을 확인하고 추가한 기록을 재조회하여 반영 여부 확인함. 실패하거나 결과가 불명확하면 저장 완료로 보고하지 않음. 불명확한 쓰기는 재조회 후 재시도하여 중복 기록 방지함. 최종 답변에 노션 기록 링크와 반영 상태 포함함
- 연결 실패: 조회·저장 오류와 미반영 내용을 `docs/private/LEARNING_GUIDE.md`의 해당 작업에 `노션 반영 대기`로 보존함. 관련 로컬 기록으로 맥락을 확인하며 가능한 작업을 진행하고 최종 답변에 노션 미확인·미저장을 명시함. 다음 작업 시작 시 조회를 다시 시도하고 연결 복구 후 대기 기록을 기존 노션 기록과 대조하여 중복 없이 반영함. 로컬 저장을 노션 저장으로 간주하지 않음
- 기록 보호: 비밀값·인증 정보·개인정보·실제 사용자 대화 원문 제외함. 재현 입력은 비식별 예시를 사용하고 원시 로그 대신 필요한 오류 코드·집계·근거만 남김

## Documentation and PR style
- Apply this style to all project-authored Korean Markdown, README files, design documents, reports, result summaries, and pull request titles/descriptions, including newly created files.
- Use concise noun-style endings such as `구현함`, `수정함`, `확인함`, `미확인임`, `변경`, `유지`, and `통과`; avoid narrative endings such as `~다`, `~했다`, `~있었다`, and `~습니다`.
- Prefer short bullets and comparison tables to long narrative paragraphs. Preserve the meaning, scope, dates, counts, source links, and technical identifiers.
- Describe development work as concrete changes and resulting behavior. Separate implementation, validation, limitations, and next steps when relevant.
- Describe resolved issues in `원인 → 수정 → 결과` order, preferably as table columns. Keep unverified behavior and remaining limitations explicit; never invent a successful result.
- Keep PR descriptions focused on the final diff and reviewer-relevant validation; omit conversational history and unrelated details.
- Include only changes and validation in PR descriptions; omit limitations and improvement sections. Prefer concise noun endings without final periods.
- Keep README public-facing: project overview, key features, minimal setup, essential usage constraints, and documentation/source links. Keep phase progress, assignment interpretations, detailed implementation notes, and validation reports in dedicated documents.
- Do not add submission packets, phase reports, raw execution snapshots, or personal learning notes to Git by default. Keep new public documentation limited to current setup, architecture, API contracts, and source/license information unless explicitly requested.
- Preserve verbatim quotations, third-party source/license text, raw execution logs, generated evidence snapshots, code examples, and UI/prompt text in their original context rather than changing them solely to satisfy documentation style.
- Do not edit `docs/design/PROJECT_SPEC.md` or unrelated instructions in this file solely to standardize prose unless the user explicitly requests it.

## Frontend command tools
- `pnpm --dir frontend format`: Prettier 포맷 적용
- `pnpm --dir frontend format:check`: Prettier 포맷 확인
- `pnpm --dir frontend lint`: oxlint 정적 분석
- `pnpm --dir frontend lint:fix`: oxlint 자동 수정
- `pnpm --dir frontend typecheck`: 경로 타입 생성 후 TypeScript 7 타입 확인
- 명령 실행 전 `frontend/package.json`의 스크립트와 설치 버전 확인, 변경 범위에 필요한 도구만 선택함
- PR·배포 전 자동 회귀 검사 제거, 테스트 소스와 수동 명령 유지, 배포 빌드·운영 상태 확인 유지

## Frontend styling
- Before changing frontend styles, read and follow [Frontend styling rules](.agent/rules/frontend-styling.md). This path is relative to the repository root and applies to frontend styling work.
- 화면 스타일은 JSX의 Tailwind CSS 유틸리티로 작성함. 별도 CSS 모듈과 전역 화면 클래스 규칙 추가 지양함
- CSS 파일은 Tailwind 진입점·테마·변형·플러그인 지시문으로 제한함. 일반 선택자 규칙·CSS 모듈·JSX 인라인 스타일 추가 지양함
- 공통 기본값·접근성은 `src/styles/document.ts`의 Tailwind 유틸리티, 폰트 서브셋은 Tailwind 플러그인, 키프레임은 Tailwind 테마로 관리함. 실제 DOM 좌표에 의존하는 포획 이동은 Web Animations API, 종족값 막대는 SVG 수치 속성 사용함
