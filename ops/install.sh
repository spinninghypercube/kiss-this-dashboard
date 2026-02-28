#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/kiss-startpage"
DATA_DIR="/var/lib/kiss-startpage"
SERVICE_NAME="kiss-startpage-api"
SERVICE_USER="kiss-startpage"
SERVICE_GROUP="kiss-startpage"
BIND_ADDR="0.0.0.0"
PORT="8788"
ENABLE_SERVICE=1
RUN_PREFLIGHT=1

usage() {
  cat <<USAGE
Usage: sudo $0 [options]

Options:
  --install-dir DIR      Install root (default: /opt/kiss-startpage)
  --data-dir DIR         Persistent data dir (default: /var/lib/kiss-startpage)
  --service-name NAME    systemd service name (default: kiss-startpage-api)
  --user USER            Service user (default: kiss-startpage)
  --group GROUP          Service group (default: kiss-startpage)
  --bind ADDR            Bind address (default: 0.0.0.0)
  --port PORT            Port (default: 8788)
  --no-enable            Do not enable/start the service
  --skip-preflight       Skip ops/preflight.sh
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --data-dir) DATA_DIR="${2:-}"; shift 2 ;;
    --service-name) SERVICE_NAME="${2:-}"; shift 2 ;;
    --user) SERVICE_USER="${2:-}"; shift 2 ;;
    --group) SERVICE_GROUP="${2:-}"; shift 2 ;;
    --bind) BIND_ADDR="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --no-enable) ENABLE_SERVICE=0; shift ;;
    --skip-preflight) RUN_PREFLIGHT=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if [[ "$RUN_PREFLIGHT" -eq 1 ]]; then
  bash "$ROOT_DIR/ops/preflight.sh" --port "$PORT"
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Invalid port: $PORT" >&2
  exit 1
fi

CURRENT_DIR="${INSTALL_DIR%/}/current"
PRIVATE_ICONS_DIR="${DATA_DIR%/}/private-icons"
ENV_FILE="/etc/default/${SERVICE_NAME}"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

for cmd in go node npm curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

mkdir -p "$INSTALL_DIR" "$CURRENT_DIR" "$DATA_DIR" "$PRIVATE_ICONS_DIR"

if ! getent group "$SERVICE_GROUP" >/dev/null; then
  groupadd --system "$SERVICE_GROUP"
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --gid "$SERVICE_GROUP" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude 'frontend-svelte/node_modules' \
    --exclude 'frontend-svelte/dist' \
    --exclude 'frontend-svelte/.svelte-kit' \
    --exclude 'backend-go/kissdash-go' \
    --exclude 'backend/__pycache__' \
    --exclude '__pycache__' \
    "$ROOT_DIR/" "$CURRENT_DIR/"
else
  echo "[WARN] rsync not found; using cp -a (stale files may remain on upgrades)"
  cp -a "$ROOT_DIR/." "$CURRENT_DIR/"
  rm -rf \
    "$CURRENT_DIR/.git" \
    "$CURRENT_DIR/backend/__pycache__" \
    "$CURRENT_DIR/frontend-svelte/node_modules" \
    "$CURRENT_DIR/frontend-svelte/dist" \
    "$CURRENT_DIR/frontend-svelte/.svelte-kit" \
    "$CURRENT_DIR/backend-go/kissdash-go" || true
fi

if [[ ! -f "$CURRENT_DIR/frontend-svelte/package.json" ]]; then
  echo "Missing frontend-svelte/package.json in install source." >&2
  exit 1
fi
if [[ ! -f "$CURRENT_DIR/backend-go/main.go" ]]; then
  echo "Missing backend-go/main.go in install source." >&2
  exit 1
fi

echo "[1/3] Building frontend (Svelte/Vite)"
(
  cd "$CURRENT_DIR/frontend-svelte"
  npm ci
  npm run build
  rm -rf node_modules
)

echo "[2/3] Building backend (Go)"
(
  cd "$CURRENT_DIR/backend-go"
  go build -buildvcs=false -o kissdash-go .
  chmod 755 kissdash-go
)

echo "[3/3] Applying ownership and runtime permissions"

chown -R root:root "$CURRENT_DIR"
chmod -R a+rX "$CURRENT_DIR"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DATA_DIR"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$PRIVATE_ICONS_DIR"
chmod 750 "$DATA_DIR"
chmod 750 "$PRIVATE_ICONS_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<ENV
# KISS Startpage runtime settings
DASH_BIND=${BIND_ADDR}
DASH_PORT=${PORT}
DASH_DATA_DIR=${DATA_DIR}
DASH_PRIVATE_ICONS_DIR=${PRIVATE_ICONS_DIR}
DASH_DEFAULT_CONFIG=${CURRENT_DIR}/startpage-default-config.json
DASH_APP_ROOT=${CURRENT_DIR}/frontend-svelte/dist
# DASH_SESSION_TTL=43200
# DASH_ICON_INDEX_TTL=21600
# DASH_ICON_SEARCH_MAX_LIMIT=30
ENV
  chmod 640 "$ENV_FILE"
fi

cat > "$UNIT_FILE" <<UNIT
[Unit]
Description=KISS Startpage API
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${CURRENT_DIR}
EnvironmentFile=-${ENV_FILE}
Environment=DASH_DEFAULT_CONFIG=${CURRENT_DIR}/startpage-default-config.json
Environment=DASH_APP_ROOT=${CURRENT_DIR}/frontend-svelte/dist
Environment=DASH_PRIVATE_ICONS_DIR=${PRIVATE_ICONS_DIR}
ExecStart=${CURRENT_DIR}/backend-go/kissdash-go
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
if [[ "$ENABLE_SERVICE" -eq 1 ]]; then
  systemctl enable --now "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  if command -v curl >/dev/null 2>&1; then
    HEALTH_URL="http://127.0.0.1:${PORT}/health"
    for _ in $(seq 1 15); do
      if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  fi
fi

echo
if [[ "$ENABLE_SERVICE" -eq 1 ]]; then
  echo "Installed and started: ${SERVICE_NAME}"
else
  echo "Installed service unit: ${SERVICE_NAME} (not started)"
fi
echo "App dir: ${CURRENT_DIR}"
echo "Data dir: ${DATA_DIR}"
echo "Private icons dir: ${PRIVATE_ICONS_DIR}"
echo "Open: http://${BIND_ADDR}:${PORT}/ and /edit"
echo "First visit /edit: create the first admin account"
