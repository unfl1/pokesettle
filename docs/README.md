# 프로젝트 문서

## 설계

| 문서 | 내용 |
|---|---|
| [프로젝트 명세](design/PROJECT_SPEC.md) | 제품 범위·기술 구성·단계별 계획 |
| [요구사항](design/REQUIREMENTS.md) | 과제 요구사항 대응·우선순위 |
| [아키텍처](design/ARCHITECTURE.md) | UI·API·RAG·저장·전투 계산 경계 |
| [API 계약](design/API_SPEC.md) | 요청·응답·작업 상태 |
| [백엔드 구조](design/BACKEND_STRUCTURE.md) | 모듈 구성·실행 경로 |

## 운영·자료 안내

| 문서 | 내용 |
|---|---|
| [데이터 출처](guides/DATA_SOURCES.md) | 자료 수집·권리·적용 범위 |
| [PostgreSQL 전환](guides/POSTGRESQL_MIGRATION.md) | 저장·pgvector 구성·기존 데이터 이전 |

최소 실행 절차는 [프로젝트 README](../README.md) 참조

## 구현·검증 기록

| 문서 | 내용 |
|---|---|
| [초기 RAG 검증](reports/TEST_RESULTS.md) | Phase 1 데이터·검색·생성 검증 |
| [대화 UI 검증](reports/PHASE2_RESULTS.md) | Phase 2 탐색·가이드·대화 화면 |
| [도감 확장 검증](reports/CATALOG_EXPANSION.md) | 전체 종·별도 폼·이미지 지원 |
| [팀·전투 분석 검증](reports/PHASE3_RESULTS.md) | Phase 3 팀 관리·상성·선출 비교 |
| [MMR 검색 비교](reports/PHASE4_MMR_RESULTS.md) | Phase 4 검색 방식·다양성 비교 |
| [RAG·비RAG 답변 비교](reports/PHASE4_ANSWERS_RESULTS.md) | Phase 4 생성 답변·출처 검토 |
| [실행 증거](evidence/) | 원시 실행 결과·테스트·API 스냅샷 |

- 단계별 문서는 해당 실행 당시 기록으로 보존
- 현재 저장 구성은 PostgreSQL·pgvector, 과거 SQLite·Chroma 기록과 구분

## 디렉토리 기준

```text
poketact/
├── README.md          # 프로젝트 소개·최소 실행 절차
├── AGENTS.md          # 작업 지침
├── backend/           # API·RAG·저장·전투 계산·테스트
├── frontend/          # 화면·기능별 UI
├── data/              # 기준 자료·평가 질문·라이선스
└── docs/
    ├── README.md      # 문서 색인
    ├── design/        # 요구사항·명세·설계
    ├── guides/        # 운영·자료 안내
    ├── reports/       # 구현·검증 기록
    └── evidence/      # 원시 실행 증거
```

실행·의존성 설정은 루트 유지: `.env.example`, `.gitignore`, `compose.yaml`, `pyproject.toml`, `uv.lock`
