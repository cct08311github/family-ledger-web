#!/usr/bin/env bash
set -euo pipefail

APP_NAME="family-ledger-web"
APP_DIR="/Users/openclaw/.openclaw/shared/projects/family-ledger-web"
BRANCH="main"

cd "$APP_DIR"

echo "==> [1/6] Fetch latest code"
git fetch origin

echo "==> [2/6] Reset to origin/$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> [3/6] Install dependencies"
npm install

echo "==> [4/6] Build production bundle"
npm run build

echo "==> [5/6] Restart PM2"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME"
else
  pm2 start ecosystem.config.js
fi

echo "==> [6/6] Save PM2 process list"
pm2 save

echo "\nDeployment complete."
echo "Local:  http://localhost:3000"
echo "Funnel: https://mac-mini.tailde842d.ts.net:8443/"
