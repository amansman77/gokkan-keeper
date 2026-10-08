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
