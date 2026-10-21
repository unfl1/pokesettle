# PokeTact — Project Specification

> **Purpose:** Build a Pokémon Champions ranked-singles preparation and battle-review assistant that combines verifiable RAG evidence with deterministic battle analysis.
>
> **Priority:** The attached assignment PDF is authoritative for F2001–F2012 and associated verification. This document expands the product design without overriding the assignment.
>
> **Status:** Design proposal. Game-specific details marked **VERIFY** must be checked against current official sources before implementation. The initial candidate regulation is **M-C**, not an assumption that it will always be current.

## 1. Product overview

Users can browse Pokémon, ask sourced strategy questions, build their six-Pokémon team, inspect an opposing team, compare three-Pokémon selection candidates, and evaluate attack/switch/Mega Evolution decisions. The MVP must be a usable **RAG knowledge service**, not merely a standalone type calculator.

Primary use case: team preparation and post-battle review. Check tournament/platform rules before promoting use as a live external assistant.

### MVP versus stretch goals

| Priority | Deliverable | Scope |
|---|---|---|
| P0 | Mandatory RAG | Pokémon metadata >=100; external-document search, filtering, collection, chunking and indexing; sourced Q&A; two collections; LangGraph retrieve/generate |
| P0 | Service requirements | Pokémon selection, separate conversations, natural-language filtered search, at least one domain-specific feature, progress/errors |
| P1 | React experience | Pokédex, evidence-linked chat, team-entry UI, dark visual language, responsive behavior |
| P1 | Basic team/battle coach | Type effectiveness, defensive matchup overview, explainable candidate switching; explicit assumptions |
| P2 | Advanced battle reasoning | Select 3 from 6, Mega scenarios, action ranking with opponent scenarios |
| P3 | Precise mechanics | Verified Champions stat/damage engine, damage ranges, conditional KO probability, advanced simulation |

P0 takes precedence over visual polish and optional combat features.

## 2. Tech stack and architecture

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui, React Router, Lucide React. Add TanStack Query for server-state; Zustand only if cross-page client state truly requires it.
- **Backend:** Python 3.10+, FastAPI, Pydantic, Uvicorn, pytest, python-dotenv.
- **RAG:** LangChain, LangGraph (at minimum `retrieve` and `generate`), ChromaDB, model API configured via environment; LangSmith optional if supported by environment.
- **Storage:** JSON for curated reference data; PostgreSQL for locally saved teams, conversations, jobs, and source caches; ChromaDB for semantic indexes.
- **Database responsibilities:** PostgreSQL stores application state and document/index manifests; ChromaDB stores RAG metadata and document vectors. Keep the two Chroma collections and the assignment-specified Chroma dependencies.
- **Calculation:** Python rule engine for validated type/legality checks. Investigate `@smogon/calc` and an optional isolated Node service for Champions-compatible calculations; do not assume generic Gen 9 formulas are sufficient.
- **Dependency versions:** Check the assignment PDF's specified package versions before installation. Record any justified deviations.

```text
React (Vite) UI
   | REST / optional SSE
FastAPI (validation, API, app services)
   |-- RAG: LangGraph retrieve -> generate
   |     |-- Chroma: pokemon_meta
   |     `-- Chroma: pokemon_docs
   |-- reference JSON / PostgreSQL
   `-- battle analyzer / optional dedicated damage service
```

Keep the API/UI functional even if the optional damage calculation service is not installed.

## 3. Pokémon Champions mechanics and data integrity

**VERIFY against official/current sources before locking behavior:** ranked singles party size and selection, level normalization, applicable regulation dates and eligibility, Mega Evolution restrictions, Pokémon/move/item availability, stat-training mechanics, damage mechanics, and permitted battle actions.

The intended product is **Champions singles** (team of six, select three, as verified). Treat **M-C** as an initial regulation dataset candidate only. Regulation rules, dates and eligibility belong in external config, not conditionals scattered through code. Never silently reuse Scarlet/Violet Terastallization or EV/IV rules.

Separate three confidence classes in every relevant model and UI:

- `verified`: confirmed source-backed rules or known user-entered battle information;
- `assumed`: scenario inputs and hypothesized opponent sets;
- `unknown`: unobtained facts that must not be fabricated.

Potential sources to investigate (do not assume every field is up to date for Champions):

- Official Champions site/news and regulation notices: <https://champions.pokemon.com/>
- PokéAPI documentation for baseline species/moves/abilities: <https://pokeapi.co/docs/v2>
- Smogon open-source damage calculator for compatibility assessment: <https://github.com/smogon/damage-calc>

Record URL, collection time, usage rights, game/format applicability, and verification status. Preserve original Korean/English names or confirmed mappings. Do not represent generic Pokémon data as regulation-legal Champions data without verification.

## 4. Required assignment traceability

| Requirement | Implementation | Acceptance evidence |
|---|---|---|
| F2001 | Load >=100 Pokémon metadata records; build one searchable text per item | Count and sample indexed text |
| F2002 | Upsert stable IDs into `pokemon_meta` | Index count unchanged after rerun |
| F2003 | LLM query-extraction prompt, parseable result | Captured search-keyword example |
| F2004 | Search external source and LLM-filter candidate documents; always include subject's own document | Accepted/rejected candidate sample and URLs |
| F2005 | Configurable size/overlap chunking into separate `pokemon_docs` | Chunk records, source metadata, count changes |
| F2006 | Retrieve selected item metadata + relevant document chunks; merge/dedupe, configurable Top-k | Retrieval result sample |
| F2007 | LangGraph nodes `retrieve` and `generate`; grounded answer; abstain when unsupported | Graph and negative test |
| F2008 | Citation markers in claims; only actually cited source titles/links shown | UI citation-link test |
| F2009 | Item selection and per-item chat histories | Switching-item persistence test |
| F2010 | Domain-specific feature using evidence (e.g., sourced matchup explanation) | Feature output with citations |
| F2011 | Natural-language conditions -> candidate retrieval + true predicate validation | Query with matching/nonmatching examples |
| F2012 | Progress, missing-index/key/empty-results states and relevant warnings | Screenshots of normal/error states |

Also address NF2001–NF2007 from the PDF: responsive runtime, collection cache, secret handling, safe error messages, modularity, polite API use, and documented rights. Optional deepening: F2013 custom HTML/CSS/JS UI (check React acceptance with instructor), F2014 MMR, F2015 RAG vs no-RAG analysis (>=5 representative questions), F2016 multiple source types.

**Important:** The provided assignment requires selected-item metadata to be included in evidence even if similarity search would not retrieve it, and subject-specific documents to be retained during candidate filtering. Do not overlook these constraints.

## 5. Data model

### 5.1 `pokemon.json`

Suggested fields: `pokemon_id`, `name_ko`, `name_en`, `types`, `base_stats` (hp/attack/defense/sp_attack/sp_defense/speed), `abilities`, `available_moves`, `mega_forms`, `champions_eligibility_status`, `eligible_regulations`, `description`, `source_url`, `verified_at`.

Store unknown fields as `null`/unknown, not guessed values. Baseline species properties and live regulation eligibility must have separate provenance.

### 5.2 Supporting datasets

- `moves.json`: ID, type, physical/special/status, power, accuracy, priority, PP, effects, legality status.
- `abilities.json`: ID, explanation, calculation interactions, provenance.
- `mega_evolutions.json`: base/form IDs, Mega constraints, stat/type/ability transformations; validate each.
- `type_chart.json`: effective chart for target ruleset, with explicit generation/format.
- `regulations/m_c.json`: regulation ID, official source, effective dates, eligible Pokémon/forms, rules, last verified date.
- user-built combat sets: species, form, level, stat training parameters *appropriate to Champions*, ability/item/moves, known/unknown status.
- battle state: active Pokémon, HP, statuses, boosts, revealed moves, benches, field conditions, Mega status, confidence of enemy assumptions.

### 5.3 Vector collections

**`pokemon_meta`**: one idempotently indexed entry per Pokémon. Search text should include the attributes users ask about, not just the name. Chroma metadata values must be flattened to supported scalar forms as needed.

**`pokemon_docs`**: chunked explanations/strategy sources with `pokemon_id`, `document_id`, `title`, `source_type`, `source_url`, `battle_format`, `regulation_id`, `collected_at`, `chunk_index`, `licence` when available. Stable IDs such as `pokemon_id:document_id:chunk_index` avoid overwriting other item-document associations.

Strategy advice from other formats (for example Showdown 6v6, past mainline games, VGC doubles) must be labeled and not treated as verified Champions singles strategy.

## 6. Data collection and RAG pipeline

Collection/index preparation:

1. Load and validate 100+ metadata records, build searchable text, upsert into `pokemon_meta`.
2. Select Pokémon and user question; LLM **Prompt 1** extracts source queries as parseable JSON.
3. Search permitted outside sources; collect candidate titles/summaries.
4. LLM **Prompt 2** ranks/selects relevant candidates **without excluding the source document dedicated to the selected Pokémon**.
5. Fetch original body and URL (or file and page), respect usage terms, cache fetched queries/documents.
6. Split using configurable `CHUNK_SIZE` and `CHUNK_OVERLAP`; upsert into `pokemon_docs` with stable document metadata.

Question-answer flow:

1. Always include the selected Pokémon's metadata chunk.
2. Retrieve external document chunks filtered or associated with the selected Pokémon; configurable Top-k and optional MMR.
3. Merge, deduplicate, number citations, and pass exclusively sourced context plus separately labeled deterministic engine results into **Prompt 3**.
4. LangGraph `retrieve -> generate`; no source -> acknowledge uncertainty rather than making up facts.
5. Return answer plus only evidence actually cited, including title, origin URL/type, and citation markers.
6. Keep conversations separated per selected Pokémon. Show collecting/retrieving/generating states and errors.

Prompts must have clearly defined purposes and structured output where required. Store default chunking, Top-k, API retries, source caching and timeouts in configuration.

## 7. Product features

### 7.1 Pokédex + sourced chat (mandatory)

Search/select Pokémon; show verified types, abilities, stats, Mega forms, metadata source and availability status. Chat with cited evidence and clickable source links. Support natural-language item discovery (e.g. high Speed, Dragon type, documented Ground immunity). Use structured filtering for exact numerical/boolean predicates; semantic retrieval for descriptions and qualitative strategy.

### 7.2 Team Builder

Build/save six-Pokémon user team and enter six-Pokémon opponent preview; validate duplicate/species/legality rules against the selected regulation where verified. Show offensive coverage, shared weaknesses, likely role gaps and clearly labeled opposing assumptions.

### 7.3 Select three

Enumerate `C(6,3)=20` legal candidate subsets and compare coverage, defensive switching options, opponent threats and Mega availability. Propose lead and roles; include limitations. Explainable heuristic scores are **not** calibrated game-win probabilities.

### 7.4 Battle Coach

Inputs: current active pair, HP, your moves, bench, revealed opponent moves, items/abilities when known, stages, hazards/weather/field, Mega used/status. Compare attack, switch, and legal Mega-associated actions; compute known type effects deterministically and add uncertainty for unrevealed information.

Output should contain recommended action, alternatives, reasons, entry damage or other risks, assumed enemy scenarios, calculation status and supporting retrieved citations. A super-effective attack or unfavorable defending type alone is not enough to claim a certain best move.

### 7.5 Advanced damage/KO (optional)

Before implementing, verify damage-library behavior against Champions rules and known examples. Provide calculation input assumptions and correct damage distributions (including accuracy/turn-order assumptions where relevant). Clearly distinguish `P(KO | hit and specified set)` from unconditional action success and from match win rate. If exact calculations cannot be verified, mark as unsupported rather than emitting illustrative values as real results.

## 8. API contract (draft; refine with Pydantic models)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/pokemon` | List/search Pokémon |
| GET | `/api/pokemon/{id}` | Pokémon details |
| POST | `/api/pokemon/search` | Natural-language filtered Pokémon discovery |
| POST | `/api/chat` | Grounded RAG Q&A |
| POST | `/api/chat/stream` | Optional SSE answer stream |
| POST | `/api/teams/analyze` | Team matchup analysis |
| POST | `/api/teams/select` | Three-Pokémon recommendation |
| POST | `/api/battle/analyze` | Active matchup analysis |
| POST | `/api/battle/recommend` | Attack/switch/Mega decision ranking |
| POST | `/api/battle/damage` | Optional verified damage calculation |

Use consistent schemas for `facts`, `assumptions`, `unknowns`, `calculation`, `citations`, `errors`, and regulation identifier. Keep API keys server-side. Use configurable CORS in development.

## 9. UX and UI

Theme: independently designed, Pokémon-inspired dark strategy dashboard: navy base, legible type badges, team cards, stat diagrams, HP bars, reason/risk callouts, optional Mega state indicator. Do not simply copy proprietary official interface assets.

Pages:

1. **Pokédex:** selector/search, verified profile, sourced chat, evidence cards, natural-language discovery.
2. **Team Builder:** six + six team entry, storage, threat overview, recommended selection three with assumptions.
3. **Battle Coach:** active matchup, editable HP/moves/known facts, action comparison, Mega decision and explainable sourced output.

Components: `AppLayout`, `PokemonCard`, `PokemonSelector`, `TypeBadge`, `StatsPanel`, `HPBar`, `TeamBuilder`, `BattleField`, `ChatPanel`, `ChatMessage`, `EvidenceCard`, `RecommendationCard`, `DamageRange` (only when calculated). Accessible forms, loading skeletons, empty states, error/retry displays, mobile-readable chat. The UI must label mock data until real endpoints are integrated.

## 10. Recommended repository layout

```text
poketact/
├── AGENTS.md
├── PROJECT_SPEC.md
├── 요구사항정의.pdf
├── README.md
├── .gitignore
├── .env.example
├── frontend/
│   └── src/{app,components,pages,hooks,services,stores,types,styles}/
├── backend/
│   ├── main.py
│   ├── api/
│   ├── models/
│   ├── rag/{vector_store.py,retriever.py,prompts.py,graph.py}
│   ├── battle/{type_analyzer.py,stat_calculator.py,battle_evaluator.py,switch_recommender.py,team_selection.py}
│   ├── services/
│   ├── scripts/
│   └── tests/
├── damage_service/           # optional; add only if needed
├── data/{regulations,documents}/
└── docs/{REQUIREMENTS.md,ARCHITECTURE.md,API_SPEC.md,DATA_SOURCES.md,TEST_RESULTS.md}
```

Do not create empty boilerplate directories unnecessarily. Start small and evolve as features are implemented.

## 11. Implementation phases

**Phase 0 — Plan only:** inspect repository and PDF, map F2001–F2012 and NF items, verify Champions sources/mechanics/usage conditions, define data schemas, API contract and technical risk register. Output `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, `docs/API_SPEC.md`. **Stop before implementation.**

**Phase 1 — Mandatory RAG data and backend:** 100+ validated records; both Chroma collections; three prompts; outside documents + selection + caching + chunking; LangGraph retrieval/generation and source citations; tests F2001–F2008.

**Phase 2 — Mandatory UX and integration:** React/Vite setup, Pokédex and chat, item-specific history, conditional discovery, a cited Pokémon-specific service feature, progress/empty/error states, API integration; test F2009–F2012 and full mandatory suite.

**Phase 3 — Battle assistant:** team builder, type matchup, three-selection heuristic, attack/switch alternatives, cautious Mega state analysis; maintain source/assumption distinction.

**Phase 4 — Optional advanced work:** verified damage and conditional KO engine, MMR, dual-source indexing, RAG-before/after quality comparison, UI refinements and submission evidence.

Each phase requires a concise report: changed files, tests executed/results, completed requirement IDs, remaining gaps, and blockers. Do not claim unrun tests have passed. Do not start the next phase without explicit approval.

## 12. Acceptance and submission checks

- Index count >=100 and unchanged after rerun; representative metadata text inspected.
- Collected subject-specific document retained; candidate rejection and cache behavior demonstrated.
- Adjustable chunk size/overlap and Top-k demonstrate observable retrieval differences.
- `retrieve` and `generate` graph nodes shown; source IDs and displayed citations agree.
- No sourced evidence yields an explicit abstention; unknown battle inputs do not produce invented numeric results.
- Chat context is separated per Pokémon; filters do not present false-positive candidates as exact matches.
- API secret safety, clean errors, data-source licenses and request courtesy validated.
- Optional RAG-before/after comparison: at least five challenging questions, accuracy/citation/abstention comparison.
- Submit requirement matrix, pipeline design, source code, data collection/index scripts, self/peer checklists, evidence screenshots, README, and any chosen advanced-task evidence specified in PDF.

## 13. First Codex instruction (Phase 0 only)

Read `AGENTS.md`, this `PROJECT_SPEC.md`, and `요구사항정의.pdf`. Treat mandatory requirements from the original PDF as authoritative. Check external rules/data you can actually verify; list unknowns instead of guessing. Create `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, and `docs/API_SPEC.md` with the F2001–F2012 mapping, regulated Pokémon data plan, two-collection RAG flow, proposed API and phase breakdown. **Do not implement application code in this first task.** Report results and wait for approval of Phase 1.
