# Docker 백엔드 배포

구성: FastAPI·참조 계산기·로컬 ONNX 임베딩을 포함한 백엔드 이미지와 PostgreSQL + pgvector 컨테이너

## 서버 준비

- Ubuntu 서버와 Docker Engine·Compose 플러그인 필요
- 프로젝트 파일과 기준 데이터 전송, `.env`·SSH 키·로컬 DB·대화 기록·개인 문서는 소스 전송 대상에서 제외
- `.env.production.example`을 `.env.production`으로 복사 후 서버에서 비밀값 설정, 파일 권한 `600` 적용
- `POSTGRES_PASSWORD`는 서버별 고유 URL-safe 값 사용, `OPENAI_API_KEY`는 운영용 키 설정
- `ALLOWED_ORIGINS`는 실제 프론트엔드 주소로 설정, CORS를 인증이나 요청 제한으로 간주하지 않음
- 기존 DB 볼륨의 비밀번호는 환경변수 변경만으로 바뀌지 않으므로 별도 DB 계정 변경 절차 필요

## 최초 실행

```bash
sudo docker compose --env-file .env.production -f compose.production.yaml config --quiet
sudo docker compose --env-file .env.production -f compose.production.yaml build api
sudo docker compose --env-file .env.production -f compose.production.yaml up -d --wait postgres
sudo docker compose --env-file .env.production -f compose.production.yaml run --rm index
sudo docker compose --env-file .env.production -f compose.production.yaml run --rm index python -m backend.scripts.index_strategy
sudo docker compose --env-file .env.production -f compose.production.yaml up -d --wait api
curl --fail http://127.0.0.1:8000/api/status
```

- 첫 색인 시 체크섬 검증된 임베딩 파일 다운로드 및 벡터 생성, 전략 색인 시 PokéAPI 자료 요청 발생
- API는 단일 worker로 실행, PostgreSQL 준비 이후 시작
- 상태 검사는 색인·모델 설정 여부 확인용이며 실제 모델 호출 성공 보장과 구분
- PostgreSQL은 호스트 포트 미공개, FastAPI는 호스트 `127.0.0.1:8000`에만 바인딩
- 인터넷 공개 전 HTTPS 프록시·접근 통제·요청 제한·API 지출 한도 구성 필요
- S3·CloudFront와 HTTPS 프록시 구성은 [프론트엔드 배포](FRONTEND_DEPLOYMENT.md) 참고
- 개인 SSH 터널로 확인 시 `ssh -L 18000:127.0.0.1:8000 사용자@서버` 실행 후 로컬 `http://127.0.0.1:18000/docs` 접속

## 업데이트와 데이터 유지

```bash
sudo docker compose --env-file .env.production -f compose.production.yaml build api
sudo docker compose --env-file .env.production -f compose.production.yaml up -d --wait api
sudo docker compose --env-file .env.production -f compose.production.yaml ps
```

- `postgres_data`: 대화·팀·출처 캐시·벡터 색인 보존
- `runtime_data`: 다운로드한 임베딩 모델 보존
- 기준 데이터·청킹·임베딩 설정 변경 시 재색인 필요
- `down -v`는 DB 볼륨 삭제 명령이므로 운영 작업에서 사용 금지
- 로그는 컨테이너별 10MB × 3개로 순환, 실제 키·전체 환경변수·대화 원문 출력 금지
- `docker compose config`는 비밀값을 펼칠 수 있으므로 검증 시 `--quiet` 사용

## DB 백업

```bash
install -d -m 700 backups
umask 077
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_dump -U poketact -d poketact -Fc > backups/poketact.dump
```

- 백업 파일은 Git·이미지·공개 웹 경로 제외, 동일 서버의 백업만으로 장애 복구를 보장할 수 없으므로 별도 비공개 저장소와 복구 검증 필요
- 복원 시 대상 DB·버전·기존 데이터 영향 확인 후 `pg_restore` 적용

## 참고

- [Docker Ubuntu 설치](https://docs.docker.com/engine/install/ubuntu/)
- [Compose 준비 상태와 시작 순서](https://docs.docker.com/compose/how-tos/startup-order/)
- [Lightsail 방화벽](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html)
