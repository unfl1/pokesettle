# 배포·운영 지침

- 저장소 Docker 설정: `deployment/docker/`
- 직접 빌드: `docker build -f deployment/docker/Dockerfile -t poketact-backend:local .`
- 자동 배포 번들은 기존 서버 경로 유지, 저장소 이동에 따른 서버 수신기 재설치 불필요

## 구성

| 시점·대상 | 처리 |
|---|---|
| `main` 대상 PR | 실제 PostgreSQL + pgvector 회귀·프론트 빌드·백엔드 이미지 빌드·모니터링 설정 검사 |
| `main` push·병합 | 동일 검증 → API·Next.js 이미지 전달 → 서버 준비 상태 확인 → CloudFront 캐시 무효화 → 공개 경로 확인 |
| API 운영 기록 | 경로 템플릿·상태 코드·처리 시간·서버 생성 요청 ID만 JSON 기록 |
| 모델 운영 기록 | 용도별 시도 횟수·성공/실패·처리 시간 기록, 내부 SDK 재시도는 별도 분리 불가 |
| Grafana | API·모델·서버 지표·로그·현재 경보 조회 |

- Jenkins·컨테이너 레지스트리 없이 GitHub 실행기에서 이미지 빌드, SSH로 압축 결과물 전송
- `.github/workflows/ci.yaml`: 검증 및 배포 결과물 생성
- `.github/workflows/deploy.yaml`: `main` 검증 통과 이후 `production` 환경에서만 배포
- 배포 동시 실행 차단, 실행 중 배포를 새 커밋으로 취소하지 않음
- 애플리케이션 API 키·DB 비밀번호는 서버에 유지, GitHub Actions에 전달 불필요

## 최초 연결

### 서버

- 기존 `~/poketact/.env.production`·DB·모델 볼륨 유지
- 배포 전용 Ed25519 키 생성, 개인 관리용 SSH 키를 Actions와 공유하지 않음
- 검토한 체크아웃과 전용 공개키를 서버에 전송한 뒤 아래 명령 실행

```bash
sudo bash deployment/bootstrap_server.sh dedicated-deploy-key.pub
```

- 설치 결과: root 소유 `/usr/local/lib/poketact/receive-release.py`, 비공개 `/etc/poketact/observability.env`
- 전용 공개키는 `deploy <40자리 커밋 SHA>` 강제 명령만 허용, 포트 포워딩·PTY·일반 셸 차단
- 일반 관리용 SSH 키는 별도 유지
- `.env.observability`에 해당하는 실제 Grafana 비밀번호는 서버에서 무작위 생성, Git 제외

### AWS

- 인증된 CloudShell에서 기존 `~/poketact-deployment.json`과 아래 스크립트 사용

```bash
# GitHub 인증이 있는 로컬 터미널에서 현재 subject prefix 조회
gh api repos/unfl1/poketact/actions/oidc/customization/sub --jq .sub_claim_prefix
# CloudShell에서 위 조회 결과를 그대로 사용, 실제 ID는 Git에 기록하지 않음
python3 bootstrap_github_oidc.py --repository unfl1/poketact --subject-prefix 'repo:OWNER@OWNER_ID/REPO@REPO_ID'
```

- 최신 저장소의 subject에는 이름과 영구 ID가 함께 포함됨, 이름만으로 신뢰 조건을 추측하지 않음
- 기존 이름 전용 조건을 이전할 때만 `--migrate-legacy-subject` 추가, 같은 저장소의 기존 정확 일치 조건만 교체하며 다른 신뢰 조건은 변경 거부

- GitHub `production` 환경만 신뢰하는 OIDC 역할 생성, 장기 AWS 액세스 키 미발급
- 권한: 해당 배포의 CloudFront 무효화 생성/조회
- S3 삭제·버킷 정책 변경·CloudFront 원본 변경·IAM 변경 권한 부여 없음
- 출력 식별자는 `github-production-secrets.json`에 권한 `600`으로 저장, Git 제외

### GitHub

- 저장소 Environment `production` 생성, 허용 배포 브랜치를 **`main` 하나로 제한**
- OIDC 신뢰 조건은 환경 이름을 사용하므로 GitHub 환경의 브랜치 제한도 함께 적용 필요
- 아래 값을 `production` Environment secrets에 설정, 문서·커밋·실행 로그에 실제 값 기록 금지

| Secret | 값 |
|---|---|
| `DEPLOY_HOST` | 서버 SSH 주소 |
| `DEPLOY_SSH_KEY` | 배포 전용 개인키 |
| `DEPLOY_KNOWN_HOSTS` | 관리 연결에서 확인한 서버 호스트 키 |
| `AWS_ROLE_ARN` | OIDC 역할 ARN |
| `CLOUDFRONT_DISTRIBUTION_ID` | 기존 배포 ID |
| `PRODUCTION_URL` | 실제 프론트 HTTPS URL |

- GitHub Secrets는 저장소 파일과 별개인 암호화 설정 저장소, 개인키 파일을 Git에 올리는 방식과 구분
- Actions는 준비된 환경값이 하나라도 없으면 실제 배포 전에 실패 처리
- SSH 호스트 키 검증 유지, 실행 중 `ssh-keyscan` 결과를 무조건 신뢰하는 방식 제외

## 배포 동작과 복구

- PR의 `Verify / verify`: 공개 파일·Ruff·배포 Python·셸 정적 검사만 수행, 전체 회귀 검사는 PR 단계에서 실행하지 않음
- `main` 병합 후 `Deploy production`: 같은 커밋의 백엔드 회귀·프론트 Docker/E2E·모니터링 통합 검증을 병렬로 1회 수행, 모두 통과한 이미지로 릴리스 생성 후 배포
- 프론트엔드는 Docker 안에서 빌드·타입 검사 후 해당 이미지로 E2E 수행, 별도 호스트 Next.js 빌드 생략
- `Verify` 수동 실행: 선택한 브랜치의 전체 검증·릴리스 패키징만 수행, 서버 배포 미수행
- 캐시: 잠금 파일 기준 pip·uv·pnpm 저장소와 백엔드/프론트별 BuildKit GHA 레이어 재사용, 의존성 설치는 `--frozen` 유지, 테스트 결과 자체는 캐시하지 않음
- E2E 브라우저: Ubuntu 러너에 기본 설치된 Chrome을 `CHROME_PATH`로 사용, 브라우저·시스템 라이브러리 중복 설치 생략, 실제 사용 버전은 Actions 로그에 출력
- 릴리스: 같은 실행의 SHA별 이미지 아티팩트만 결합, 이미지 재빌드 없음, gzip 레벨 1로 압축 시간 절감, 운영 SSH·OIDC 권한은 기존 배포 job에만 부여

- 전달 대상: Docker 이미지와 명시한 Compose·모니터링 설정만 포함한 압축 번들
- 서버 수신기는 파일 목록·중복·심볼릭 링크·크기·커밋 SHA 확인 후 적용
- 운영 환경변수는 서버 파일을 참조, 번들·Docker 빌드에 포함하지 않음
- 프로젝트 이름 `poketact` 유지로 기존 PostgreSQL·모델 볼륨 재사용
- `--no-deps`로 PostgreSQL 자동 재생성 제외, 자동 재색인·DB 삭제·스키마 변경·Nginx/방화벽 변경 미수행
- 서버 준비 상태 실패 시 이전 API·기존 Next.js 이미지로 복구, 최초 Next.js 전환 실패 시 새 프론트 컨테이너 정지, 실패 실행은 Actions에서 실패로 표시
- 현재·이전 릴리스 설정 및 이미지 보관, 그보다 오래된 전용 릴리스 정리
- API 컨테이너 교체 중 짧은 중단 가능, 무중단 배포 보장 없음
- 서버 배포 성공 후 CloudFront `/*` 캐시 무효화 및 완료 대기, 홈(`/ko`)·챗봇(`/ko/chat`)의 경로·서버 렌더링·Next.js 정적 자산·API 준비 상태 검사
- 공개 검사 실패 시 서버 배포는 이미 반영된 상태일 수 있음, 서버 내부 준비 상태와 CloudFront·Nginx 공개 경로를 각각 확인
- S3 정적 파일 업로드 없음, 최초 Next.js 전환 시 아래 HTTPS 서버 원본 연결을 별도로 적용해야 함
- `down -v` 사용 금지, 사용자 데이터 복원은 별도 백업·복구 절차 적용

## Grafana 접속과 관측

```bash
ssh -L 13000:127.0.0.1:3000 사용자@서버
```

- 로컬 `http://127.0.0.1:13000` 접속, 관리자 이름 `admin`
- 비밀번호는 서버 `/etc/poketact/observability.env`에서 비공개 확인, 최초 로그인 후 사용자 직접 변경 권장
- `PokeTact` 폴더 → `PokeTact Operations`: API 상태·요청률·p95 지연·5xx·모델 시도·CPU·메모리·디스크·경보·로그
- Grafana·Prometheus·Loki·지표 포트 인터넷 공개 없음, Grafana만 호스트 loopback 바인딩
- Grafana Explore → Loki → `{job="poketact"} | json`으로 운영 이벤트 검색
- Prometheus 규칙: 지표 단절·5xx·지연·모델 실패·메모리·디스크 경보, 현재 상태를 대시보드에서 조회
- 외부 이메일·웹훅 알림 미연결, 호스트 전체 장애 시 같은 호스트의 Grafana 조회도 불가
- 지표 7일/512MB, Loki 로그 72시간 보존; Loki 용량은 시간 기준이므로 디스크 감시 필요
- 앱 운영 로그 5MB × 3개 순환, Docker 자체 로그도 별도 순환
- 모니터링 컨테이너 메모리 한도 합계 832MiB, Grafana Go 메모리 소프트 한도 192MiB 적용, 실제 부하에 따른 서버 여유 확인 필요

## 비밀값과 수집 범위

- 로그 제외: 질문·답변·프롬프트·요청 본문·쿠키·헤더·쿼리 문자열·실제 경로 식별자·공급자 예외 원문
- Uvicorn 기본 접근 로그 비활성화, Alloy는 허용된 JSON 운영 파일만 수집
- Alloy에 Docker 소켓 제공 없음, DB 로그·서버 환경변수 파일 수집 없음
- node-exporter는 호스트 CPU·메모리·파일시스템·부하 지표에 필요한 호스트 경로를 읽기 전용 마운트
- 모델 지표는 호출 시도·호출 전 보수적 예약량이며 정산 후 DB 사용량·청구액과 구분, 별도 DB 집계로 유료 호출과 예약 토큰 한도 강제
- 기존 Nginx의 API 접근 로그 비활성화와 원본 인증 설정 유지
- `.gitignore`·`.dockerignore`·CI 공개 파일 검사 적용, 이미 추적한 비밀값의 제거·폐기는 별도 대응 필요

## 공식 출처

- [GitHub Actions 배포](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [AWS OIDC 연결](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [Grafana 데이터 소스](https://grafana.com/docs/grafana/latest/datasources/)
- [Loki 보존 설정](https://grafana.com/docs/loki/latest/operations/storage/retention/)
- [Alloy 파일 로그 수집](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.file/)

설정·이미지 버전 확인일: 2026-10-24, 외부 코드·이미지의 이용 조건은 각 원본 프로젝트 라이선스 적용

## 반복 호출·사용량 방어

- 기본 한도: 세션당 분당 3개·하루 200개, IP당 하루 400개, 세션/IP당 동시 1개·서비스 전체 동시 2개 작업
- 적용 경로: 챗봇·가이드·문서 수집·자연어 포켓몬 검색, 기본 GET 도감 조회와 계산기는 유료 모델 호출 없음
- 익명 세션은 사람별 인증과 구분, 같은 네트워크 이용자는 IP 한도 공유, IPv6는 /64 단위 공유
- 원본에서 검증한 CloudFront 마지막 X-Forwarded-For 주소만 `X-PokeTact-Viewer-IP`로 덮어쓰기, 앱은 운영 Compose에서만 해당 헤더 신뢰
- 배포 순서: 새 Nginx 템플릿의 `map`·`proxy_set_header` 반영 후 `nginx -t`·reload 수행, 이후 앱 배포; 누락·잘못된 IP 헤더는 유료 작업 503 차단
- 모델 제한: 호출당 입력 예약 상한 24,000(UTF-8 바이트와 여유분 기준)·출력 상한 2,000토큰, 질문당 공급자 호출 최대 8회, SDK 내부 자동 재시도 제외·명시적 재시도마다 별도 예약
- 서비스 전체 일일 한도: 정산 사용량과 미정산 예약량 합계 최대 230,000·공급자 호출 1,000회 중 먼저 도달하는 기준 적용, 한도 도달 후 새 유료 호출 차단
- 하루 200개는 사용자 최대 접수량이며 유료 응답 200개 보장과 구분, 전체 한도 도달 시 기본 GET 도감 조회 유지
- 호출 전 예약 토큰은 프롬프트·자료·스키마의 UTF-8 바이트와 여유분·최대 출력을 합친 보수적 값, 실제 사용 토큰·달러 청구액과 구분; 공급자별 요금·토큰 계산 방식과 엄밀한 청구액 상한은 별도 검증 필요
- 챗봇의 이전 기록은 질문·답변 본문만 모델에 전달, 과거 출처·전투 계산 객체 재전송 제외; 입력 예약 상한 초과 시 오래된 기록부터 제외하며 현재 질문·전투 상태·이번 근거 유지, 해당 자료만으로도 초과하면 `MODEL_INPUT_LIMIT` 반환
- 현재 전투 분석이 이번 근거에 포함되면 모델 입력에서 해당 evidence_id만 참조, 전체 분석 중복 전송 제외; 근거 목록에서 제외된 경우 전체 분석 유지, UI·저장 결과·사용량 제한 유지
- `MODEL_INPUT_LIMIT`는 호출당 입력 예약 상한이며 개인·IP별 요청 횟수나 서비스 전체 일일 예산 초과와 구분
- 성공한 구조화 응답은 공급자 `usage_metadata`의 입력·출력·전체 토큰 합계를 검증한 뒤 실제 전체 토큰으로 정산, 예약별 DB 식별자로 중복 정산 차단·원래 UTC 날짜에만 반영, 호출 횟수는 환급 없음
- 사용량 누락·형식 오류·불명확한 공급자 실패·시간 초과·출력 검증 실패는 전체 예약 유지, 과거 예약의 실제 사용량 추정·소급 환급 없음, 재시작 후 사용량 유지, DB 장애 시 예약 불가로 모델 호출 중단
- PostgreSQL 트랜잭션 잠금으로 다중 프로세스 동시 요청의 한도 초과 방지, 중복 clientRequestId는 기존 작업 반환·추가 접수량 차감 없음
- 정산 DB 장애는 추가 유료 재시도 없이 실패 처리, 이미 확보한 예약 유지
- 일일 기준 UTC 00:00, 한국 시각 09:00 초기화; 사용량 행은 다음 접수 시 지난 날짜 정리, 비정상 종료 작업 슬롯은 15분 후 만료·만료된 작업의 추가 모델 호출 차단
- 저장: 별도 집계 테이블·예약 식별자·작업 슬롯, IP/세션 원문 대신 DB별 비밀값으로 HMAC 처리한 식별자 사용, 질문·공급자 응답을 사용량 집계에 저장하지 않음
- 설정: `deployment/docker/.env.production.example`의 `USAGE_*`·`MODEL_MAX_*` 값을 서버 비공개 env에서 조정, 0 이하 한도는 시작 시 거부
- 관측: Grafana의 시간당 예약 토큰·차단 사유별 횟수 패널, 반복 차단 경보 추가; 예약량 누계는 프로세스 지표이며 강제 차단 기준은 DB 집계
- 로컬 실제 모델 비교도 동일 전체 예산과 실행당 호출 제한 적용, 대규모 비교는 운영과 분리된 테스트 DB·키·한도 사용 권장
- [CloudFront X-Forwarded-For 처리](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html)


## Docker 백엔드 배포

구성: FastAPI·참조 계산기·로컬 ONNX 임베딩을 포함한 백엔드 이미지와 PostgreSQL + pgvector 컨테이너

### 서버 준비

- Ubuntu 서버와 Docker Engine·Compose 플러그인 필요
- 프로젝트 파일과 기준 데이터 전송, `.env`·SSH 키·로컬 DB·대화 기록·개인 문서는 소스 전송 대상에서 제외
- `deployment/docker/.env.production.example`을 `.env.production`으로 복사 후 서버에서 비밀값 설정, 파일 권한 `600` 적용
- `POSTGRES_PASSWORD`는 서버별 고유 URL-safe 값 사용, `OPENAI_API_KEY`는 운영용 키 설정
- `ALLOWED_ORIGINS`는 실제 프론트엔드 주소로 설정, CORS를 인증이나 요청 제한으로 간주하지 않음
- 기존 DB 볼륨의 비밀번호는 환경변수 변경만으로 바뀌지 않으므로 별도 DB 계정 변경 절차 필요

### 최초 실행

저장소 루트에서 실행, `--project-directory .`로 빌드·환경변수·볼륨 상대 경로 기준 유지

```bash
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml config --quiet
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml build api
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml up -d --wait postgres
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml run --rm index
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml run --rm index python -m backend.scripts.index_strategy
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml up -d --wait api
curl --fail http://127.0.0.1:8000/api/status
```

- 첫 색인 시 체크섬 검증된 임베딩 파일 다운로드 및 벡터 생성, 전략 색인 시 PokéAPI 자료 요청 발생
- API는 단일 worker로 실행, PostgreSQL 준비 이후 시작
- 상태 검사는 색인·모델 설정 여부 확인용이며 실제 모델 호출 성공 보장과 구분
- PostgreSQL은 호스트 포트 미공개, FastAPI는 호스트 `127.0.0.1:8000`에만 바인딩
- 인터넷 공개 전 HTTPS 프록시·접근 통제·요청 제한·API 지출 한도 구성 필요
- CloudFront와 HTTPS 프록시 구성은 [프론트엔드 배포](OPERATIONS.md#프론트엔드-배포) 참고
- 개인 SSH 터널로 확인 시 `ssh -L 18000:127.0.0.1:8000 사용자@서버` 실행 후 로컬 `http://127.0.0.1:18000/docs` 접속

### 업데이트와 데이터 유지

```bash
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml build api
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml up -d --wait api
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml ps
```

- `postgres_data`: 대화·팀·출처 캐시·벡터 색인 보존
- `runtime_data`: 다운로드한 임베딩 모델 보존
- 기준 데이터·청킹·임베딩 설정 변경 시 재색인 필요
- `down -v`는 DB 볼륨 삭제 명령이므로 운영 작업에서 사용 금지
- 로그는 컨테이너별 10MB × 3개로 순환, 실제 키·전체 환경변수·대화 원문 출력 금지
- `docker compose config`는 비밀값을 펼칠 수 있으므로 검증 시 `--quiet` 사용

### DB 백업

```bash
install -d -m 700 backups
umask 077
sudo docker compose --project-directory . --env-file .env.production -f deployment/docker/compose.production.yaml exec -T postgres pg_dump -U poketact -d poketact -Fc > backups/poketact.dump
```

- 백업 파일은 Git·이미지·공개 웹 경로 제외, 동일 서버의 백업만으로 장애 복구를 보장할 수 없으므로 별도 비공개 저장소와 복구 검증 필요
- 복원 시 대상 DB·버전·기존 데이터 영향 확인 후 `pg_restore` 적용

### 참고

- [Docker Ubuntu 설치](https://docs.docker.com/engine/install/ubuntu/)
- [Compose 준비 상태와 시작 순서](https://docs.docker.com/compose/how-tos/startup-order/)
- [Lightsail 방화벽](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html)


## 프론트엔드 배포

### 구성

- CloudFront → HTTPS Nginx → Next.js standalone 서버(`127.0.0.1:3001`), `/api/*`는 FastAPI 연결
- S3 정적 ZIP 업로드·SPA `index.html` 재작성 제거, Next.js App Router 경로·RSC 응답·이미지 최적화 서버 사용
- CI에서 백엔드·프런트엔드 이미지를 함께 빌드·패키징하고 Compose로 기동
- `API_ORIGIN`: Next.js 빌드 시 FastAPI rewrite 대상, Docker 빌드는 `http://api:8000`
- 언어 경로: `/ko`, `/en`, `/ja`, `/zh`, 기능 주소 `/{lang}/chat`·`pokedex`·`meta`·`scenario`, 기존 무접두사 주소는 한국어로 308 연결
- SEO 원본 도메인: 기본 `https://www.chikorita.xyz`, 다른 도메인은 빌드 환경의 `SITE_URL` 설정 후 재빌드 필요, 런타임 변경만으로 정적 sitemap·robots 변경 불가
- 내부 링크: 홈 ↔ 작업 화면은 문서 전체 이동으로 이전 metadata 정리, 작업 메뉴·메타 도감 링크는 `prefetch={false}`로 자동 선조회 제외, 작업 메뉴 사이의 클라이언트 이동과 편집 상태 유지
- 로컬 Next.js 환경 변수는 `frontend/.env.local`에 설정, 루트 백엔드 `.env`와 분리
- `GA_ID`: 프런트엔드 서버 런타임 GA4 측정 ID, 미설정 시 Analytics 비활성화, 변경 후 프런트 컨테이너 재생성
- 폰트: Pretendard 1.3.9 자체 호스팅, 공통 글리프 `next/font/local`·나머지 91개 Unicode 서브셋 필요 시 로드

### 로컬 실행과 빌드

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
pnpm --dir frontend run build
pnpm --dir frontend run typecheck
pnpm --dir frontend test:e2e
```

### Codex Next.js DevTools MCP

- 설정: `frontend/.codex/config.toml`, `pnpm dlx next-devtools-mcp@latest` 표준 입출력 서버, 최초 실행 시 패키지 내려받기
- 실행 조건: Node.js·pnpm이 Codex 실행 환경의 `PATH`에 존재, `frontend` 작업 디렉터리에서 새 Codex 세션 시작, 신뢰한 프로젝트의 설정 로드 필요
- 개발 서버: `pnpm --dir frontend dev`, 기본 포트 `5173`, Next.js 내장 `/_next/mcp` 연결
- 확인 도구: `nextjs_index`의 `port: "5173"`으로 서버 검색, `nextjs_call`의 `get_routes`·`get_errors`·`get_compilation_issues`로 경로·오류 분석
- 범위: 개발 전용 도구, 프로덕션 Next.js 서버는 MCP 분석 대상 제외
- E2E 포트 분리: 기존 개발 서버 실행 중 `PLAYWRIGHT_PORT=5174 pnpm --dir frontend test:e2e`, 새 빌드 서버에서 검증
- 근거: [Next.js MCP](https://nextjs.org/docs/app/guides/mcp), [Codex MCP 설정](https://learn.chatgpt.com/docs/extend/mcp), 확인일 `2026-10-27`

- 프로덕션 이미지: `deployment/docker/Dockerfile.frontend`, `.next/standalone`·`.next/static`·`public` 포함
- 운영 설정: `deployment/docker/compose.production.yaml`, `deployment/docker/.env.production.example`
- 인증된 AWS CloudShell에서 최초 CloudFront 배포 생성, 원본 Nginx HTTPS·검증 헤더 설정 선행

```bash
python3 deployment/aws/provision_frontend.py --domain example.com --origin-token-file /private/path/origin-token
```

- 생성 결과의 CloudFront 주소를 `www` CNAME으로 등록, ACM 검증 CNAME을 DNS에 등록
- `~/poketact-deployment.json`은 동일 배포 리소스 식별자 보관용, 다른 계정·도메인 재사용 금지
- ACM 상태 `ISSUED` 확인 후 아래 연결 명령 실행, 기존 배포도 동일 명령으로 Next.js 원본 연결

### HTTPS 서버 원본 연결

- Lightsail 고정 IP에 루트 도메인·`api` A 레코드 등록
- 호스트 Nginx·Certbot 설치, `deployment/nginx/bootstrap.conf`로 80번 ACME 경로 준비
- 루트·API 도메인의 웹루트 인증서 발급, 실제 경로로 `api.conf.template` 치환
- 64자리 무작위 16진수 원본 검증값을 별도 비공개 파일에 보관, Git·로그·브라우저 배포 파일 제외
- `/etc/nginx/poketact-private/origin-token.conf`는 root 전용 디렉터리·파일 권한 `700`·`600`으로 생성

```nginx
set $valid_origin_token 0;
if ($http_x_poketact_origin = "REPLACE_WITH_PRIVATE_ORIGIN_TOKEN") { set $valid_origin_token 1; }
```

- 원본 검증값은 CloudFront 사용자 지정 원본 헤더와 Nginx에서 동일하게 설정, API 키와 별도 관리
- `nginx -t` 통과 후 반영, Certbot deploy hook에 `reload-after-renewal.sh` 설치
- `.env.production`의 `ALLOWED_ORIGINS`에 실제 프론트 HTTPS 주소 설정 후 API 컨테이너 재생성
- 443번 HTTPS 원본 준비 후 아래 연결 실행

```bash
python3 deployment/aws/connect_frontend.py --origin-token-file /private/path/origin-token
```

- API 캐시 비활성화, 쿠키·쿼리·요청 헤더 전달, Nginx 응답 `Cache-Control: no-store` 적용
- 기존 S3·Vite 배포 전환 순서: Nginx 템플릿 백업·반영 → `nginx -t`·reload → 인증된 원본 `/chat` 응답 확인 → `connect_frontend.py`로 CloudFront 전환 → 공개 검사
- 전환 전 서버의 root 소유 `/usr/local/lib/poketact/receive-release.py`를 검토한 최신 `deployment/receive_release.py`로 갱신, 이전 수신기는 Next.js 이미지가 전달돼도 프론트 컨테이너 기동·준비 검사 미수행
- 서버 수신기는 릴리스 번들에 포함되지 않으므로 앱 재배포만으로 갱신되지 않음, 기존 수신기 백업 후 root 소유·실행 권한 유지
- Nginx 화면 요청은 `127.0.0.1:3001`, `/api/` 요청은 `127.0.0.1:8000`으로 전달, 기존 원본 인증값·인증서·API 요청 제한 유지
- 공개 HTML의 `Server: AmazonS3`·`/assets/`와 Next.js 자산 부재는 기존 정적 원본 유지 징후, 캐시 무효화만으로 원본 전환 불가
- 전환 후 `PRODUCTION_URL=https://www.example.com python3 deployment/check_production.py`로 서버 렌더링·정적 자산·API 준비 상태 확인, 실제 도메인 사용
- 세션 쿠키 Secure·HttpOnly·SameSite=Lax 적용, DB·8000번 직접 공개 제외
- 전체 쓰기 요청 분당 30회·순간 burst 5, 읽기 CloudFront 연결 IP별 초당 10회 적용
- 원본 검증값은 서버 직접 호출 제한용이며 서비스 이용자 인증과 구분
- 요청 제한은 AI 지출의 금액 상한을 보장하지 않음, 공개 운영 시 별도 사용량 관리 필요
- 루트 HTTP·HTTPS는 HTTPS `www`로 이동, 나머지 HTTP 호스트는 인증서 검증 경로 외 404 반환

### 참고

- [CloudFront 사용자 지정 원본](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html)
- [CloudFront 대체 도메인 인증서](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html)
- [CloudFront 관리형 원본 요청 정책](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html)
- [Nginx 프록시 모듈](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)


## PostgreSQL + pgvector 저장·검색 통합

변경일: 2026-10-22 (Asia/Seoul)

### 구현

| 원인 | 수정 | 결과 |
|---|---|---|
| 상태 저장에 SQLite 사용 | PostgreSQL·psycopg로 교체 | 세션·대화·팀·작업·캐시를 PostgreSQL에 저장함 |
| SQLite 전용 SQL·행 순서 사용 | 매개변수·upsert·identity `seq` 적용 | 기존 API·대화 순서·세션 소유권 유지함 |
| 동시 작업 요청·상태 갱신 경합 | 트랜잭션 advisory lock·`FOR UPDATE` 적용 | 동일 요청 ID 중복 생성과 상태 덮어쓰기 방지함 |
| 이전 색인의 완료 캐시 재사용 위험 | 읽기 전용 이전·manifest/완료 캐시 제외·원문 재색인 | 실제 PostgreSQL 벡터 청크 확인 후 PostgreSQL에 완료 상태 생성함 |

| 저장 대상 | 저장소 |
|---|---|
| 세션·대화·메시지·팀·작업·캐시·원문·manifest | PostgreSQL의 `sessions`, `conversations`, `messages`, `teams`, `jobs`, `cache` |
| 포켓몬 메타·문서 청크·임베딩 | PostgreSQL `vector_collections`·`vector_entries`의 `pokemon_meta`·`pokemon_docs` 논리 컬렉션 |
| 도감·출처·규칙 기준 스냅샷 | `data/` JSON |

- 원본 PDF 5쪽의 Chroma 지정은 확인된 사실임. 사용자가 PostgreSQL + pgvector 통합을 선택함. 과제 측 대체 허용 확인과 구분함.
- 기존 `runtime/embedding_model` 캐시 재사용함. ChromaDB·langchain-chroma 의존성과 런타임 저장 경로 제거함.
- 메타데이터는 JSONB 동등 필터, 벡터는 `<->` 정확 L2 검색 적용함. 모델·차원 불일치와 비유한 벡터 입력 거부함.

### 실행

`.env.example`을 참고해 다음 항목 설정 필요함:

- `POSTGRES_PASSWORD`: 로컬 Compose DB 비밀번호.
- `DATABASE_URL`: 같은 사용자·비밀번호·포트·DB로 구성한 연결 URL. 비밀번호의 예약 문자는 URL 인코딩 필요함.
- `DATABASE_SCHEMA`: 기본 `poketact`. 소문자 영문·숫자·밑줄 사용함.
- `RUNTIME_DIR`: 기본 저장소의 `runtime`. 로컬 임베딩 모델 캐시 경로임. 벡터 데이터는 PostgreSQL에 저장함.
- 기존 모델 공급자 설정 유지함. DB 연결 문자열은 설정 객체의 `repr`에서 제외함.

```bash
docker compose up -d --wait postgres
uv sync --python 3.12 --frozen --group dev
uv run --frozen python -m backend.scripts.index_data
uv run --frozen uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

- 기존 PostgreSQL 사용 시 Compose 시작 생략 가능함. UTF-8 DB·pgvector 설치·스키마 생성 권한 필요함. `CREATE EXTENSION vector WITH SCHEMA public` 실행 권한 또는 관리자의 사전 확장 생성 필요함.
- Compose DB는 `127.0.0.1`에만 노출함. named volume에 데이터 유지함.
- Compose는 pgvector 포함 PostgreSQL 이미지를 사용함. 별도 벡터 DB 서비스 불필요함.
- 앱 모듈 import는 DB 연결을 수행하지 않음. 실제 서비스 초기화는 FastAPI lifespan에서 수행함.

### 기존 데이터 이전

기존 서버를 중지하고 빈 PostgreSQL 스키마를 대상으로 **색인 전에** 실행 필요함:

```bash
uv run --frozen python -m backend.scripts.migrate_sqlite runtime/state.sqlite3
uv run --frozen python -m backend.scripts.index_data
```

- SQLite는 읽기 전용 연결·단일 읽기 스냅샷으로 처리함. 원본 파일 삭제·수정 없음.
- 대상 상태 테이블 또는 벡터 색인에 데이터가 존재하면 이전 거부함. 복사는 하나의 PostgreSQL 트랜잭션으로 처리함.
- 세션·대화·메시지·팀·작업·원문/HTTP 캐시 이전함. 메시지와 대화는 SQLite 삽입 순서 보존함.
- 이미 PostgreSQL 상태 저장을 사용 중이면 SQLite 이전을 다시 실행하지 않고 `index_data`만 실행함. 기존 캐시·원문에서 새 벡터 색인 구성 가능함.
- `manifest`·`query_complete` 캐시는 제외함. `index_data`가 기준 JSON과 이전한 `document` 원문 캐시로 pgvector 색인을 검증·재구축함.
- 이전된 원문은 번들 JSON 색인 전에 읽어 보존하고 번들 색인 후 재적용함.
- 앱 재시작 시 `queued`·`running` 작업은 기존 동작과 동일하게 `interrupted` 복구함.
- 이전 도구 재실행 시 데이터 덮어쓰기 없음. 새 `DATABASE_SCHEMA`를 지정한 별도 이전 필요함.


### 출처·라이선스

확인일: 2026-10-22 (Asia/Seoul)

- [Psycopg 공식 문서](https://www.psycopg.org/psycopg3/docs/): 연결·행 사전·트랜잭션·SQL 매개변수 참고함. 배포 패키지 라이선스 원문 유지함.
- [pgvector 공식 문서](https://github.com/pgvector/pgvector): PostgreSQL License. 벡터 타입·L2 거리·정확 검색·Docker 구성 참고함.
- [all-MiniLM-L6-v2 모델 카드](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): Apache-2.0 모델, 영어 중심·384차원임.
- [ONNX export 프로젝트](https://github.com/chroma-core/onnx-embedding): Apache-2.0 프로젝트. 기존 로컬 모델 캐시 재사용함. 배포 URL의 Chroma 명칭은 모델 호스팅 주소이며 ChromaDB 런타임 의존성과 구분함.

- 모델 신규 다운로드는 SHA-256 `913d7300ceae3b2dbc2c50d1de4baacab4be7b9380491c27fab7418616a16ec3` 검증 후 정규 파일 두 개만 추출함.
