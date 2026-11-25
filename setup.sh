#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================================"
echo "🚀 Hostel Room Exchange Platform - Automated Setup"
echo "========================================================"

# 1. Environment files
if [ ! -f "backend/.env" ]; then
  if [ -f "backend/.env.example" ]; then
    echo "📝 Creating backend/.env from backend/.env.example..."
    cp backend/.env.example backend/.env
  fi
fi

if [ ! -f "next-app/.env.local" ]; then
  if [ -f "next-app/.env.example" ]; then
    echo "📝 Creating next-app/.env.local from next-app/.env.example..."
    cp next-app/.env.example next-app/.env.local
  else
    echo "📝 Creating next-app/.env.local..."
    echo "BACKEND_URL=http://localhost:4000" > next-app/.env.local
    echo "NEXT_PUBLIC_API_URL=/api" >> next-app/.env.local
    echo "PORT=3000" >> next-app/.env.local
  fi
fi

# 2. Dependencies
echo "📦 Installing root and workspace dependencies..."
npm install

# 3. Start Database
echo "🐘 Starting PostgreSQL database..."
bash scripts/start-db.sh

is_pg_ready() {
  local port=$1
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h 127.0.0.1 -p "$port" >/dev/null 2>&1
  else
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
  fi
}

PG_PORT=""
if is_pg_ready 5432; then
  PG_PORT="5432"
elif is_pg_ready 5433; then
  PG_PORT="5433"
fi

if [ "$PG_PORT" = "5433" ] && grep -q "5432" backend/.env 2>/dev/null; then
  echo "🔧 Updating backend/.env to use active local PostgreSQL port 5433..."
  sed -i '' 's/:5432/:5433/g' backend/.env 2>/dev/null || sed -i 's/:5432/:5433/g' backend/.env
fi

# 4. Prisma client, schema sync, seed
echo "🔄 Generating Prisma Client..."
npx --workspace=backend prisma generate

echo "🔄 Syncing database schema..."
if [ -d "backend/prisma/migrations" ]; then
  npx --workspace=backend prisma migrate deploy 2>/dev/null || npx --workspace=backend prisma db push
else
  npx --workspace=backend prisma db push
fi

echo "🌱 Seeding initial demo data..."
npm run seed --workspace=backend

# 5. Build workspaces to ensure zero errors
echo "🏗️ Building backend and next-app..."
npm run build --workspace=backend
npm run build --workspace=next-app

echo "========================================================"
echo "🎉 Setup complete! You can now start the entire stack with:"
echo "   npm run dev:all"
echo "========================================================"
