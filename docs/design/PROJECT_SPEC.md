# PokeTact — Project Specification

> **Purpose:** Build a Pokémon Champions ranked-singles preparation and battle-review assistant that combines verifiable RAG evidence with deterministic battle analysis.
>
> **Current priority (2026-10-23):** User-directed production operation takes precedence. Use the assignment PDF as an optional RAG design reference, not a source of mandatory counts, technologies, submissions, or approval gates. Preserve useful retrieval, citation, caching, and verification principles; choose implementation order based on usability, reliability, security, operating cost, and maintainability.
>
> **Status:** Design proposal. Game-specific details marked **VERIFY** must be checked against current official sources before implementation. The initial candidate regulation is **M-C**, not an assumption that it will always be current.

## 1. Product overview

Users can browse Pokémon, ask sourced strategy questions, build their six-Pokémon team, inspect an opposing team, compare three-Pokémon selection candidates, and evaluate attack/switch/Mega Evolution decisions. The MVP must be a usable **RAG knowledge service**, not merely a standalone type calculator.

Primary use case: team preparation and post-battle review. Check tournament/platform rules before promoting use as a live external assistant.

### Product capabilities

| Priority | Deliverable | Scope |
|---|---|---|
| P0 | Evidence-based RAG | Pokémon metadata covering the supported product scope; external-document search, filtering, collection, chunking and indexing; sourced Q&A; two collections; LangGraph retrieve/generate |
| P0 | Service requirements | Pokémon selection, separate conversations, natural-language filtered search, at least one domain-specific feature, progress/errors |
| P1 | React experience | Pokédex, evidence-linked chat, team-entry UI, dark visual language, responsive behavior |
| P1 | Basic team/battle coach | Type effectiveness, defensive matchup overview, explainable candidate switching; explicit assumptions |
| P2 | Advanced battle reasoning | Select 3 from 6, Mega scenarios, action ranking with opponent scenarios |
| P3 | Precise mechanics | Verified Champions stat/damage engine, damage ranges, conditional KO probability, advanced simulation |

These priorities are planning guidance. Choose work based on current user needs and production risks rather than a fixed implementation order.

## 2. Tech stack and architecture

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui, React Router, Lucide React. Add TanStack Query for server-state; Zustand only if cross-page client state truly requires it.
- **Backend:** Python 3.10+, FastAPI, Pydantic, Uvicorn, pytest, python-dotenv.
- **RAG:** LangChain, LangGraph (at minimum `retrieve` and `generate`), PostgreSQL + pgvector, model API configured via environment; LangSmith optional if supported by environment.
- **Storage:** JSON for curated reference data; PostgreSQL for locally saved teams, conversations, jobs, source caches, and pgvector semantic indexes.
- **Database responsibilities:** PostgreSQL stores application state, document/index manifests, and both logical vector collections through pgvector.
- **Calculation:** Python rule engine for validated type/legality checks. Investigate `@smogon/calc` and an optional isolated Node service for Champions-compatible calculations; do not assume generic Gen 9 formulas are sufficient.
- **Dependency versions:** Use project manifests and lockfiles as the reproducible baseline; assess compatibility, security, and operating cost when changing dependencies.

```text
React (Vite) UI
   | REST / optional SSE
FastAPI (validation, API, app services)
   |-- RAG: LangGraph retrieve -> generate
   |     |-- PostgreSQL/pgvector: pokemon_meta
   |     `-- PostgreSQL/pgvector: pokemon_docs
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

## 4. RAG quality principles

| Area | Design principle | Useful verification |
|---|---|---|
| Metadata | Validated, searchable Pokémon attributes with stable IDs | Representative text and idempotent indexing |
| Source discovery | Structured query extraction and relevant candidate selection | Query parsing, accepted/rejected sources, subject relevance |
| Collection | Permitted sources, provenance, caching, and clear partial failures | Source URLs, cache reuse, timeout/error behavior |
| Chunking | Configurable chunk size/overlap and stable document associations | Relevant context retained, stale chunks handled |
| Retrieval | Relevant metadata and document chunks; deduplication and configurable Top-k | Grounded retrieval across representative user questions |
| Generation | Clear retrieval/generation boundaries and structured responses | Unsupported claims rejected; insufficient evidence acknowledged |
| Citations | Only sources actually supporting the answer are displayed | Claim/source agreement and clickable links |
| Conversations | Explicit context and session isolation | Persistence and unauthorized-access checks |
| Discovery | Structured predicates for exact conditions | Boundary values, false positives, unknown attributes |
| UX | Progress, empty states, actionable errors, and retry behavior | Normal/error paths and mobile usability |

Keep source licensing, safe errors, secret protection, request courtesy, and modular boundaries. Use MMR, multiple source types, and RAG/no-RAG comparisons when they improve measured quality; no fixed question count or submission evidence is required.

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

**`pokemon_meta`**: one idempotently indexed entry per Pokémon. Search text should include the attributes users ask about, not just the name. Store vector metadata as JSONB, with exact equality filters and collection-level embedding identity/dimension validation.

**`pokemon_docs`**: chunked explanations/strategy sources with `pokemon_id`, `document_id`, `title`, `source_type`, `source_url`, `battle_format`, `regulation_id`, `collected_at`, `chunk_index`, `licence` when available. Stable IDs such as `pokemon_id:document_id:chunk_index` avoid overwriting other item-document associations.

Strategy advice from other formats (for example Showdown 6v6, past mainline games, VGC doubles) must be labeled and not treated as verified Champions singles strategy.

## 6. Data collection and RAG pipeline

Collection/index preparation:

1. Load and validate metadata for the supported Pokémon catalog, build searchable text, upsert into `pokemon_meta`.
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

### 7.1 Pokédex + sourced chat

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
└── docs/
    ├── design/{PROJECT_SPEC.md,ARCHITECTURE.md,API_SPEC.md}
    ├── guides/{DATA_SOURCES.md,OPERATIONS.md}
    └── private/LEARNING_GUIDE.md  # ignored local learning guide
```

Do not create empty boilerplate directories unnecessarily. Start small and evolve as features are implemented.

## 11. Development priorities

Choose work based on the current user objective, existing implementation, and production risks. Implement in reviewable increments; no fixed phase sequence or per-phase approval is required.

- **RAG quality:** validated metadata, reliable collection/cache/chunking, relevant retrieval, grounded generation, and citations
- **User experience:** Pokédex, chat, conversation context, discovery, progress, errors, and mobile usability
- **Battle assistance:** team building, matchup analysis, selection candidates, action alternatives, and explicit assumptions
- **Advanced analysis:** verified damage calculations, MMR, additional sources, and representative answer-quality comparisons when useful
- **Production operation:** server-side credentials, access controls, usage/spend limits, deployment, HTTPS, database backups, and operational diagnostics

## 12. Quality verification

- Stable indexing after rerun; representative metadata and retrieval coverage inspected
- Subject-relevant documents retained; candidate filtering and cache behavior verified
- Chunk size/overlap and Top-k evaluated against retrieval quality when changed
- Retrieval and generation boundaries tested; source IDs and displayed citations agree
- Insufficient evidence yields explicit uncertainty; unknown battle inputs do not produce invented numeric results
- Conversation context and session isolation verified; filters do not present false positives as exact matches
- API secret safety, clean errors, data-source licenses, and request courtesy validated
- Representative RAG/no-RAG comparisons used when needed to assess accuracy, citations, and abstention
- Relevant tests executed and remaining unverified behavior reported honestly
