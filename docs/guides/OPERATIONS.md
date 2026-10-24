# 자동 배포와 운영 관측

## 구성

| 시점·대상 | 처리 |
|---|---|
| `main` 대상 PR | 실제 PostgreSQL + pgvector 회귀·프론트 빌드·백엔드 이미지 빌드·모니터링 설정 검사 |
| `main` push·병합 | 동일 검증 → 결과물 전달 → 백엔드 준비 상태 확인 → 프론트 게시 → 공개 경로 확인 |
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
python3 bootstrap_github_oidc.py --repository unfl1/poketact
```

- GitHub `production` 환경만 신뢰하는 OIDC 역할 생성, 장기 AWS 액세스 키 미발급
- 권한: 해당 버킷 목록 조회·`index.html`/`assets/*` 업로드·해당 배포의 CloudFront 무효화 생성/조회
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
| `FRONTEND_BUCKET` | 기존 프론트 S3 버킷 |
| `CLOUDFRONT_DISTRIBUTION_ID` | 기존 배포 ID |
| `PRODUCTION_URL` | 실제 프론트 HTTPS URL |

- GitHub Secrets는 저장소 파일과 별개인 암호화 설정 저장소, 개인키 파일을 Git에 올리는 방식과 구분
- Actions는 준비된 환경값이 하나라도 없으면 실제 배포 전에 실패 처리
- SSH 호스트 키 검증 유지, 실행 중 `ssh-keyscan` 결과를 무조건 신뢰하는 방식 제외

## 배포 동작과 복구

- 전달 대상: Docker 이미지와 명시한 Compose·모니터링 설정만 포함한 압축 번들
- 서버 수신기는 파일 목록·중복·심볼릭 링크·크기·커밋 SHA 확인 후 적용
- 운영 환경변수는 서버 파일을 참조, 번들·Docker 빌드에 포함하지 않음
- 프로젝트 이름 `poketact` 유지로 기존 PostgreSQL·모델 볼륨 재사용
- `--no-deps`로 PostgreSQL 자동 재생성 제외, 자동 재색인·DB 삭제·스키마 변경·Nginx/방화벽 변경 미수행
- 새 API의 기동·준비 상태 실패 시 이전 API 이미지로 복구, 실패 실행은 Actions에서 실패로 표시
- 현재·이전 릴리스 설정 및 이미지 보관, 그보다 오래된 전용 릴리스 정리
- API 컨테이너 교체 중 짧은 중단 가능, 무중단 배포 보장 없음
- 백엔드 성공 후 프론트 해시 자산 업로드 → `index.html` 업로드 → CloudFront `/`·`/index.html` 무효화
- 기존 해시 자산 삭제 없음, 프론트 게시 중 실패 시 재실행 필요
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
- 모델 지표는 호출 시도 횟수이며 토큰 수·실제 청구액과 구분, 비용 강제 상한 기능 없음
- 기존 Nginx의 API 접근 로그 비활성화와 원본 인증 설정 유지
- `.gitignore`·`.dockerignore`·CI 공개 파일 검사 적용, 이미 추적한 비밀값의 제거·폐기는 별도 대응 필요

## 공식 출처

- [GitHub Actions 배포](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [AWS OIDC 연결](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [Grafana 데이터 소스](https://grafana.com/docs/grafana/latest/datasources/)
- [Loki 보존 설정](https://grafana.com/docs/loki/latest/operations/storage/retention/)
- [Alloy 파일 로그 수집](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.file/)

설정·이미지 버전 확인일: 2026-10-24, 외부 코드·이미지의 이용 조건은 각 원본 프로젝트 라이선스 적용
