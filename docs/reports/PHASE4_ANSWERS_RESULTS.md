# Phase 4 — RAG·비RAG 답변 비교

검증일: 2026-10-22 (Asia/Seoul)
범위: F2015 대표 질문 비교, 검색 방식 비교인 F2014와 분리

## 구현

| 원인 | 수정 | 결과 |
|---|---|---|
| 검색 지표만으로 답변 품질 판단 곤란 | 같은 모델·질문을 RAG/비RAG 조건으로 실행 | 생성 답변·출처·유보·지연 시간 비교 가능 |
| 비RAG에 기준 답안·메타가 섞일 위험 | 질문만 전달하고 근거·기준 답안·대화 이력 제외 | 입력 조건 분리 |
| 오래된 기준 자료·색인으로 비교할 위험 | 기준 필드·원문·메타 해시·활성 문서 revision 사전 확인 | 불일치 시 모델 호출 전 거부 |
| 정규식 일치를 정답률로 오인 가능 | 자동 문구 검사와 의미·출처 검토 분리 | 자동 결과만으로 정확도 점수 생성 금지 |
| 다른 실행의 검토 결과 혼입 가능 | 실행 fingerprint·검토 항목·검토자 유형 검증 | 누락·중복·오연결 거부 |
| 모델 예외에 키·내부 정보 노출 가능 | 실패 코드만 저장, 제공자 예외·프롬프트 전문 제외 | 실패도 누락 없이 기록 |

- `backend/scripts/compare_answers.py`: 계획 확인·실제 실행·검토 연결 CLI
- `data/evaluation/rag_cases.json`: 자체 작성 질문 6개·기준 필드·원문 연결·검토 항목
- RAG는 기존 LangGraph 검색·생성·인용/버전 검증 경로 사용
- 비RAG는 기존 지식만 사용, 검색·근거·기준 답안·이전 응답 제공 없음
- 동일 `CHAT_MODEL`, temperature 0 사용, 질문별 호출 순서 교대
- 기본 실행은 모델 호출 없음, `--live`에서만 실제 공급자 호출
- 실행 결과와 빈 검토 양식을 함께 생성, 기존 서비스 API·대화 저장 변경 없음

## 실행

```bash
# 기준 질문·자료 확인, DB 연결·모델 호출 없음
uv run --frozen python -m backend.scripts.compare_answers

# 현재 색인과 모델로 실제 비교
uv run --frozen python -m backend.scripts.compare_answers --live

# 검토자·판정·메모를 채운 후 기존 실행에 연결, 모델 호출 없음
uv run --frozen python -m backend.scripts.compare_answers \
  --report runtime/answer_comparison.json \
  --review runtime/answer_comparison.review.json \
  --output runtime/answer_comparison.reviewed.json
```

- 입력 변경: `--cases /absolute/path/cases.json`, 서로 다른 질문·case ID 5개 이상 필요
- 결과 경로 변경: `--output /absolute/path/result.json`
- 기본 결과: `runtime/answer_comparison.json`·`runtime/answer_comparison.review.json`
- 실제 실행 전 모델 키·모델명·PostgreSQL/pgvector·기준 자료와 일치하는 활성 색인 필요
- 비교 중 데이터 수집·재색인 중지 필요
- 검토 유형: `human` 또는 `assistant_source_audit`, 독립 사람 검토와 구분
- 판정: `correct`, `partial`, `incorrect`, `not_applicable`, 미검토는 null

## 실제 비교 조건

- 모델: `gpt-4.1-mini`, temperature 0, 현재 설정한 OpenAI 호환 공급자
- 한국어 질문 6개, 응답 12개 생성 완료
- RAG: MMR, 전체 Top-k 6·후보 30·lambda 0.5
- 자료: 기존 PokéAPI JSON 스냅샷, 메타 4건·문서 청크 19건을 임시 스키마에 색인
- 외부 문서 재수집 없음, 운영 DB·대화·원본 파일 변경 없음
- 논리 모델 호출: 비RAG 6회·RAG 7회, 공급자 내부 재시도 횟수는 별도 미측정
- RAG/비RAG의 시스템 프롬프트·응답 스키마·검증 방식 차이 존재, 검색 효과만 완전히 분리한 인과 실험과 구분

## 관측 결과

| 질문 | 비RAG | RAG |
|---|---|---|
| 피카츄 타입·스피드 | electric·90 응답 | 같은 핵심 정보·메타 인용, Champions 실전 수치 미확인 분리 |
| 메가리자몽 X 폼·스피드 | fire/dragon·100 응답 | 같은 핵심 정보·선택 폼 메타 인용 |
| 팬텀 특성 | Cursed Body 응답 | cursed-body 응답·메타 인용 |
| 피카츄 볼·꼬리·원문 버전 | 핵심 설명 응답, 구체적인 원래 게임 버전 누락 | 검증 실패 후 유보 |
| 한카리아스 제트기 설명·버전 | 핵심 설명과 Diamond/Pearl 언급 | x·y·sun·sword 원문 설명·해당 청크 인용 |
| Champions M-C 피카츄 승률 | 수치 주장 없이 유보 | 수치 주장 없이 유보 |

| 자동 관측 | 비RAG | RAG |
|---|---|---|
| 실행 완료·도구 실패 | 6건·0건 | 6건·0건 |
| 기대한 응답/유보 동작 | 6/6 | 5/6 |
| 기준 문구 일치 | 11/11 | 8/11 |
| 인용 포함 답변 | 0/6 | 4/6 |
| 평균 소요 시간 | 2.194초 | 5.482초 |

- 문구 일치와 응답/유보 동작은 정답률과 구분
- 비RAG의 인용 없음은 설계상 조건, 그 자체로 오답 판정 금지
- RAG 소요 시간에는 검색·생성·검증 포함, 성능 보장 수치와 구분
- 기본 사실 답변에서 RAG가 더 정확하다는 결론은 이번 결과로 뒷받침되지 않음
- RAG의 출처 추적은 확인했지만 유효한 답변 생성 실패도 관측

## 원문 대조 검토

검토자: Codex, 유형: `assistant_source_audit`
독립적인 사람 검토는 미실행, 자동 문구 검사와도 구분

- 비RAG: 사실 검토 4건 일치·1건 부분 응답, 승률 유보 1건 적절
- RAG: 사실 검토 4건 일치, 승률 유보 1건 적절·피카츄 설명의 유보 1건 부적절
- 피카츄 설명 질문의 검색 결과에 yellow 꼬리 관찰 설명과 볼 전기 저장 청크 존재 확인
- 해당 RAG 응답은 인용·버전 검증 단계에서 교정 1회 후 유보, 세부 실패 조건은 해당 실행 기록만으로 미확정
- 유보 때문에 사실 정확도를 채점할 주장이 없는 사례는 `not_applicable`로 표시하고 유보 적절성을 별도 판정
- 메가 X 참가 가능 여부의 미확인은 제공 자료 범위로 해석, 전 세계에 정보가 없다는 의미로 확대 금지

[원시 실행 결과](../evidence/phase4-answers.json)·[원문 대조 판정](../evidence/phase4-answers-review.json)·[요약](../evidence/phase4-answers-summary.json) 보존
원시 모델 응답은 문체 교정 없이 그대로 기록

## 검증과 한계

- PostgreSQL 18 + pgvector 0.8.1 전체 테스트 78개 통과
- 비RAG 입력 분리·호출 순서·실패/키 노출 방지·기준/색인 불일치 거부·질문 수·검토 fingerprint·교정 피드백 검증
- 실제 검토 JSON을 CLI로 연결하고 유형·판정 집계 확인
- Ruff 검사·포맷 검사·Git 공백 검사·uv 잠금 파일 정합성 검사 통과
- [테스트 기록](../evidence/phase4-answers-tests.json) 참조
- 원시 실행 이후 기준/색인 사전 검사와 검증 피드백 진단을 보강, 실제 생성 응답 재실행·교체 없음
- 원시 결과의 인용 0건에 대한 ID 검사 true는 공집합 검사 결과이며 인용 성공 건수로 집계하지 않음, 현재 도구는 인용 없음에 null 사용
- 작은 단일 실행·선정 질문 묶음의 결과이며 전체 도감·모델 일반 성능·Champions 정확도로 일반화 금지
- 비RAG의 추가 주장을 모든 가능한 외부 지식에 대조한 평가가 아닌 제공 스냅샷 중심 검토
- F2015 비교 도구·실제 비교·출처 대조 수행, F2016 추가 출처와 정밀 전투 계산은 이번 범위 밖

다음 개선 후보: 보존한 피카츄 설명 실패 사례의 검증 피드백으로 세부 원인을 확인하고, 근거 검증을 유지한 상태에서 응답 복원 검토

## 출처

확인일: 2026-10-22 (Asia/Seoul)

- [PokéAPI](https://pokeapi.co/docs/v2): 기존 `data/pokemon.json`·`data/documents/species.json`·`data/sources.json` 사용, 원 수집 시각·URL·권리 기록 유지
- 질문·기준 필드·검토 항목은 프로젝트 자체 작성, 원문 발췌는 검증에 사용한 문맥과 출처를 함께 보존
- 모델 호출은 기존 `StructuredModel`·LangGraph 구현 사용, 추가 패키지 없음
