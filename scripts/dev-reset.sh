#!/bin/sh
# Зупиняє завислі next dev/start і звільняє порти 3000–3012
set -e
cd "$(dirname "$0")/.."

echo "Зупиняю старі процеси Next.js..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

for port in 3000 3001 3002 3003 3010 3011 3012; do
  pid=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "  порт $port → kill $pid"
    kill -9 $pid 2>/dev/null || true
  fi
done

echo "Очищаю кеш .next..."
rm -rf .next

echo "Запускаю dev на http://localhost:3000 ..."
exec npx next dev
