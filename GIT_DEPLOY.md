# Git 배포 가이드

## 배포 명령어

다음 명령어를 순서대로 실행하세요:

```bash
cd /Users/hosung/Workspace/amansman77/gokkan-keeper

# 1. Git 초기화 (아직 안 했다면)
git init

# 2. 모든 파일 추가
git add .

# 3. 초기 커밋
git commit -m "Initial commit: Gokkan Keeper MVP

- Personal asset tracking service organized by purpose (granaries)
- Frontend: Vite + React + Tailwind CSS
- Backend: Cloudflare Workers + Hono + D1
- Features: Granary management, snapshot tracking, status summary"

# 4. 원격 저장소 추가
git remote add origin https://github.com/amansman77/gokkan-keeper.git

# 5. 기본 브랜치를 main으로 설정
git branch -M main

# 6. 원격 저장소에 푸시
git push -u origin main
```

## 주의사항

- `.gitignore`에 포함된 파일들은 자동으로 제외됩니다
- `.dev.vars`, `.env` 파일은 커밋되지 않습니다
- `node_modules`, `dist` 등도 제외됩니다

## 배포 후

Git 배포가 완료되면 Cloudflare Pages에서 Git 연동을 설정하세요:

1. Cloudflare Dashboard → Pages → Create a project
2. Connect to Git → `amansman77/gokkan-keeper` 선택
3. Build settings 설정 (자세한 내용은 `apps/web/CLOUDFLARE_PAGES_DEPLOY.md` 참고)

