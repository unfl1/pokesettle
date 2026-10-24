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
| [Docker 백엔드 배포](guides/DOCKER_DEPLOYMENT.md) | Lightsail·컨테이너 실행·비밀값·데이터 보존 |
| [프론트엔드 배포](guides/FRONTEND_DEPLOYMENT.md) | 비공개 S3·CloudFront·도메인 HTTPS·선택적 Nginx API 연결 |

최소 실행 절차는 [프로젝트 README](../README.md) 참조

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
    └── guides/        # 운영·자료 안내
```

실행·의존성 설정은 루트 유지: `.env.example`, `.gitignore`, `compose.yaml`, `pyproject.toml`, `uv.lock`
