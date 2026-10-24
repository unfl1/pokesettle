# 프론트엔드 배포

## 구성

- React·Vite 빌드 결과를 비공개 S3 버킷에 저장, CloudFront OAC로만 읽기 허용
- `www.example.com`을 CloudFront에 CNAME으로 연결, `us-east-1` ACM 인증서로 HTTPS 제공
- S3·CloudFront에서 정적 파일 제공 기능 담당, 프론트 전용 Docker·Nginx 불필요
- 선택 구성: CloudFront `/api`, `/api/*` → HTTPS Nginx → 호스트 `127.0.0.1:8000` FastAPI → 내부 PostgreSQL
- 프론트만 배포한 경우 API 조회·대화·팀 저장 사용 불가, 백엔드 공개 연결은 별도 단계

## 빌드와 최초 배포

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend run build
cd frontend/dist
zip -r /tmp/poketact-frontend.zip index.html assets
```

- ZIP에 `index.html`·`assets/`만 포함, `.env`·소스·서버 키 업로드 제외
- `VITE_*` 값은 브라우저에 공개되므로 API 키·DB 비밀번호 사용 금지
- 인증된 AWS CloudShell에 ZIP·아래 Python 파일·SPA 함수 업로드, `boto3` 사용

```bash
python3 provision_frontend.py --domain example.com --bundle poketact-frontend.zip
```

- 코드: `deployment/aws/provision_frontend.py`
- 생성 결과의 CloudFront 주소를 `www` CNAME으로 등록, ACM 검증 CNAME을 DNS에 등록
- `~/poketact-deployment.json`은 다음 실행에 필요한 리소스 식별자 보관용, 다른 계정·배포에 재사용 금지
- 배포 상태 JSON·원본 검증값·치환한 운영 Nginx 설정은 `.secrets/` 등 비공개 경로에 보관, Git에는 템플릿만 포함
- ACM 상태 `ISSUED` 확인 후 도메인·SPA 함수 연결

```bash
python3 connect_frontend.py --function spa-rewrite.js
```

- 코드: `deployment/aws/connect_frontend.py`, `deployment/cloudfront/spa-rewrite.js`
- SPA 경로만 `index.html`로 변환, API·정적 자산 오류를 HTML로 치환하지 않음
- `index.html` 재검증, 해시 자산 1년 캐시·immutable 적용
- 재배포 시 동일 상태 파일·버킷 사용, 빌드 업로드 후 CloudFront 무효화 필요

## 선택 구성: HTTPS API 연결

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
- 백엔드 공개 승인 이후 443번 개방 및 아래 연결 실행

```bash
python3 connect_frontend.py --function spa-rewrite.js --origin-token-file /private/path/origin-token
```

- API 캐시 비활성화, 쿠키·쿼리·요청 헤더 전달, Nginx 응답 `Cache-Control: no-store` 적용
- 세션 쿠키 Secure·HttpOnly·SameSite=Lax 적용, DB·8000번 직접 공개 제외
- 전체 쓰기 요청 분당 30회·순간 burst 5, 읽기 CloudFront 연결 IP별 초당 10회 적용
- 원본 검증값은 서버 직접 호출 제한용이며 서비스 이용자 인증과 구분
- 요청 제한은 AI 지출의 금액 상한을 보장하지 않음, 공개 운영 시 별도 사용량 관리 필요
- 루트 HTTP·HTTPS는 HTTPS `www`로 이동, 나머지 HTTP 호스트는 인증서 검증 경로 외 404 반환

## 참고

- [CloudFront S3 원본 접근 제어](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [CloudFront 대체 도메인 인증서](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html)
- [CloudFront 관리형 원본 요청 정책](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html)
- [Nginx 프록시 모듈](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
