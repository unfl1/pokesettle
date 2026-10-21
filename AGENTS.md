# AGENTS.md

## Project
PokeTact is a RAG-based Pokémon Champions ranked singles strategy assistant.

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Python, FastAPI
- RAG: LangChain, LangGraph, ChromaDB
- Storage: JSON and SQLite

## Sources of truth
- `요구사항정의.pdf`: mandatory assignment requirements (F2001–F2012 take priority).
- `PROJECT_SPEC.md`: product scope, architecture, and phased plan.
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
