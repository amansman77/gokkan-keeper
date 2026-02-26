#!/bin/bash

# Gokkan Keeper 로컬 개발 서버 시작 스크립트

set -e

echo "🚀 Gokkan Keeper 개발 서버 시작 중..."

# 1. Shared 패키지 빌드
echo "📦 Shared 패키지 빌드 중..."
cd packages/shared
pnpm build || npx tsc
cd ../..

# 2. 데이터베이스 마이그레이션 (로컬)
echo "🗄️  로컬 데이터베이스 마이그레이션 실행 중..."
cd apps/api
pnpm migrate:local || npx wrangler d1 migrations apply shared-db --local
cd ../..

# 3. 개발 서버 시작
echo "🌐 개발 서버 시작 중..."
echo "   - Frontend: http://localhost:5173"
echo "   - Backend: http://localhost:8787"
echo ""
echo "⚠️  두 터미널에서 각각 실행하세요:"
echo "   터미널 1: cd apps/api && pnpm dev"
echo "   터미널 2: cd apps/web && pnpm dev"
echo ""
echo "또는 한 터미널에서: pnpm dev"
