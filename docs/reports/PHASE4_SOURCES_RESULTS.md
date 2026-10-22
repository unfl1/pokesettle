# Phase 4 — 복수 외부 출처

검증일: 2026-10-22 (Asia/Seoul)
범위: F2016 PokéAPI·Wikipedia 문서 수집·색인·검색·인용

## 구현

| 원인 | 수정 | 결과 |
|---|---|---|
| 수집 출처가 PokéAPI에 한정 | 선택형 Wikipedia 요약 어댑터·후보 통합 추가 | `api`·`wiki` 문서 동시 색인 |
| 이름 검색만으로 다른 문서 연결 가능 | 종 ID별 제목·Wikidata ID 매핑, 응답 항목·언어·버전 검증 | 다른 항목·동음이의·불완전 응답 거부 |
| 출처 추가 시 기존 성공 캐시와 혼용 가능 | 통합 출처 이름·프롬프트 버전 분리 | 기존 단일 출처 선별 결과와 캐시 경계 구분 |
| 새 출처가 필수 자체 문서를 대체할 위험 | PokéAPI 자체 문서 강제 유지, Wikipedia는 후보 선별 대상 | 필수 문서 유지·추가 출처 채택/기각 가능 |
| 기여자·이용 조건 표시 누락 가능 | 인용에 `licence_url` 전달, 화면에 기여자·라이선스 링크 표시 | 원문 버전·권리 추적 가능 |

- `backend/app/data_preparation/wikipedia.py`: 등록한 영문 요약 수집·검증·Document 변환
- `backend/app/data_preparation/sources.py`: 후보 통합·출처별 본문 수집 라우팅
- 기존 `KnowledgeService`·LangGraph·pgvector 경로 사용, 새 벡터 컬렉션·패키지 추가 없음
- 선택된 Wikipedia 문서 실패 시 작업 실패 유지, 성공 완료 캐시에 실패 결과 저장 금지
- 수집한 두 출처 모두 `generic`·적격성 `unknown` 유지, Champions 레귤레이션 검색에서 제외

## 사용

```dotenv
WIKIPEDIA_ENABLED=true
```

- 서버 전용 `.env`에 설정 후 백엔드 재시작
- 기본값 `false`: PokéAPI 단독 후보 수집 유지
- 지원 항목: 피카츄(종 ID 25)·리자몽(종 ID 6), 별도 폼은 종 배경만 공유
- 매핑하지 않은 종은 PokéAPI만 사용, 임의 문서 제목·사용자 URL 검색 없음
- 질문 관련성이 있을 때 선별된 Wikipedia 후보만 본문 수집, 매 질문에서 두 출처 인용 보장 없음
- 설정은 신규 후보 수집 제어, 이미 색인한 문서는 비활성화 후에도 기존 색인에 유지
- Wikipedia 문서 영구 링크·수집 시각·revision/본문 해시·라이선스 보존
- 요약 평문 유지, 범위·기여자·라이선스 헤더 추가 표시

## 검증

| 항목 | 결과 |
|---|---|
| 전체 백엔드 테스트 | 91개 통과, 5.27초 |
| 복수 출처 테스트 | 후보 단계 본문 미수집·항목 검증·실패 재시도·캐시·색인·필터·인용 검증 |
| 화면 E2E | 17개 통과, 17.1초 |
| 신규 화면 검증 | 위키 원문 버전 링크·기여자·라이선스 표시·새로고침 후 복원 |
| TypeScript·Vite 빌드 | 통과 |
| Ruff 검사·포맷·diff 공백 검사 | 통과 |

## 실제 외부 수집·검색

- 운영 DB와 분리한 PostgreSQL 18·pgvector 0.8.1 임시 스키마 사용 후 삭제
- 임베딩: 기존 로컬 `all-MiniLM-L6-v2` ONNX, 기본 유사도 검색·Top-k 6
- 선별: 검증용 결정적 선택기로 등록 후보 모두 채택, 모델 관련성 평가와 구분
- 실제 답변 생성·유료 모델 호출 미실행

| 항목 | 실제 색인 문서 | 청크 | 검색된 출처 | 동일 질문 추가 요청 |
|---|---|---|---|---|
| 피카츄 | PokéAPI·Wikipedia 2건 | 8개 | metadata·wiki·api | 0회 |
| 리자몽 | PokéAPI·Wikipedia 2건 | 6개 | metadata·wiki·api | 0회 |

- 전체 외부 요청 5회·총 14청크, 두 항목 모두 재수집 시 청크 수 유지
- Champions `m_c` 필터에서 일반 문서 제외 확인
- [실행 증거](../evidence/phase4-sources.json): URL·수집 시각·revision·본문 해시·검색 근거 ID 보존
- 지원 범위는 두 종의 배경 요약, 전체 도감의 두 번째 출처 확보 또는 실전 전략 자료 확보와 구분
- 실제 모델의 출처 선택·혼합 답변 정확도는 이번 검증 범위 밖

## 출처

- [Page Content Service](https://www.mediawiki.org/wiki/Page_Content_Service): 요약 API 사양
- [Wikimedia API 접근 정책](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy): 요청 식별·이용 조건
- [Wikimedia 이용 조건](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)·[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): 출처·권리·변형 표시
- [데이터 출처 기록](../guides/DATA_SOURCES.md): 기존 PokéAPI 자료와 새 문서 범위
