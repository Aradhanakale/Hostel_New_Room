#!/usr/bin/env bash
# Hostel Room Exchange Platform — one-shot setup after a fresh pull
# Usage: ./setup.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================================"
echo "🚀 Hostel Room Exchange Platform - Automated Setup"
echo "========================================================"

# ── 1. Environment files ──────────────────────────────────────────────────────
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
    printf 'BACKEND_URL=http://localhost:4000\nNEXT_PUBLIC_API_URL=/api\nPORT=3000\n' > next-app/.env.local
  fi
fi

# ── 2. Dependencies ───────────────────────────────────────────────────────────
echo "📦 Installing root and workspace dependencies..."
npm install

# ── 3. Start Database ─────────────────────────────────────────────────────────
is_pg_ready() {
  local port=$1
  if command -v pg_isready > /dev/null 2>&1; then
    pg_isready -h 127.0.0.1 -p "$port" > /dev/null 2>&1
  else
    nc -z 127.0.0.1 "$port" > /dev/null 2>&1
  fi
}

echo "🐘 Starting PostgreSQL database..."

# If a local .pgdata cluster exists, ALWAYS use it on port 5433
# (avoids using a system Postgres on 5432 that lacks hostel_user)
USE_PGDATA=false
if [ -d "$DIR/.pgdata" ] && command -v pg_ctl > /dev/null 2>&1; then
  USE_PGDATA=true
fi

if [ "$USE_PGDATA" = true ]; then
  if ! is_pg_ready 5433; then
    echo "📦 Starting local PostgreSQL from .pgdata on port 5433..."
    pg_ctl -D "$DIR/.pgdata" -o "-p 5433" -l "$DIR/.pgdata/logfile" start 2>/dev/null || true
  fi
elif command -v docker > /dev/null 2>&1 && docker info > /dev/null 2>&1; then
  echo "🐳 Starting PostgreSQL via Docker Compose..."
  docker compose up -d postgres 2>/dev/null || docker-compose up -d postgres 2>/dev/null || true
fi

# Wait up to 20 seconds for the correct PostgreSQL to be ready
PG_PORT=""
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in $(seq 1 20); do
  if [ "$USE_PGDATA" = true ] && is_pg_ready 5433; then
    PG_PORT="5433"
    echo "✅ PostgreSQL is ready on port 5433."
    break
  elif [ "$USE_PGDATA" = false ] && is_pg_ready 5432; then
    PG_PORT="5432"
    echo "✅ PostgreSQL is ready on port 5432."
    break
  fi
  sleep 1
done

if [ -z "$PG_PORT" ]; then
  echo ""
  echo "❌  PostgreSQL is NOT responding on port 5432 or 5433 after 20 seconds."
  echo ""
  echo "   Please start PostgreSQL manually, then re-run ./setup.sh"
  echo "   Options:"
  echo "     • Docker:    docker compose up -d"
  echo "     • Local pg:  pg_ctl -D .pgdata -o '-p 5433' start"
  exit 1
fi

# ── 4. Patch DATABASE_URL in backend/.env to match the active port ────────────
if [ -f "backend/.env" ]; then
  CURRENT_PORT=$(grep -oE ':(5432|5433)/' backend/.env | tr -d ':/' | head -1 || true)
  if [ -n "$CURRENT_PORT" ] && [ "$CURRENT_PORT" != "$PG_PORT" ]; then
    echo "🔧 Updating backend/.env DATABASE_URL port: $CURRENT_PORT → $PG_PORT"
    sed -i '' "s/:${CURRENT_PORT}\//:${PG_PORT}\//g" backend/.env 2>/dev/null || \
      sed -i "s/:${CURRENT_PORT}\//:${PG_PORT}\//g" backend/.env
  fi
  # Ensure password is set (some .env copies may omit it)
  if grep -q 'hostel_user@' backend/.env 2>/dev/null; then
    echo "🔧 Ensuring hostel_user password is set in backend/.env..."
    sed -i '' 's|hostel_user@|hostel_user:hostel_password@|g' backend/.env 2>/dev/null || \
      sed -i 's|hostel_user@|hostel_user:hostel_password@|g' backend/.env
  fi
fi

# ── 5. Prisma ─────────────────────────────────────────────────────────────────
echo "🔄 Generating Prisma Client..."
npx --workspace=backend prisma generate

echo "🔄 Syncing database schema..."
if [ -d "backend/prisma/migrations" ] && ls backend/prisma/migrations/*.sql 2>/dev/null | head -1 > /dev/null; then
  npx --workspace=backend prisma migrate deploy 2>/dev/null || npx --workspace=backend prisma db push
else
  npx --workspace=backend prisma db push
fi

echo "🌱 Seeding initial demo data..."
npm run seed --workspace=backend

# ── 6. Build ──────────────────────────────────────────────────────────────────
echo "🏗️  Building backend..."
npm run build --workspace=backend

echo "🏗️  Building next-app..."
npm run build --workspace=next-app

echo "========================================================"
echo "🎉 Setup complete! Start the full stack with:"
echo "   npm run dev:all"
echo "========================================================"
