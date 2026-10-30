# 데이터 출처 및 Champions 검증 기록

확인일: 2026-10-21 (Asia/Seoul). 이 날짜는 웹 문서 **확인일**임. 실제 데이터셋 수집일이나 100건 확보일이 아님. 현재 수집·색인 데이터는 0건임.

> 위 문장은 Phase 0 조사 당시 기록임. **Phase 1에서는 실제 100종과 자체 설명 문서 100개를 확보했다.** 현재 수집 내역은 아래 7절 및 [출처 기록](../../data/sources.json)를 따름. 공식 Champions 규칙의 미확인 사항은 해소된 것으로 간주하지 않음.

## 1. 출처 등록부

| ID | 원문 / 용도 | 이번 확인 내용 | 이용 조건과 제한 | 도입 상태 |
|---|---|---|---|---|
| S01 | [Champions Gameplay](https://champions.pokemon.com/en-us/gameplay/) / 게임·포맷 개요 | 랭크·캐주얼·프라이빗, 싱글·더블 제공, 시즌별 규칙 변경 | 공개 열람을 재배포 허가로 간주하지 않음 | 규칙 참고만 |
| S02 | [M-C 공식 공지](https://champions-news.pokemon-home.com/en/page/816.html) / 기간·메가·아이템 규칙 | 아래 검증표 참조 | 원문 링크·확인일 보존. 대량 수집/본문 재배포 권한은 미확인 | 규칙 사실 확인 |
| S03 | [공지에서 연결한 Eligible Pokémon](https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178713870219xeaaio/en/pokemon.html) / 적격 종·폼 | 페이지 제목만 추출됨. 전체 목록·건수 확인 불가 | 렌더링 목록과 게임 내 규칙을 추후 대조. 비공개 API 추측 금지 | 미확인, 적격 명단 생성 금지 |
| S04 | [Champions Pokémon](https://champions.pokemon.com/en-us/pokemon/) / 육성·기술 적용 범위 | VP로 능력치·특성·기술 조정 가능, HOME 기술 중 사용 불가 기술 존재 | 세부 수치 공식은 이 안내로 검증되지 않음 | 개요만 확인 |
| S05 | [PokéAPI v2 문서](https://pokeapi.co/docs/v2) / 기초 종·폼·이름·타입·특성·기술 | GET, 리소스/페이지네이션과 로컬 캐시 정책 확인 | [프로젝트 라이선스](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/LICENSE.md)는 저작권·조건 보존 및 비보증/추천 제한을 규정. 소프트웨어 라이선스가 이미지·캐릭터 등 모든 권리를 포괄한다고 해석하지 않음 | 100건 이상 메타 확보 후보, 실제 응답/수량 미검증 |
| S06 | [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page), [API 예절](https://www.mediawiki.org/wiki/API:Etiquette) / 종별 설명 문서 검색·본문 수집 | 예절 문서에서 연락처 포함 User-Agent, 직렬 요청·캐시·백오프 지침 확인 | [Wikimedia 이용약관 7절](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)과 개별 문서의 라이선스·이력·예외 확인. CC BY-SA 4.0 등 해당 조건에 따라 저자 표시·라이선스·변경 사실 보존 | 한국어 위키백과 우선 후보. 종별 단독 문서 커버리지 미확인 |
| S07 | [Smogon damage-calc](https://github.com/smogon/damage-calc) / Phase 4 계산 호환성 조사 | 공식 저장소와 MIT 표기 확인 | 채택 시 고정 커밋·라이선스 전문·Champions 재현 사례 필요 | 설치하지 않음. Champions 호환성 미검증 |
| S08 | [Pokémon 이용약관](https://www.pokemon.com/us/terms-of-use/) / 공식 사이트 활용 조건 | 링크는 확인했으나 본문 추출 불가 | 자동 수집·원문 재배포·경기 중 외부 지원 허용 여부 확인 안 됨 | 확인 보류 |

위키백과의 원문은 커뮤니티 설명 자료이며 Champions의 규칙을 확정하는 1차 자료가 아님. 게임 적용 범위를 `generic` 또는 해당 게임/포맷으로 저장함. 사용 조건이 확인되지 않은 전략 사이트·검색 요약·공식 이미지를 수집 데이터로 임의 채택하지 않음. 과제 PDF는 요구사항 분석 자료이며 Pokémon 지식 컬렉션에 넣지 않음.

## 2. 규칙별 확인 상태

공식 M-C 공지(S02)에 따라 적용 기간은 **2026-09-09 02:00 UTC~2026-12-02 01:59 UTC**이며, 한국 시각은 **2026-09-09 11:00~2026-12-02 10:59**임. 확인일을 포함하므로 현재 설계의 후보 규칙으로 사용함. 공지 수정 가능성을 고려해 실제 사용 전에 재확인함.

| 규칙 | 상태 | 근거 / 적용 결정 |
|---|---|---|
| 랭크 싱글 포맷 존재 | verified | S01. 더블 자료를 싱글의 확정 전략으로 취급하지 않음 |
| M-C 기간 | verified | S02. 위 UTC 기간과 확인일 저장 |
| 메가진화 | verified (공지 범위) | S02. 특정 포켓몬이 메가스톤을 지녔을 때 가능, 대전당 1회. 폼별 적격성과 행동 순서는 별도 검증 |
| 중복 도구 제한 | verified | S02. 세부 예외를 추측하지 않음 |
| 참가 종·폼 전체 목록 | unknown | S03 본문 미확인. 이번 조사에서 적격 종 수/목록을 만들지 않음 |
| 6마리 등록·3마리 선출 | assumed, 제품 의도 | PROJECT_SPEC의 목표이나 이번 공식 자료에서 직접 확인 못함. Phase 3 구현 전 게임 내 싱글 규칙 또는 공식 상세 자료 필요 |
| 레벨 정규화, 종 중복 제한 | unknown | 검증된 상세 규칙 필요. 레벨 50 등 타 게임 규칙을 기본값으로 쓰지 않음 |
| 육성 수치 범위·총합·능력치 공식 | unknown | S04는 조정 가능성만 확인. EV/IV 수치를 그대로 도입하지 않음 |
| 기술·특성·도구 사용 가능 목록 | 부분 확인 / 개별 항목 unknown | S04에 사용 불가 기술 존재. PokéAPI 수록 여부로 적격 판정 불가 |
| 타입 배율·특성 예외·메가 행동 순서·데미지 공식 | unknown | Champions 적용 자료와 재현 사례 확인 후 계산 허용 |
| 경기 중 외부 보조 도구 사용 | unknown | 대회/플랫폼별 규정 별도 확인. 제품 목적은 준비·복기 |

`verified`는 특정 근거·필드·시점에만 적용함. 공지에서 메가진화를 확인했다고 모든 폼의 능력치와 기술까지 검증된 것은 아님.

## 3. 데이터 확보 계획

1. Phase 1에서 PokéAPI 리소스와 종·폼 매핑을 확인하고, 이름·타입·기초 능력치·특성·출처를 갖춘 **고유 기본 항목 100건 이상**의 로드 결과를 기록함. 원본은 수정하지 않고 정규화본과 분리함.
2. 공식 적격 목록을 대조할 수 있으면 교집합을 우선함. 일반 도감 100건과 '현재 적격이 검증된 100종'은 별개 지표임. 교집합이 부족하거나 미확인이라면 일반 참고 데이터임을 표시하고 적격 질문에는 유보함.
3. 항목별 단독 문서의 제목·정규 URL·문서 ID·버전·이용 조건을 확보함. 여러 종을 다룬 목록 문서는 단독 문서와 동일하다고 자동 판정하지 않음. 종별 문서 부족은 요구사항 위험으로 보고함.
4. 수집 권한이 확인된 문서에 한해 외부 검색→LLM 선별→본문 수집을 수행함. 종 자체 문서는 선별·길이 규칙보다 우선함. 권리/접근 문제로 수집 불가능하면 실패 상태를 남기고 허용된 제공 문서 묶음 등 PDF 13쪽 대체 경로를 검토함. 허구 본문으로 채우지 않음.
5. 언어별 이름은 공급자 ID와 공식/확인된 매핑을 사용하고, 한국어 이름이 없으면 `null`과 영문 이름을 표시함. 유사한 이름을 번역해 정식 명칭으로 저장하지 않음.
6. 전략 문서에 `game`, `battle_format`, `regulation_id`, 적용 기간을 붙임. 과거 본가·Showdown 6v6·VGC 더블의 설명은 출처 포맷으로 표시하고 Champions 싱글의 확정 조언에서 제외함.

## 4. 출처·권리 레코드 계약

실제 수집 시 다음 필드를 문서와 데이터 필드의 provenance에 연결함. 필드명은 내부 snake_case임.

| 필드 | 타입 / 의미 |
|---|---|
| `source_id`, `title`, `source_type` | 안정 ID, 제목, `api`/`web`/`wiki`/`pdf`/`curated` |
| `source_url`, `file_name`, `page_start`, `page_end` | URL 또는 파일명+쪽. PDF는 쪽 정보 필수 |
| `publisher`, `author_attribution`, `revision_id` | 발행처·저자 표시·원문 버전. 없는 정보는 null |
| `checked_at`, `collected_at`, `verified_at` | UTC ISO 8601. 확인·실제 수집·규칙 검증을 구분 |
| `licence`, `licence_url`, `usage_notes`, `rights_status` | 실제 조건·표시 방법·`approved`/`pending`/`blocked`. 미확인을 임의 라이선스로 채우지 않음 |
| `content_hash`, `transformation_notes` | 변경 감지, HTML 제거·청킹·번역 등 변형 기록 |
| `game`, `battle_format`, `regulation_id` | 게임 적용 범위. 불명확하면 unknown/null |
| `verification_status`, `verified_fields` | 검증 등급과 검증된 필드 경로. 정보 제공자 확인과 Champions 적용 확인을 구분 |

공식 규칙 갱신 시 기존 버전을 삭제해 덮어쓰지 않고 새 스냅샷으로 보존함. 기간이 지난 버전을 현재 규칙으로 자동 사용하지 않음. 오래된 대화는 당시 인용 스냅샷과 규칙을 유지함.

## 5. 호출과 캐시 정책 제안

- 출처별 직렬 호출, 초기 간격 1초, HTTP timeout 15초, 일시 오류 재시도 최대 2회. 이는 프로젝트 초기 설정이며 공급자의 고정 제한이라고 주장하지 않음.
- 429/일시적 5xx는 Retry-After를 우선하고 지수 백오프를 적용함. 영구 오류/금지 응답은 무작정 재시도하지 않음.
- 연락 가능한 실제 정보가 포함된 User-Agent를 서버 설정으로 제공함. 가짜 이메일이나 브라우저 위장 문자열을 쓰지 않음.
- 정규화 검색어·출처·언어·스코프를 키로 성공 결과를 저장함. 성공 캐시에 자동 TTL 재수집은 두지 않고 명시적 갱신만 허용함. 같은 질문은 저장된 검색어와 원문을 재사용함.
- 본문 캐시는 정규 URL+원문 버전/해시로 별도 관리함. 검색어가 달라도 같은 원문을 다시 내려받지 않음. 중간 실패는 완료 캐시로 기록하지 않음.
- 규칙 재확인은 명시적 갱신 작업으로 처리함. 캐시 재사용과 규칙 최신성은 별도 상태로 표시함.

## 6. 남은 확인과 중단 조건

Phase 1 첫 조사에서 100개 항목·자체 문서·허용된 수집 경로를 증명함. 실제 다운로드·재배포 조건, 개별 문서 라이선스, 공식 적격 명단, 패키지 버전 사용 가능성은 아직 확인되지 않음. 이 상태에서 데이터 확보 완료나 Champions 배틀 계산 지원을 표시하지 않음. 일반 지식 RAG와 규칙 미확인 상태의 동작은 병행 설계할 수 있지만, 미확인 규칙에 의존하는 계산과 적격 판정은 구현 게이트로 남김.

## 7. Phase 1 실제 수집·연동 기록

- 수집일: 2026-10-21. 기초 자료는 PokéAPI 공식 저장소의 `data/v2/csv/` 내 pokemon, pokemon_stats, pokemon_types, types, pokemon_abilities, abilities, pokemon_species_names 7개 CSV임. URL·정규화 전 원문 해시·실제 UTC 수집 시각은 [`data/sources.json`](../../data/sources.json)에 있음.
- 기본 종 ID 1~100의 기본 폼만 선별해 [`data/pokemon.json`](../../data/pokemon.json)에 100건을 저장함. 한국어 이름은 공급자의 한국어 언어 ID 3 매핑을 사용함. 원문에 없는 한국어 특성/기술명은 추가하지 않음.
- 외부 자체 문서는 `https://pokeapi.co/api/v2/pokemon-species/{id}/`의 종별 API 응답을 텍스트로 변환함. 원본 해시·시각·URL·권리·원래 게임 버전이 있는 [`data/documents/species.json`](../../data/documents/species.json)에 항목별 연결 100건을 저장함. 위키백과 문서를 수집한 것으로 표시하지 않음.
- API의 공개 리소스 목록(`pokemon-species`, `ability`, `type`)을 후보 이름/URL 검색에 사용함. 본문은 LLM 선별 후에만 받음. 종 자체 문서는 선별에 관계없이 수집함. 최초 데이터 준비는 모델을 사용하지 않는 자체 문서 일괄 확보이며, 실시간 질문 경로에서는 세 프롬프트를 모두 거침.
- PokéAPI fair-use의 로컬 캐시·교육용 사용 취지에 따라 직렬 수집함. [프로젝트 라이선스 원문](../../data/licenses/POKEAPI_LICENSE.md)을 보존하고 설명·이름 등의 원 권리를 별도로 명시함. 승인된 수집 범위는 이 출처의 교육용 로컬 데이터 이용이며 공식 이미지·게임 원문 전체 재배포의 포괄 허가를 뜻하지 않음.
- 최초 107회 외부 호출(7 CSV+100종 문서), 동일 데이터 준비 재실행은 외부 호출 0회·캐시 적중 207회였음. 실제 모델 질의의 관련 특성 문서는 같은 API 출처에서 추가 수집할 수 있음.
- GMS 공식 [Quickstart](https://gms.ssafy.io/api/v1/guides/Quickstart)와 [gpt-4.1-mini 안내](https://gms.ssafy.io/api/v1/guides/gpt-4.1-mini)에서 OpenAI 호환 base URL·Bearer 인증을 확인함. 제공된 키는 로컬 `.env`에만 저장하고, 본 문서·소스·증거 파일에는 넣지 않음.
- 모델의 구조화 출력은 [OpenAI 공식 문서](https://developers.openai.com/api/docs/guides/structured-outputs)를 참고하고 LangChain `with_structured_output`으로 검증함. [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api), [Chroma 임베딩](https://docs.trychroma.com/docs/embeddings/embedding-functions)을 확인해 구현함.
- 모든 포켓몬의 Champions 적격성은 `unknown`이며, 육성·데미지·행동 계산이나 현재 규칙 명단을 생성하지 않음. 기초 자료에서 확인한 사실은 `generic` 범위의 provenance로 제한함.

## 8. 전체 도감·이미지 보완 (2026-10-21)

- 앞의 100종은 초기 실행 기록임.
- 현재 기본 1,025종과 독립 능력치 폼 326개, 총 1,351개 항목을 수록함.
- 현재 PokéAPI 전체 pokemon 목록의 ID와 대조해 누락·추가 ID가 없음을 확인함.
- 일괄 수집에 pokemon_forms, pokemon_form_names, pokemon_species_flavor_text, versions CSV를 추가함.
- 첫 확장 실행은 기존 7개 CSV 캐시를 사용해 4회 외부 호출, 재실행은 외부 호출 0회·캐시 적중 11회였음.

종 설명은 CSV의 한국어·영어 원문과 원래 버전을 보존하고 해당 CSV URL·내용 해시·수집 시각을 기록함. 별도 폼은 종 설명을 공유하지만 타입·능력치·특성은 각 pokemon 행에서 가져옴. 독립 능력치가 없는 외형 차이만의 폼은 별도 채팅 항목으로 만들지 않음.

- 이미지 출처는 [PokéAPI sprites](https://github.com/PokeAPI/sprites)와 해당 저장소의 [권리 표기](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt)임.
- 원본 주소 규칙으로 리소스별 일러스트·스프라이트를 연결하고 출처·권리·확인 시각을 기록함.
- 권리 파일은 이미지 저작권이 Pokémon Company에 있다고 명시함.
- 저장소의 CC0 표기를 캐릭터 이미지의 포괄적 권리 양도로 해석하지 않음.
- 이미지 파일은 Git에 포함하지 않음.
- URL의 실제 존재 여부는 이미지 로딩으로 확인하며 일러스트→스프라이트→대체 아이콘으로 실패를 처리함.
- 데이터의 이미지 검증 상태도 unknown으로 두며 표시된 이미지로 Champions 적격성을 판단하지 않음.

자료 구성은 [데이터 준비 스크립트](../../backend/scripts/prepare_data.py), 현재 입력은 [도감 메타데이터](../../data/pokemon.json)·[종별 문서](../../data/documents/species.json) 참조

## 9. Phase 3 일반 타입표·규칙 확인 (2026-10-21)

- 타입 자료: PokéAPI 공식 CSV `types.csv`, `type_efficacy.csv`. 18개 일반 타입·324개 공격/방어 관계를 [type_chart.json](../../data/type_chart.json)에 저장함.
- `backend/scripts/prepare_battle_data.py`로 수집·캐시·재실행 가능. 원문 URL·실제 수집 시각·내용 해시·라이선스 URL을 데이터에 기록함.
- 기존 PokéAPI 라이선스와 원 권리 표기 유지. 현재 Champions 타입 효과의 게임 내 대조 검증은 미실시이므로 `scope=generic`, `champions_verification_status=unknown` 유지.
- [Champions 공식 gameplay](https://champions.pokemon.com/en-us/gameplay/)와 [일본 공식 배틀 안내](https://www.pokemonchampions.jp/ja/battle/)에서 싱글/더블 구분·레귤레이션별 참가 조건 변경·메가 관련 일반 안내 확인. 두 페이지는 현행 적격 명단이나 상세 전투 공식의 근거로 사용하지 않음.
- [Apple App Store의 Champions 소개](https://apps.apple.com/gb/iphone/story/id1887456452)에서 팀 6마리 중 싱글 3마리 선택의 일반 형식 확인. 배포 플랫폼 편집 안내이며 현행 레귤레이션 원문을 대체하지 않음.
- 공식 안내·플랫폼 소개는 링크와 확인 범위만 기록하고 본문·이미지 재배포 또는 RAG 색인 미실시. 확인일 2026-10-21.
- M-C를 현재 규칙으로 자동 지정하지 않음. 선출은 6→3 준비 시나리오 20개 비교이며 합법 후보 판정 아님. 메가 비교도 도감의 전후 타입만 사용하고 실행 조건 확정 표시 제외.

## PostgreSQL 전환 관련 출처 (2026-10-22)

- 상태 저장과 RAG 벡터 검색을 PostgreSQL + pgvector로 통합함. 포켓몬 원본 출처·수집일·이용 조건 유지함.
- 기존 로컬 ONNX 모델을 독립 임베딩 모듈에서 재사용함. 모델·ONNX export 라이선스는 [전환 기록](OPERATIONS.md#postgresql--pgvector-저장검색-통합) 참조.

## 복수 외부 출처 추가 (2026-10-22)

- [Wikipedia 요약 API](https://www.mediawiki.org/wiki/Page_Content_Service): 등록한 피카츄·리자몽 문서의 평문 요약만 선택 수집, 사진·HTML·문서 전체 수집 제외
- 항목 연결: 종 ID 25 → Pikachu/Q9351, 종 ID 6 → Charizard/Q844940, 응답의 제목·Wikidata ID·언어·표준 문서 유형 검증
- 설정: `WIKIPEDIA_ENABLED=true`로 후보 수집 활성화, 기본 false, 서버 재시작 후 질문 관련성 선별을 통과한 후보만 본문 수집
- [이용 조건](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content): Wikipedia 기여자·원문 영구 링크·[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)·추가한 범위/출처 헤더 표시, 평문 요약 본문 유지
- [API 접근 정책](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy): 저장소 URL을 포함한 User-Agent·직렬 요청·대기·재시도·로컬 캐시 적용, `SOURCE_CONTACT`로 실제 관리 연락처 지정 가능
- 일반 종 배경만 지원, 폼별 전투 수치·Champions 규칙·참가 가능 여부의 확인 근거로 사용 금지
- 수집일·revision·원문 해시는 수집한 Document에 보존, [문서 모델](../../backend/app/schemas.py)·[Wikipedia 수집기](../../backend/app/data_preparation/wikipedia.py) 참조

## 참조 데미지 계산 의존성

- [Smogon damage-calc](https://github.com/smogon/damage-calc)·`@smogon/calc 0.12.0`의 Champions 전용 모드 사용, 확인일 2026-10-22
- npm 배포 체크섬은 `backend/calculator/pnpm-lock.yaml`에 고정, 별도 공개 게임 데이터 수집 없이 설치 패키지의 참조 자료 사용
- 원문 MIT 저작권·허가문은 [라이선스](../../backend/calculator/LICENSE.smogon-calc)에 보존
- 지원 기술 목록 확인일 2026-10-25: 고정 설치 패키지의 Champions 모드에서 96개 단일 타격 기술의 존재·양의 기본 위력·16개 정수 피해 출력 확인, 기술별 실전 효과 인증 아님
- 습득 가능 기술·한국어 명칭·습득 방법은 기존 PokéAPI `catalog_details.json`과 보존된 원본 출처·수집일·라이선스 사용, 신규 외부 기술 데이터 수집 없음
- 코드 라이선스와 포켓몬 원문·캐릭터·이미지 권리 구분, 라이브러리 지원을 공식 게임 결과 검증으로 표시 금지

## 조건부 전략 RAG 초기 자료

- 확인일: 2026-10-22
- 원본: `data/strategy/notes.json`, PokeSettle이 직접 작성한 조건부 분석, CC BY 4.0
- 범위: 기본 망나뇽·이상해꽃·리자몽 3종, 일반 메커니즘 기반 육성 방향·대면 판단·추가 입력 질문
- 기초 근거: PokéAPI의 종·특성·기술 리소스, 문서 안에 개별 URL 기록
- 분석의 `verification_status=assumed`·`game=generic` 유지, Champions 합법성·정확한 추천 세트·실전 성과 보장 없음
- Smogon·상업 공략·커뮤니티 전략 원문 복제 없음, 외부 분석을 수집한 것으로 표시하지 않음
- 명령: `python -m backend.scripts.index_strategy`, 기초 메커니즘의 원문·라이선스·수집 시각과 직접 작성한 분석을 분리 색인
- 질문에 명시된 포켓몬의 자료도 함께 검색하되 기존 대화 항목·선택 메타 유지, 다른 폼의 전략 자동 적용 없음

## Champions 싱글 메타 API 연동 — 2026-10-25

- 출처: [Pokémon Champions Battle Data](https://championsbattledata.com/), 비공식 제공자
- 확인·실제 조회일: 2026-10-25, 조회 당시 최신 싱글 스냅샷 `M7/24_10_2026`, `generatedAt=2026-10-24T06:57:52.304Z` 확인
- 입력: `/data/meta/index.json`에서 최신 싱글 날짜 선택 후 `/data/meta/{season}/{date}/Singles.json` 조회
- 이용 조건: [API Usage Rules](https://championsbattledata.com/api-rules/), 개인·커뮤니티·비영리·상업 프로젝트 및 합리적 캐시 허용, 공개 사용 시 출처 표시 필수
- 제한: 별도 데이터 서비스·공개 경쟁 API·대량 다운로드·영구 미러 재배포 제한, 포켓몬 IP 권리는 별도임
- 처리: 앱 화면용 순위 상위 30개와 항목별 채용률 상위 5개 정규화, 서버 메모리 6시간 캐시, 갱신 실패 시 조회 후 최대 24시간의 임시 데이터만 제공, 영구 저장·RAG 색인 없음
- 표기: `Battle data provided by Pokémon Champions Battle Data` 및 출처·이용 조건 링크, 데이터 기준일·서버 조회 시각·시즌·캐시 갱신 실패 여부 표시
- 범위: 제공자 통계의 사용 순위와 기술·도구·특성·성격 채용률만 표시, 포켓몬 전체 사용률·승률·완성 세트·현행 레귤레이션 적격성으로 확장 해석하지 않음
- 이름: 기존 도감과 정규화된 영문 이름이 일치할 때만 한국어·도감 링크 연결, 폼을 기본 종으로 추정하지 않음, 미수집 항목은 원문 유지
- 도구·성격 한국어 이름: PokéAPI의 [items.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/items.csv)·[item_names.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/item_names.csv) 및 [natures.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/natures.csv)·[nature_names.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/nature_names.csv)의 동일 ID와 한국어 언어 ID `3` 연결
- 2026-10-25 수집: 도구 2,173개·성격 25개 이름을 `data/battle_names.json`에 저장, 각 원본 URL·수집 시각·해시·[라이선스](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/LICENSE.md) 기록, 이름 매핑을 Champions 적격성이나 작동 검증으로 해석하지 않음
- 이름 갱신: `python -m backend.scripts.prepare_battle_names`, 기존 도감·습득 기술 데이터와 별도 갱신
- 메타 이미지: 기존 도감의 PokéAPI sprites URL·권리 문구 재사용, 정확히 연결된 폼의 이미지로만 표시, 새 이미지 수집·생성·폼 추정 없음

## 홈 트레이너 이미지 — 2026-10-27

- 생성: OpenAI 내장 ImageGen 사용, 2026-10-27 생성, AI 생성 일러스트 2종
- 남자 트레이너: `frontend/public/images/trainers/original-male-partner-v2.png`, 트레이너 캡·차분한 짧은 머리·빨간 자켓·흰 티셔츠·검은 긴바지·흰색 및 붉은색 운동화·몬스터볼·수댕이 조합, 여자와 동일한 단순 선화·평면 채색 방향으로 수정
- 여자 트레이너: `frontend/public/images/trainers/original-female-partner-v1.png`, 포니테일·흰 자켓·검은 티셔츠·파란 스커트·맨다리·몬스터볼·냐오하 조합
- 참고: 소드·실드 주인공의 모험 분위기·단순한 선화와 채색만 참고, 기존 주인공의 얼굴·의상을 직접 사용하지 않도록 생성 지시
- 참고 파일: [승재](https://archives.bulbagarden.net/wiki/File:Sword_Shield_Victor.png)·[우리](https://archives.bulbagarden.net/wiki/File:Sword_Shield_Gloria.png), 기존 원본 PNG는 홈 표시 및 public 자산에서 제거
- 보관: 최종 생성 PNG의 알파 유지, CSS·Next Image로 표시 크기 조정, 생성·수정 프롬프트는 로컬 학습 가이드에 기록
- 권리: 트레이너는 AI 생성 디자인, 수댕이·냐오하·몬스터볼 등 Pokémon 요소의 권리는 각 원권리자에게 귀속, 생성 사실을 제3자 IP 이용 허가나 독점 권리 보장으로 해석하지 않음
- 홈 고지: 비공식·비영리 및 Pokémon 권리 표기 유지, 더 이상 직접 표시하지 않는 기존 트레이너 원본의 화면 출처 링크 제거

## 로컬 이미지 자산

- `frontend/src/assets/master-ball.png`: [PokeAPI sprites — Master Ball](https://github.com/PokeAPI/sprites/blob/master/sprites/items/master-ball.png), 수집일 2026-10-25, 수정 없는 원본 PNG
- 현재 앱 코드의 사용 여부 미확인임. Pokémon 이미지 권리는 원권리자에게 귀속, 이미지 자체의 별도 재배포 라이선스 미확인임

## 프런트엔드 폰트

- Pretendard Variable 1.3.9, 수집·확인일 2026-10-26, [공식 저장소](https://github.com/orioncactus/pretendard/tree/v1.3.9)
- [공식 동적 서브셋 CSS](https://github.com/orioncactus/pretendard/blob/v1.3.9/packages/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css)의 Unicode 범위와 WOFF2 92개 사용
- 라이선스: SIL Open Font License 1.1, 원문 `frontend/public/fonts/pretendard/LICENSE.txt` 유지
- 사용: `frontend/src/app/fonts.ts`의 `next/font/local` 공통 글리프, `pretendard-subsets.css`의 나머지 범위, 바이너리 수정 없음
- 공식 API 근거: [Next Font](https://nextjs.org/docs/app/api-reference/components/font), [Next Image](https://nextjs.org/docs/app/api-reference/components/image), [Google Analytics](https://nextjs.org/docs/app/guides/third-party-libraries#google-analytics)


### 다국어 포켓몬 이름 스냅샷

- 수집일: 2026-10-29 UTC, `data/pokemon_names.json`의 원본별 `collected_at`·SHA-256 해시·이용 조건 보존
- 원본: [languages.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/languages.csv), [pokemon_species_names.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv), [pokemon_forms.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_forms.csv), [pokemon_form_names.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_form_names.csv)
- 범위: 기존 1,351개 Pokémon 리소스에 확인된 ko·en·ja·zh-hans 종·폼명 연결, 별도 폼은 종 번호 대신 Pokémon 리소스 ID로 식별
- 누락 처리: 자동 번역·새 폼명 생성 제외, 영어 리소스명 fallback과 원문 언어 안내, 종족값·기술·Champions 적격성 변경 없음
- 권리 범위: 기존 PokéAPI 이용 조건과 원권리자 권리 안내 유지, 이름 자료 추가를 이미지·게임 설명 재배포 허가로 해석하지 않음
- 갱신: 기존 `backend.scripts.prepare_data` 파이프라인에서 동일 CSV 원본·수집 이력과 이름 스냅샷 동시 생성

### 화면 표시용 다국어 기술·특성·설명

- `data/catalog_details.json`의 `localization`에 한국어·영어·일본어·중국어 간체 이름과 언어별 도감 설명 보존함
- 출처: 기존 [PokéAPI CSV](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)의 `languages`, `abilities`, `ability_names`, `moves`, `move_names`, `items`, `item_names`, `natures`, `nature_names`, `pokemon_species_flavor_text`, `versions`
- 이름은 원본 리소스 ID와 언어 ID로 연결함. 누락 번역은 생성하지 않으며, 표시 시 영어 원문으로 대체함
- 설명은 언어별 가장 최근 원본 버전과 문장을 함께 보존함. 언어마다 기준 게임이 다를 수 있으며, 해당 언어 자료가 없으면 수집된 영어·한국어 원문과 안내 표시함
- 설명 범위: 종 1,025개 중 한국어 898개·영어 1,025개·일본어 898개·중국어 간체 722개, 폼별 독립 설명으로 해석하지 않음
- 수집 이력: 2026-10-29 갱신, 기존 캐시의 2026-10-21·22 수집본 포함. 테이블별 원본 URL·수집일·해시·라이선스는 `localization.sources`·`licence_url`에 보존함
- 갱신: `python -m backend.scripts.prepare_catalog_details --localization-only`, 기존 수치·습득 기술·한국어 호환 필드 유지함
- 권리 범위: 기존 PokéAPI 라이선스와 원권리자 권리 안내 유지, 번역 데이터 추가를 Champions 적격성·효과 검증이나 이미지 이용 허가로 해석하지 않음

### 포BTI 결과 이미지 (2026-10-29)

- 출처: 기존 도감과 같은 [PokéAPI sprites](https://github.com/PokeAPI/sprites), [권리 표기](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt) 재사용함
- 연결: 기존 도감 라우트 데이터의 기본 포켓몬 ID로 16개 결과 이미지를 연결함
- 표시: 공식 일러스트 URL 우선, 실패 시 기본 스프라이트와 대체 아이콘 순으로 표시함
- 권리: Pokémon © The Pokémon Company 표기, 원본 이미지 파일 Git 추가 없음

### PokeSettle 공통 로고 (2026-10-30)

- 출처: 사용자가 제공한 `포케세틀logo.png`, 수령일 2026-10-30
- 편집: 내장 imagegen으로 볼 바깥의 흰 배경과 그림자를 투명 처리함
- 자산: `frontend/public/logo.png`, 파생 아이콘 `frontend/src/app/icon.png`, `favicon.ico`, `apple-icon.png`
- 적용: 공통 헤더·브라우저 아이콘·공유 메타데이터, 주색 `#0057ff`·보조색 `#36c5f0`·네이비 `#07164d`
- 이용 범위: 사용자 요청에 따른 프로젝트 브랜딩 적용, 별도 외부 재배포 라이선스 미확인임
