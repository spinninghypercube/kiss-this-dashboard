#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="/var/lib/kiss-startpage"
OUT_DIR="./backups"

usage() {
  cat <<USAGE
Usage: $0 [--data-dir DIR] [--out-dir DIR]

Creates a timestamped tar.gz backup containing:
- dashboard-config.json
- users.json
- private-icons/ (if present)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --data-dir) DATA_DIR="${2:-}"; shift 2 ;;
    --out-dir) OUT_DIR="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$OUT_DIR/kiss-startpage-backup-${STAMP}.tar.gz"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

found=0
for file in dashboard-config.json users.json; do
  if [[ -f "$DATA_DIR/$file" ]]; then
    cp -a "$DATA_DIR/$file" "$TMP_DIR/$file"
    found=1
  fi
done

if [[ -d "$DATA_DIR/private-icons" ]]; then
  cp -a "$DATA_DIR/private-icons" "$TMP_DIR/private-icons"
  found=1
fi

if [[ "$found" -ne 1 ]]; then
  echo "No backup files found in $DATA_DIR" >&2
  exit 1
fi

cat > "$TMP_DIR/backup-meta.txt" <<META
Created: $(date -Is)
Source data dir: $DATA_DIR
Files:
$(ls -1 "$TMP_DIR")
META

tar -czf "$ARCHIVE" -C "$TMP_DIR" .

echo "Backup created: $ARCHIVE"
