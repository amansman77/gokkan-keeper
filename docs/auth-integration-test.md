# Auth Integration Test (Local)

`/auth/*` 최소 통합 테스트를 로컬 서버 대상으로 검증합니다.

## 대상 엔드포인트
- `GET /health`
- `GET /auth/me`
- `POST /auth/google` (missing credential / invalid credential)
- `POST /auth/logout`
- `GET /granaries` (unauthorized guard)

## 실행
일반 Worker/D1 통합 테스트에서 이 스크립트도 격리 서버 대상으로 자동 실행합니다:

```bash
pnpm test:integration
```

직접 실행하려면 인증 설정이 갖춰진 로컬 API 서버가 실행 중인 상태에서:

```bash
pnpm --filter @gokkan-keeper/api run test:auth:integration
```

기본 대상은 `http://localhost:8787`이며, 다른 주소를 쓰려면:

```bash
BASE_URL=http://localhost:60603 pnpm --filter @gokkan-keeper/api run test:auth:integration
```

잘못된 credential은 반드시 `401`이어야 합니다. 환경 설정 누락 등의 `500`은 실패로 처리합니다.

## 보안 동작과 검사 범위

로그인은 Google JWKS로 RS256 서명, 발급자, 대상 클라이언트, 만료와
인증된 이메일을 검증합니다. `gk_session`은 7일 동안 유효하며 D1에
등록된 세션만 허용합니다. 로그아웃은 해당 세션을 삭제합니다. 소유자
허용 설정이 바뀌면 기존 세션도 거부합니다. 새 형식 배포 시 기존
쿠키는 한 번 재로그인이 필요합니다.

스크립트는 POST에 `Origin: $BASE_URL`을 보냅니다. 운영 API를 직접
검사할 때는 로컬용 출처가 허용되지 않으므로 이 로컬 스크립트를 사용하지
마세요. `pnpm test:integration`은 실제 Worker/D1에서 출처 위조·누락,
잘못된 Content-Type, 로그아웃 쿠키 재사용, 키 권한/만료, 동시 요청 제한,
서명된 프록시 IP와 대용량 스트림을 별도로 검증합니다. Google 키와
토큰은 실행 시 생성하는 테스트 전용 RSA/JWKS이며 운영 인증을 우회하지
않습니다. 실제 Google 서비스 가용성을 검증하는 테스트는 아닙니다.
