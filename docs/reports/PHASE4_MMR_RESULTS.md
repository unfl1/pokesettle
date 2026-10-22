# Phase 4 — MMR 검색과 검색 품질 검증

> 후속 F2015 답변 비교는 [RAG·비RAG 결과](PHASE4_ANSWERS_RESULTS.md) 참조, 아래 미실행 표기는 MMR 묶음 검증 당시 기준

검증일: 2026-10-22 (Asia/Seoul)
범위: 사용자 선택에 따른 Phase 4 첫 구현 묶음, F2014 MMR 검색과 동일 색인 비교

## 구현

| 원인 | 수정 | 결과 |
|---|---|---|
| 유사한 문서 청크가 상위 근거에 집중 | `similarity`·`mmr` 설정 분리, LangChain MMR 재선별 추가 | 관련성과 중복 억제 비중 조정 가능 |
| 미완료 색인·다른 규칙·완전 중복이 후보 공간 소모 가능 | 활성 manifest·포켓몬·규칙 필터와 완전 중복 제거 후 후보 수 제한 | 유효 근거가 후보 제한 때문에 누락되는 문제 방지 |
| 다양성 재선별 중 선택 포켓몬 메타 누락 가능 | 메타 1건을 고정하고 외부 청크만 재선별 | 메타 보존·총 Top-k·연속 근거 번호 유지 |
| 검색 설정 변경 후 과거 답변 조건 확인 곤란 | 상태 API·저장 답변에 `retrieval` 설정 스냅샷 추가 | 실행 모드·Top-k·후보 수·lambda 확인 가능 |
| MMR 효과를 답변 품질 향상으로 오인 가능 | 같은 질문·색인·질의 벡터에서 두 모드 비교 | 근거 선택·중복 지표와 답변 정확도 구분 |

- PostgreSQL 벡터를 재사용하며 문서 재임베딩 없이 MMR 적용
- 추가 의존성 없음: 기존 `langchain-core`의 `maximal_marginal_relevance`와 NumPy 사용
- 점수식: `lambda × 질의 유사도 − (1 − lambda) × 이미 선택한 청크와의 최대 유사도`
- 최초 외부 근거는 질의 코사인 유사도 최대 후보 선택, 동점은 기존 후보 순서 유지
- 메타는 MMR 경쟁 대상에서 제외, 외부 근거 최대 `TOP_K - 1`건 선택
- 유사도 검색은 기존 L2 순서 유지, MMR은 코사인 기반 관련성·중복도 사용
- 실제 MiniLM은 정규화된 벡터 사용, 일반적인 미정규화 사용자 임베딩의 L2·코사인 순서 동일성은 보장 대상에서 제외

## 설정과 실행

| 환경변수 | 기본값 | 의미 |
|---|---|---|
| `SEARCH_MODE` | `similarity` | `similarity` 또는 `mmr` |
| `TOP_K` | `6` | 메타 1건을 포함한 전체 근거 수, 2~20 |
| `MMR_FETCH_K` | `30` | 필터·완전 중복 제거 후 MMR 후보 수, `TOP_K - 1` 이상·200 이하 |
| `MMR_LAMBDA_MULT` | `0.5` | 0~1, 클수록 관련성·작을수록 다양성 우선 |

`.env`에 `SEARCH_MODE=mmr` 설정 후 서버 재시작으로 적용
기본 유사도 동작 유지, 검색 설정 변경만으로 재색인 불필요

```bash
uv run --frozen python -m backend.scripts.compare_retrieval
```

- 현재 DB의 동일 색인에서 기본 5개 질문 비교, 외부 수집·모델 API 호출 없음
- 기본 출력: `runtime/retrieval_comparison.json`
- 사용자 질문 묶음: `--cases /absolute/path/cases.json`
- 별도 출력: `--output /absolute/path/result.json`
- 항목 형식: `pokemon_id`, `query`, 선택 `regulation_id`, 선택 `expected_terms` 문자열 배열
- 비교 시 동일 질의 벡터를 재사용하고 질의 임베딩 준비 시간을 검색 시간에서 제외
- 비교 중 색인 수집·갱신 중지 필요, 전후 fingerprint 변경 감지 시 비교 결과 게시 거부

## 실제 데이터 비교

자료: 기존 PokéAPI 종별 원문 스냅샷, 피카츄·이상해씨·리자몽·팬텀·한카리아스 5종
색인: 메타 5건·문서 청크 22건, 임시 PostgreSQL 스키마와 실제 MiniLM 384차원 벡터
영어 질문 5개 사용, 전체 도감·한국어 검색 성능을 대표하는 평가로 해석 금지

| 비교 설정 | 선택 집합 변경 | 순서 변경 | 기대 주제어 포함 비율 |
|---|---|---|---|
| 기본 `TOP_K=6`, `fetch_k=30`, `lambda=0.5` | 5건 중 1건 | 5건 중 3건 | 두 모드 모두 모든 질문의 두 주제어 포함 |
| 다양성 예시 `TOP_K=3`, `fetch_k=30`, `lambda=0.3` | 5건 중 2건 | 5건 중 2건 | 두 모드 모두 모든 질문의 두 주제어 포함 |

| 사례 | 질의 평균 코사인 유사도: 유사도 → MMR | 선택 청크 간 평균 코사인: 유사도 → MMR |
|---|---|---|
| 기본 설정·피카츄 | 0.444824 → 0.417712 | 0.688174 → 0.626935 |
| 다양성 예시·리자몽 | 0.631274 → 0.620626 | 0.796634 → 0.761873 |
| 다양성 예시·팬텀 | 0.634534 → 0.498151 | 0.684544 → 0.409523 |

- 낮은 청크 간 코사인은 임베딩상 중복 감소를 나타내는 대리지표
- 관련성 유사도도 감소한 사례 존재, MMR의 무조건적인 품질 향상 주장 제외
- 기대 주제어는 원문에서 확인한 영어 문자열, 외부 청크의 단순 포함 여부만 측정
- 주제어 포함 비율은 확률·정답률·사람의 관련성 판정과 구분
- 후보가 Top-k보다 적거나 같은 경우 선택 집합이 같을 수 있으며 정상 동작
- [기본 설정 원시 결과](../evidence/phase4-mmr.json)·[다양성 예시 원시 결과](../evidence/phase4-mmr-diversity.json) 보존

## 검증

- PostgreSQL 18 + pgvector 0.8.1에서 전체 테스트 68개 통과
- 기존 API·팀·대화·RAG·이전·동시성 회귀 유지
- MMR 근접 중복 회피·lambda 0/1·결정성·빈/부족 후보·메타 고정·범위/manifest/중복 필터 검증
- 잘못된 모드·후보 수·lambda/NaN 설정 거부 검증
- 실제 검색 설정의 상태 API·저장 메시지 복원 검증
- 동일 색인의 선택 차이·주제어 포함 비율·코사인 지표·비교 중 색인 변경 거부 검증
- Ruff 검사·포맷 검사·Git 공백 검사·uv 잠금 파일 정합성 검사 통과
- 실제 비교에서 외부 수집·모델 공급자 호출 없음
- [테스트 요약](../evidence/phase4-tests.json) 참조

```bash
POKETACT_TEST_DATABASE_URL="$DATABASE_URL" uv run --frozen pytest -q
uv run --frozen ruff check backend
uv run --frozen ruff format --check backend
```

## 범위와 한계

- F2014: 설정 기반 MMR과 유사도 검색 차이 확인
- F2015: RAG/비RAG 답변 비교 미실행, 이번 5개 질의는 검색 비교이며 답변 정확도 평가와 구분
- F2016: 복수 외부 출처 추가 미구현
- 데미지·조건부 KO·전투 규칙 검증·고급 시뮬레이션은 이번 선택 범위 밖
- 이번 변경은 Phase 4 전체 완료가 아닌 MMR 검색 묶음 완료
- 후보 유효성을 보존하기 위해 PostgreSQL에서 항목별 전체 후보를 읽고 필터 후 MMR 풀 제한, 대규모 색인의 조회 비용은 추가 최적화 대상
- 프론트 화면 변경 없음, 서버 설정과 비교 도구 중심 검증
- PR #8의 DB 전환 범위와 분리, Phase 4 변경은 `develop`에서 작업

## 출처

확인일: 2026-10-22 (Asia/Seoul)

- [LangChain MMR 구현](https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/vectorstores/utils.py): 설치된 `langchain-core==1.6.0`의 구현과 파라미터 대조
- [pgvector 공식 문서](https://github.com/pgvector/pgvector): 기존 L2 검색·저장 벡터 재사용, PostgreSQL License
- [PokéAPI](https://pokeapi.co/docs/v2): 원문·수집일·권리 기록은 [데이터 출처](../guides/DATA_SOURCES.md)와 `data/sources.json` 유지
- 기본 주제어는 기존 `data/documents/species.json` 원문에서 직접 확인, 게임별 설명을 Champions 사실로 승격하지 않음
