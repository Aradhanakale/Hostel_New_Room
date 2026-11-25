#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "🔍 Checking PostgreSQL status..."

is_pg_ready() {
  local port=$1
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h 127.0.0.1 -p "$port" >/dev/null 2>&1
  else
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
  fi
}

# 1. If already running on 5432 or 5433, we are done
if is_pg_ready 5432; then
  echo "✅ PostgreSQL is ready on port 5432."
  exit 0
fi

if is_pg_ready 5433; then
  echo "✅ PostgreSQL is ready on port 5433."
  exit 0
fi

# 2. Try Docker Compose if docker daemon is running
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "🐳 Starting PostgreSQL via Docker Compose..."
  docker compose up -d postgres 2>/dev/null || docker-compose up -d postgres 2>/dev/null
fi

# 3. If local .pgdata folder exists and pg_ctl is available, start local postgres
if [ -d "$DIR/.pgdata" ] && command -v pg_ctl >/dev/null 2>&1; then
  echo "📦 Starting local PostgreSQL from .pgdata on port 5433..."
  pg_ctl -D "$DIR/.pgdata" -o "-p 5433" -l "$DIR/.pgdata/logfile" start 2>/dev/null || true
fi

# 4. Wait for readiness
for i in {1..15}; do
  if is_pg_ready 5432; then
    echo "✅ PostgreSQL is ready on port 5432."
    exit 0
  fi
  if is_pg_ready 5433; then
    echo "✅ PostgreSQL is ready on port 5433."
    exit 0
  fi
  sleep 1
done

echo "⚠️ PostgreSQL could not be confirmed automatically on port 5432 or 5433."
echo "If the backend fails to connect, please run 'docker compose up -d' or start PostgreSQL manually."
