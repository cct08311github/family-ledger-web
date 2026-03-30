#!/usr/bin/env bash
set -euo pipefail

APP_URL_LOCAL="http://localhost:3000"
APP_URL_FUNNEL="https://mac-mini.tailde842d.ts.net:8443/"
APP_NAME="family-ledger-web"

echo "==> PM2"
pm2 list | grep "$APP_NAME" || true

echo "\n==> Local health"
curl -I -s "$APP_URL_LOCAL" | head -5

echo "\n==> Funnel health"
curl -k -I -s "$APP_URL_FUNNEL" | head -5
