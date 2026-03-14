#!/usr/bin/env bash
# scripts/setup.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR"
echo "[setup] Aggiorno pacchetti..."
sudo apt-get update
sudo apt-get install -y curl git build-essential python3 make g++

echo "[setup] Installo Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "[setup] Installo PM2 globalmente..."
sudo npm install -g pm2

echo "[setup] Installo dipendenze progetto..."
npm install

echo "[setup] Completa il file .env copiando .env.example"
cp -n .env.example .env || true

echo "[setup] Fine. Ora modifica .env e poi esegui: ./scripts/start-pm2.sh"
