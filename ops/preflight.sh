#!/usr/bin/env bash
set -euo pipefail

PORT=8788
CHECK_SYSTEMD=1
CHECK_JQ=1

usage() {
  cat <<USAGE
Usage: $0 [--port PORT] [--skip-systemd] [--skip-jq]

Checks host prerequisites for a local/systemd deployment (Go backend + Svelte frontend build).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --skip-systemd)
      CHECK_SYSTEMD=0
      shift
      ;;
    --skip-jq)
      CHECK_JQ=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

fail=0

check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "[OK] command found: $cmd"
  else
    echo "[FAIL] missing command: $cmd" >&2
    fail=1
  fi
}

check_cmd go
check_cmd node
check_cmd npm
check_cmd curl
if [[ "$CHECK_JQ" -eq 1 ]]; then
  check_cmd jq
fi

if command -v go >/dev/null 2>&1; then
  echo "[OK] $(go version)"
fi
if command -v node >/dev/null 2>&1; then
  echo "[OK] node $(node --version)"
fi
if command -v npm >/dev/null 2>&1; then
  echo "[OK] npm $(npm --version)"
fi

if [[ "$CHECK_SYSTEMD" -eq 1 ]]; then
  if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    echo "[OK] systemd detected"
  else
    echo "[FAIL] systemd not detected (run with --skip-systemd if you are only building files)" >&2
    fail=1
  fi
fi

if [[ "$PORT" =~ ^[0-9]+$ ]]; then
  if command -v ss >/dev/null 2>&1; then
    if ss -ltn | awk '{print $4}' | grep -Eq "(^|:)${PORT}$"; then
      echo "[WARN] Port ${PORT} appears to be in use"
    else
      echo "[OK] Port ${PORT} appears available"
    fi
  else
    echo "[WARN] 'ss' not found; skipping port availability check"
  fi
else
  echo "[FAIL] Invalid port: ${PORT}" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Preflight checks failed." >&2
  exit 1
fi

echo "Preflight checks passed."
