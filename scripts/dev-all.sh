#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "🧹 Checking and freeing ports 4000 and 3000 if occupied..."
for port in 4000 3000; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping existing process on port $port (PID: $pids)..."
    kill -9 $pids 2>/dev/null || true
  fi
done
sleep 1

# Start and verify database
bash scripts/start-db.sh

echo "🚀 Starting Backend (port 4000) and Next.js (port 3000)..."
npx concurrently -k -n API,NEXT -c blue,magenta "npm run dev:backend" "npm run dev:next"
