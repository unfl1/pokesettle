# 데이터 출처와 이용 조건

정리일: 2026-11-11 KST · 아래 수집·확인 날짜는 해당 작업 당시 기록이며 이번 정리의 신규 외부 검증 결과 아님

## 적용 원칙과 기록 위치

- 수집 자료는 일반 도감·전략·외부 메타·브랜딩으로 구분함. 공개 접근 가능 여부와 재배포 권리는 별개임
- 출처 URL·수집일·원문 해시·원문 버전·라이선스·게임 적용 범위는 스냅샷과 수집 문서에 보존함
- 도감 기반 정보와 Champions 참가 적격성·기술 허용 여부·실제 전투 효과 검증을 구분함. 과거 규칙 공지를 현행으로 자동 사용하지 않음
- 번역 누락·미확인 값은 원문 또는 미확인으로 표시함. 이름·수치·승률·라이선스 추정 생성 제외함
- 출처 기록의 기준은 `data/sources.json`, `data/type_chart.json`, `data/pokemon_names.json`, `data/catalog_details.json`의 sources·licence 필드와 수집한 Document임
- 종별 원문은 `data/documents/species.json`, 자체 전략은 `data/strategy/notes.json`, 수집된 추가 문서·원문 캐시는 PostgreSQL에 보관함
- PokéAPI 조건 원문은 [POKEAPI_LICENSE.md](../../data/licenses/POKEAPI_LICENSE.md)에 보존함. 원문 라이선스·저작권 문구는 문체 정리 대상에서 제외함
- 출처별 실제 요청·캐시 구현은 [`http_client.py`](../../backend/app/http_client.py)·[`data_preparation`](../../backend/app/data_preparation/), 수집·색인 명령은 [운영 지침](OPERATIONS.md) 참조
- 초기 조사 후보·과제 수량·이전 모델·실행 횟수 등 학습 이력은 Git 제외 `docs/private/LEARNING_GUIDE.md`로 통합함

## 도감·이미지 수집 기록 (2026-10-21)

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

## 일반 타입표·규칙 확인 기록 (2026-10-21)

- 타입 자료: PokéAPI 공식 CSV `types.csv`, `type_efficacy.csv`. 18개 일반 타입·324개 공격/방어 관계를 [type_chart.json](../../data/type_chart.json)에 저장함.
- `backend/scripts/prepare_battle_data.py`로 수집·캐시·재실행 가능. 원문 URL·실제 수집 시각·내용 해시·라이선스 URL을 데이터에 기록함.
- 기존 PokéAPI 라이선스와 원 권리 표기 유지. 현재 Champions 타입 효과의 게임 내 대조 검증은 미실시이므로 `scope=generic`, `champions_verification_status=unknown` 유지.
- [Champions 공식 gameplay](https://champions.pokemon.com/en-us/gameplay/)와 [일본 공식 배틀 안내](https://www.pokemonchampions.jp/ja/battle/)에서 싱글/더블 구분·레귤레이션별 참가 조건 변경·메가 관련 일반 안내 확인. 두 페이지는 현행 적격 명단이나 상세 전투 공식의 근거로 사용하지 않음.
- [Apple App Store의 Champions 소개](https://apps.apple.com/gb/iphone/story/id1887456452)에서 팀 6마리 중 싱글 3마리 선택의 일반 형식 확인. 배포 플랫폼 편집 안내이며 현행 레귤레이션 원문을 대체하지 않음.
- 공식 안내·플랫폼 소개는 링크와 확인 범위만 기록하고 본문·이미지 재배포 또는 RAG 색인 미실시. 확인일 2026-10-21.
- M-C를 현재 규칙으로 자동 지정하지 않음. 선출은 6→3 준비 시나리오 20개 비교이며 합법 후보 판정 아님. 메가 비교도 도감의 전후 타입만 사용하고 실행 조건 확정 표시 제외.

## 임베딩·저장 의존성 출처

확인일: 2026-10-22 (Asia/Seoul)

- [Psycopg 공식 문서](https://www.psycopg.org/psycopg3/docs/): 연결·행 사전·트랜잭션·SQL 매개변수 참고함. 배포 패키지 라이선스 원문 유지함.
- [pgvector 공식 문서](https://github.com/pgvector/pgvector): PostgreSQL License. 벡터 타입·L2 거리·정확 검색·Docker 구성 참고함.
- [all-MiniLM-L6-v2 모델 카드](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): Apache-2.0 모델, 영어 중심·384차원임.
- [ONNX export 프로젝트](https://github.com/chroma-core/onnx-embedding): Apache-2.0 프로젝트. 기존 로컬 모델 캐시 재사용함. 배포 URL의 Chroma 명칭은 모델 호스팅 주소이며 ChromaDB 런타임 의존성과 구분함.

- 모델 신규 다운로드는 SHA-256 `913d7300ceae3b2dbc2c50d1de4baacab4be7b9380491c27fab7418616a16ec3` 검증 후 정규 파일 두 개만 추출함.

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
- 처리: 앱 화면용 순위 상위 30개와 항목별 채용률 상위 5개 정규화, 서버 메모리 6시간 캐시, 6~24시간의 기존 데이터는 즉시 반환하면서 단일 백그라운드 갱신 실행, 갱신 실패 시 60초 재시도 제한, 24시간 만료 시 외부 조회 후 성공한 데이터만 제공, 영구 저장·RAG 색인 없음
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
- 라이선스: SIL Open Font License 1.1, 원문 `frontend/public/fonts/pretendard/1.3.9/LICENSE.txt` 유지
- 사용: `frontend/src/app/fonts.ts`의 `next/font/local` 공통 글리프, `frontend/tailwind-fonts.mjs`·`frontend/src/styles/pretendard-subsets.json`의 나머지 범위, 바이너리 수정 없음
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

### 기술 PP·효과 표시 자료 (2026-11-05)

- 출처: [PokéAPI CSV](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)의 `moves`, `stats`, `move_targets`, `move_meta`, `move_meta_categories`, `move_meta_ailments`, `move_meta_stat_changes`, `move_flavor_text`, `move_effect_prose`, `version_groups`, `languages`
- 수집: 2026-11-05 갱신, 테이블별 URL·수집일·content hash를 `catalog_details.sources`, 기존 라이선스를 `licence_url`에 보존함. 같은 URL의 다른 원본 해시도 보존함
- 범위: 기술 937개 중 기본 PP 919개·구조화 능력치 변화 142개·효과 설명 830개 보유함. 누락 값은 생성하지 않으며, 일반 피해만 있는 `effect_id=1` 기술은 부가 효과 없음으로 처리함
- 효과 설명은 언어별 최신 원본 버전 그룹과 원문 보존, 영어 short effect는 현지어·영어 flavor text가 없는 경우의 원문 대체 자료로 사용함. 언어마다 기준 버전이 다를 수 있음
- 능력치 변화 대상은 공격 대상과 구분함. `damage-raise`는 자신, `damage-lower`는 대상의 변화로 처리하고, 다른 유형의 수신자를 명확히 판단할 수 없으면 수치 요약 대신 수집된 설명만 표시함
- 핵심 요약은 `move_meta`의 확률·회복·반동·연속 횟수와 `moves.priority`를 사용함. 방어·벽·설치물·교체 등의 고유 태그는 수집한 effect ID별 영어 short_effect 확인 후 제한적으로 매핑함. 기술 설명문에서 임의로 수치나 확률을 생성하지 않음
- 자료는 원본 게임의 일반 참고 정보이며 현재 Champions 전용 효과·PP 검증으로 해석하지 않음. 기존 습득 목록·타입·위력·명중·번역 이름은 유지함
- 갱신: `python -m backend.scripts.prepare_catalog_details --move-effects-only`, 모델·임베딩 호출 없이 PP·효과만 보강함

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

### 관동 수집 도감 (2026-10-31)

- 범위: 기존 이름 스냅샷의 기본 Pokémon 리소스 ID 1–151만 사용함. 별도 폼·Champions 출전 적격성과 무관한 방문 수집 기능임
- 이름: 2026-10-29 수집한 다국어 이름과 `frontend/src/generated/pokemon-routes.json` 재사용함
- 이미지: 기존 [PokéAPI sprites](https://github.com/PokeAPI/sprites) 공식 일러스트·기본 스프라이트 URL 재사용, 연결 기준은 `data/pokemon.json`의 2026-10-21 메타데이터임. 새 원본 이미지 수집·Git 추가 없음
- 권리: 기존 [권리 표기](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt)와 홈·공통 하단의 Pokémon 권리 안내 유지함. 이미지 이용 범위에 대한 추가 허가로 해석하지 않음
- 몬스터볼 표시·포획 흔들림·도감 이동: SVG·CSS로 구현한 장식과 애니메이션, 게임 원본 그래픽·음원 사용 없음


### 관동 수집 도감 버튼 이미지 (2026-10-31)

- 자산: `frontend/public/images/collection/kanto-pokedex-emblem.png`, 1,254×1,254px RGBA, 알파 범위 0–255
- 참고 이미지: 사용자가 지정한 [1세대 도감 그림](https://static.wikia.nocookie.net/pokemon/images/3/34/1%EC%84%B8%EB%8C%80_%EB%8F%84%EA%B0%90.png/revision/latest?cb=20141004064302&path-prefix=ko)의 왼쪽 닫힌 도감, 확인일 2026-10-31 KST
- 편집: 브라우저에서 확인한 참고 이미지로 내장 imagegen의 왼쪽 도감 분리·배경 투명 처리 후, 사용자 요청에 따라 빈 표지 중앙에 밝은 몬스터볼 문양을 추가함. 원본 PNG의 무손실 픽셀 크롭과 구분되는 AI 편집본임
- SHA-256: `6b71716e653c30077bf94e1b4c8c2b13f8c20073f584c71f3a4310b5eab3bc99`
- 표시: Next Image의 32px 영역에 비율 유지하여 표시함. 픽셀 확대 보간 스타일 제거함
- 권리: Pokémon 관련 그림의 권리는 원권리자에게 귀속, 사용자 링크 제공·AI 편집을 별도 이미지 이용 허가로 해석하지 않음. 원본의 자유 이용 라이선스 미확인임
- 적용: 언어 선택 왼쪽 수집 도감 버튼, 수집 수·접근성 이름·포켓몬 도착 위치 유지함
- 교체: 앞서 사용한 RG 원화·FireRed/LeafGreen 도트 스프라이트는 현재 앱 표시와 public 자산에서 제외함


### 정적 이미지 WebP 변환·헤더 SVG (2026-11-10)

- 원본: 위 홈 트레이너·관동 도감 버튼·사용자 제공 공통 로고의 기존 출처와 권리 조건 유지함. 신규 외부 그림 수집 없음
- WebP: `sharp 0.35.5`, 품질 85·알파 품질 100·effort 6 적용함. 트레이너 2개·도감 버튼의 원본 해상도와 투명도 유지, 동일 이름의 `.webp`로 교체함
- 크기: 남자 트레이너 1,112,448 → 173,496바이트, 여자 트레이너 1,298,076 → 224,394바이트, 도감 버튼 878,633 → 85,792바이트
- 헤더 구조 참고: [imgobot](https://imgobot.com)의 [헤더 SVG](https://imgobot.com/images/brand/imgobot-header-logo.svg), 확인일 2026-11-10 KST. `viewBox`·`path` 기반 벡터와 Next.js Image의 원본 SVG 표시 구조 확인함. 타 사이트 그림·경로 복사 없음, 해당 로고의 재사용 라이선스 미확인임
- 헤더 자산: 기존 PokeSettle 로고를 VTracer 0.6.15로 경로 추출·색상 단순화한 `frontend/public/logo.svg` 생성함. 임베디드 래스터 없음, 256×256 viewBox, 6,000바이트 미만 벡터, 36px 표시 적용함
- 제공: WebP는 정적 import로 콘텐츠 해시와 Next.js Image API 사용함. SVG는 `unoptimized`로 직접 제공함. 공유 메타데이터용 `logo.png`와 앱 아이콘 PNG·ICO 유지함
