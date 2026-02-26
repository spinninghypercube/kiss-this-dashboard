#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:8788"
USERNAME="smokeadmin"
PASSWORD="smoketest123"

usage() {
  cat <<USAGE
Usage: $0 [--base-url URL] [--username USER] [--password PASS]

Performs a basic smoke test:
- /health
- /
- /edit
- login
- auth status
- /api/config
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --username) USERNAME="${2:-}"; shift 2 ;;
    --password) PASSWORD="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

BASE_URL="${BASE_URL%/}"
COOKIE_JAR="$(mktemp)"
LOGIN_BODY="$(mktemp)"
BOOTSTRAP_BODY="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$LOGIN_BODY" "$BOOTSTRAP_BODY"' EXIT

wait_for_health() {
  local attempts="${1:-20}"
  local delay="${2:-1}"
  local i
  for i in $(seq 1 "$attempts"); do
    if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

echo "[1/6] Health check"
wait_for_health 20 1 || { echo "Service did not become healthy in time" >&2; exit 1; }
HEALTH_JSON="$(curl -fsS "$BASE_URL/health")"
echo "$HEALTH_JSON" | grep -q '"ok"' || { echo "Health check failed" >&2; exit 1; }

echo "[2/6] Dashboard page"
curl -fsS "$BASE_URL/" >/dev/null

echo "[3/6] Admin page"
curl -fsS "$BASE_URL/edit" >/dev/null

echo "[4/6] Login"
AUTH_PAYLOAD="$(
  if command -v jq >/dev/null 2>&1; then
    jq -nc --arg username "$USERNAME" --arg password "$PASSWORD" '{username:$username,password:$password}'
  elif command -v python3 >/dev/null 2>&1; then
    USERNAME="$USERNAME" PASSWORD="$PASSWORD" \
      python3 - <<'PY'
import json
import os

print(json.dumps({
    "username": os.environ.get("USERNAME", ""),
    "password": os.environ.get("PASSWORD", ""),
}))
PY
  else
    echo "jq or python3 is required for smoke-test JSON payload generation" >&2
    exit 1
  fi
)"
LOGIN_HTTP="$(curl -sS -o "$LOGIN_BODY" -w '%{http_code}' -c "$COOKIE_JAR" -H 'Content-Type: application/json' -d "$AUTH_PAYLOAD" "$BASE_URL/api/login")"
LOGIN_JSON="$(cat "$LOGIN_BODY")"

if [[ "$LOGIN_HTTP" == "409" ]] && echo "$LOGIN_JSON" | jq -e '.setupRequired == true' >/dev/null 2>&1; then
  echo "[4/6] First-time setup required -> creating initial admin account"
  BOOTSTRAP_HTTP="$(curl -sS -o "$BOOTSTRAP_BODY" -w '%{http_code}' -c "$COOKIE_JAR" -H 'Content-Type: application/json' -d "$AUTH_PAYLOAD" "$BASE_URL/api/auth/bootstrap")"
  if [[ "$BOOTSTRAP_HTTP" != "200" ]]; then
    echo "Bootstrap failed (HTTP $BOOTSTRAP_HTTP)" >&2
    cat "$BOOTSTRAP_BODY" >&2
    exit 1
  fi
  LOGIN_JSON="$(cat "$BOOTSTRAP_BODY")"
elif [[ "$LOGIN_HTTP" != "200" ]]; then
  echo "Login failed (HTTP $LOGIN_HTTP)" >&2
  echo "$LOGIN_JSON" >&2
  exit 1
fi

echo "[5/6] Auth status"
STATUS_JSON="$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/auth/status")"

echo "[6/6] Config read"
CONFIG_JSON="$(curl -fsS "$BASE_URL/api/config")"

echo "$STATUS_JSON" | grep -q '"authenticated": true' || { echo "Auth status failed" >&2; exit 1; }
echo "$CONFIG_JSON" | grep -q '"config"' || { echo "Config payload missing" >&2; exit 1; }

if echo "$LOGIN_JSON" | grep -q '"mustChangePassword": true'; then
  echo "[INFO] This install still requires a password change before editor writes are allowed."
fi

echo "Smoke test passed."
