# AGENTS.md

## Project
PokeTact is a RAG-based Pokémon Champions ranked singles strategy assistant.

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Python, FastAPI
- RAG: LangChain, LangGraph, PostgreSQL + pgvector
- Storage: JSON reference snapshots and PostgreSQL

## Sources of truth
- `요구사항정의.pdf`: mandatory assignment requirements (F2001–F2012 take priority).
- `docs/design/PROJECT_SPEC.md`: product scope, architecture, and phased plan.
- `docs/`: read only the relevant design documents for the task.
- Verify current Pokémon Champions mechanics and regulation eligibility before coding them. Do not transplant Scarlet/Violet mechanics without verification.

## Working rules
- Inspect existing code before editing; keep changes focused on the requested phase.
- Use snake_case in Python, camelCase in TypeScript, and clear module boundaries.
- Keep UI, API, RAG, retrieval data, and battle calculations separate.
- Prefer simple solutions; avoid unnecessary abstractions and dependencies.
- Never commit secrets, invent source facts, fabricate damage/KO/win rates, or present heuristic scores as probabilities.
- Distinguish verified, assumed, and unknown battle information in outputs.
- Record data sources, licenses, and collection dates.
- Run relevant tests; report failures and unverified behavior rather than claiming completion.

## Workflow
- Perform all frontend and backend work on `develop` unless the user explicitly requests another branch.
- For major changes, state a short plan and implement one phase at a time.
- Do not start a later phase without a user request.
- Explain changes, tests, limitations, and next steps in Korean.

## Documentation and PR style
- Apply this style to all project-authored Korean Markdown, README files, design documents, reports, result summaries, and pull request titles/descriptions, including newly created files.
- Use concise noun-style endings such as `구현함`, `수정함`, `확인함`, `미확인임`, `변경`, `유지`, and `통과`; avoid narrative endings such as `~다`, `~했다`, `~있었다`, and `~습니다`.
- Prefer short bullets and comparison tables to long narrative paragraphs. Preserve the meaning, scope, dates, counts, source links, and technical identifiers.
- Describe development work as concrete changes and resulting behavior. Separate implementation, validation, limitations, and next steps when relevant.
- Describe resolved issues in `원인 → 수정 → 결과` order, preferably as table columns. Keep unverified behavior and remaining limitations explicit; never invent a successful result.
- Keep PR descriptions focused on the final diff and reviewer-relevant validation; omit conversational history and unrelated details.
- Keep README public-facing: project overview, key features, minimal setup, essential usage constraints, and documentation/source links. Keep phase progress, assignment interpretations, detailed implementation notes, and validation reports in dedicated documents.
- Preserve verbatim quotations, third-party source/license text, raw execution logs, generated evidence snapshots, code examples, and UI/prompt text in their original context rather than changing them solely to satisfy documentation style.
- Do not edit `docs/design/PROJECT_SPEC.md` or unrelated instructions in this file solely to standardize prose unless the user explicitly requests it.
