#!/usr/bin/env bash
# scripts/start-pm2.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f ".env" ]; then
  echo "[pm2] File .env mancante. Copia .env.example e configurarlo prima di avviare."
  exit 1
fi

pm2 delete whatsapp-pt-bot >/dev/null 2>&1 || true
pm2 start src/index.js \
  --name whatsapp-pt-bot \
  --node-args="--max-old-space-size=512" \
  --time

pm2 save
pm2 startup

echo "[pm2] Bot avviato. Usa: pm2 logs whatsapp-pt-bot"
