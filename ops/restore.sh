#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE=""
DATA_DIR="/var/lib/kiss-this-dashboard"
RESTART_SERVICE=0
SERVICE_NAME="kiss-this-dashboard-api"

usage() {
  cat <<USAGE
Usage: $0 --backup FILE [--data-dir DIR] [--restart-service] [--service-name NAME]

Restores dashboard-config.json, users.json, and private-icons/ from a backup archive.
Existing files are backed up in-place before restore.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) BACKUP_FILE="${2:-}"; shift 2 ;;
    --data-dir) DATA_DIR="${2:-}"; shift 2 ;;
    --restart-service) RESTART_SERVICE=1; shift ;;
    --service-name) SERVICE_NAME="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$BACKUP_FILE" ]]; then
  echo "--backup is required" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

mkdir -p "$DATA_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

tar -xzf "$BACKUP_FILE" -C "$TMP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
for file in dashboard-config.json users.json; do
  if [[ -f "$TMP_DIR/$file" ]]; then
    if [[ -f "$DATA_DIR/$file" ]]; then
      cp -a "$DATA_DIR/$file" "$DATA_DIR/${file}.pre-restore-${STAMP}.bak"
    fi
    cp -a "$TMP_DIR/$file" "$DATA_DIR/$file"
    echo "Restored: $DATA_DIR/$file"
  fi
done

if [[ -d "$TMP_DIR/private-icons" ]]; then
  if [[ -d "$DATA_DIR/private-icons" ]]; then
    cp -a "$DATA_DIR/private-icons" "$DATA_DIR/private-icons.pre-restore-${STAMP}.bak"
    rm -rf "$DATA_DIR/private-icons"
  fi
  cp -a "$TMP_DIR/private-icons" "$DATA_DIR/private-icons"
  echo "Restored: $DATA_DIR/private-icons"
fi

if [[ "$RESTART_SERVICE" -eq 1 ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    systemctl restart "$SERVICE_NAME"
    echo "Restarted service: $SERVICE_NAME"
  else
    echo "systemctl not found; skipped restart" >&2
  fi
fi
