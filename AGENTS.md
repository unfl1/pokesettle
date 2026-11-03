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
