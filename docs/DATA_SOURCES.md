# 데이터 출처 및 Champions 검증 기록

확인일: 2026-10-21 (Asia/Seoul). 이 날짜는 웹 문서 **확인일**이다. 실제 데이터셋 수집일이나 100건 확보일이 아니다. 현재 수집·색인 데이터는 0건이다.

> 위 문장은 Phase 0 조사 당시 기록이다. **Phase 1에서는 실제 100종과 자체 설명 문서 100개를 확보했다.** 현재 수집 내역은 아래 7절 및 [실행 결과](TEST_RESULTS.md)를 따른다. 공식 Champions 규칙의 미확인 사항은 해소된 것으로 간주하지 않는다.

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

위키백과의 원문은 커뮤니티 설명 자료이며 Champions의 규칙을 확정하는 1차 자료가 아니다. 게임 적용 범위를 `generic` 또는 해당 게임/포맷으로 저장한다. 사용 조건이 확인되지 않은 전략 사이트·검색 요약·공식 이미지를 수집 데이터로 임의 채택하지 않는다. 과제 PDF는 요구사항 분석 자료이며 Pokémon 지식 컬렉션에 넣지 않는다.

## 2. 규칙별 확인 상태

공식 M-C 공지(S02)에 따라 적용 기간은 **2026-09-09 02:00 UTC~2026-12-02 01:59 UTC**이며, 한국 시각은 **2026-09-09 11:00~2026-12-02 10:59**다. 확인일을 포함하므로 현재 설계의 후보 규칙으로 사용한다. 공지 수정 가능성을 고려해 실제 사용 전에 재확인한다.

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

`verified`는 특정 근거·필드·시점에만 적용한다. 공지에서 메가진화를 확인했다고 모든 폼의 능력치와 기술까지 검증된 것은 아니다.

## 3. 데이터 확보 계획

1. Phase 1에서 PokéAPI 리소스와 종·폼 매핑을 확인하고, 이름·타입·기초 능력치·특성·출처를 갖춘 **고유 기본 항목 100건 이상**의 로드 결과를 기록한다. 원본은 수정하지 않고 정규화본과 분리한다.
2. 공식 적격 목록을 대조할 수 있으면 교집합을 우선한다. 일반 도감 100건과 '현재 적격이 검증된 100종'은 별개 지표다. 교집합이 부족하거나 미확인이라면 일반 참고 데이터임을 표시하고 적격 질문에는 유보한다.
3. 항목별 단독 문서의 제목·정규 URL·문서 ID·버전·이용 조건을 확보한다. 여러 종을 다룬 목록 문서는 단독 문서와 동일하다고 자동 판정하지 않는다. 종별 문서 부족은 요구사항 위험으로 보고한다.
4. 수집 권한이 확인된 문서에 한해 외부 검색→LLM 선별→본문 수집을 수행한다. 종 자체 문서는 선별·길이 규칙보다 우선한다. 권리/접근 문제로 수집 불가능하면 실패 상태를 남기고 허용된 제공 문서 묶음 등 PDF 13쪽 대체 경로를 검토한다. 허구 본문으로 채우지 않는다.
5. 언어별 이름은 공급자 ID와 공식/확인된 매핑을 사용하고, 한국어 이름이 없으면 `null`과 영문 이름을 표시한다. 유사한 이름을 번역해 정식 명칭으로 저장하지 않는다.
6. 전략 문서에 `game`, `battle_format`, `regulation_id`, 적용 기간을 붙인다. 과거 본가·Showdown 6v6·VGC 더블의 설명은 출처 포맷으로 표시하고 Champions 싱글의 확정 조언에서 제외한다.

## 4. 출처·권리 레코드 계약

실제 수집 시 다음 필드를 문서와 데이터 필드의 provenance에 연결한다. 필드명은 내부 snake_case다.

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

공식 규칙 갱신 시 기존 버전을 삭제해 덮어쓰지 않고 새 스냅샷으로 보존한다. 기간이 지난 버전을 현재 규칙으로 자동 사용하지 않는다. 오래된 대화는 당시 인용 스냅샷과 규칙을 유지한다.

## 5. 호출과 캐시 정책 제안

- 출처별 직렬 호출, 초기 간격 1초, HTTP timeout 15초, 일시 오류 재시도 최대 2회. 이는 프로젝트 초기 설정이며 공급자의 고정 제한이라고 주장하지 않는다.
- 429/일시적 5xx는 Retry-After를 우선하고 지수 백오프를 적용한다. 영구 오류/금지 응답은 무작정 재시도하지 않는다.
- 연락 가능한 실제 정보가 포함된 User-Agent를 서버 설정으로 제공한다. 가짜 이메일이나 브라우저 위장 문자열을 쓰지 않는다.
- 정규화 검색어·출처·언어·스코프를 키로 성공 결과를 저장한다. 성공 캐시에 자동 TTL 재수집은 두지 않고 명시적 갱신만 허용한다. 같은 질문은 저장된 검색어와 원문을 재사용한다.
- 본문 캐시는 정규 URL+원문 버전/해시로 별도 관리한다. 검색어가 달라도 같은 원문을 다시 내려받지 않는다. 중간 실패는 완료 캐시로 기록하지 않는다.
- 규칙 재확인은 명시적 갱신 작업으로 처리한다. 캐시 재사용과 규칙 최신성은 별도 상태로 표시한다.

## 6. 남은 확인과 중단 조건

Phase 1 첫 조사에서 100개 항목·자체 문서·허용된 수집 경로를 증명한다. 실제 다운로드·재배포 조건, 개별 문서 라이선스, 공식 적격 명단, 패키지 버전 사용 가능성은 아직 확인되지 않았다. 이 상태에서 데이터 확보 완료나 Champions 배틀 계산 지원을 표시하지 않는다. 일반 지식 RAG와 규칙 미확인 상태의 동작은 병행 설계할 수 있지만, 미확인 규칙에 의존하는 계산과 적격 판정은 구현 게이트로 남긴다.

## 7. Phase 1 실제 수집·연동 기록

- 수집일: 2026-10-21. 기초 자료는 PokéAPI 공식 저장소의 `data/v2/csv/` 내 pokemon, pokemon_stats, pokemon_types, types, pokemon_abilities, abilities, pokemon_species_names 7개 CSV다. URL·정규화 전 원문 해시·실제 UTC 수집 시각은 [`data/sources.json`](../data/sources.json)에 있다.
- 기본 종 ID 1~100의 기본 폼만 선별해 [`data/pokemon.json`](../data/pokemon.json)에 100건을 저장했다. 한국어 이름은 공급자의 한국어 언어 ID 3 매핑을 사용했다. 원문에 없는 한국어 특성/기술명은 추가하지 않는다.
- 외부 자체 문서는 `https://pokeapi.co/api/v2/pokemon-species/{id}/`의 종별 API 응답을 텍스트로 변환했다. 원본 해시·시각·URL·권리·원래 게임 버전이 있는 [`data/documents/species.json`](../data/documents/species.json)에 항목별 연결 100건을 저장했다. 위키백과 문서를 수집한 것으로 표시하지 않는다.
- API의 공개 리소스 목록(`pokemon-species`, `ability`, `type`)을 후보 이름/URL 검색에 사용한다. 본문은 LLM 선별 후에만 받는다. 종 자체 문서는 선별에 관계없이 수집한다. 최초 데이터 준비는 모델을 사용하지 않는 자체 문서 일괄 확보이며, 실시간 질문 경로에서는 세 프롬프트를 모두 거친다.
- PokéAPI fair-use의 로컬 캐시·교육용 사용 취지에 따라 직렬 수집했다. [프로젝트 라이선스 원문](../data/licenses/POKEAPI_LICENSE.md)을 보존하고 설명·이름 등의 원 권리를 별도로 명시한다. 승인된 수집 범위는 이 출처의 교육용 로컬 데이터 이용이며 공식 이미지·게임 원문 전체 재배포의 포괄 허가를 뜻하지 않는다.
- 최초 107회 외부 호출(7 CSV+100종 문서), 동일 데이터 준비 재실행은 외부 호출 0회·캐시 적중 207회였다. 실제 모델 질의의 관련 특성 문서는 같은 API 출처에서 추가 수집할 수 있다.
- GMS 공식 [Quickstart](https://gms.ssafy.io/api/v1/guides/Quickstart)와 [gpt-4.1-mini 안내](https://gms.ssafy.io/api/v1/guides/gpt-4.1-mini)에서 OpenAI 호환 base URL·Bearer 인증을 확인했다. 제공된 키는 로컬 `.env`에만 저장하고, 본 문서·소스·증거 파일에는 넣지 않았다.
- 모델의 구조화 출력은 [OpenAI 공식 문서](https://developers.openai.com/api/docs/guides/structured-outputs)를 참고하고 LangChain `with_structured_output`으로 검증했다. [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api), [Chroma 임베딩](https://docs.trychroma.com/docs/embeddings/embedding-functions)을 확인해 구현했다.
- 모든 포켓몬의 Champions 적격성은 `unknown`이며, 육성·데미지·행동 계산이나 현재 규칙 명단을 생성하지 않았다. 기초 자료에서 확인한 사실은 `generic` 범위의 provenance로 제한한다.
