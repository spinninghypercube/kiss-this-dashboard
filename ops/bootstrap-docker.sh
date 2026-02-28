#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/spinninghypercube/kiss-startpage.git"
BRANCH="main"
PORT="8788"
INSTALL_DIR=""
SUPPORTED_DOCKER_DISTRO_HINT="Debian/Ubuntu, RHEL/Fedora, Arch, Alpine, or SUSE Linux families"

usage() {
  cat <<USAGE
One Shot Install (Docker Compose)

Usage: curl -fsSL <this script> | bash [-s -- [options]]

Options:
  --port PORT           Host port to expose (default: 8788)
  --dir DIR             Clone/install directory (default: /opt/kiss-startpage-docker if root, otherwise ~/kiss-startpage-docker)
  --branch NAME         Git branch or tag to install (default: main)
  --repo URL            Git repo URL (default: upstream GitHub repo)
  -h, --help            Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="${2:-}"; shift 2 ;;
    --dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --repo) REPO_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$INSTALL_DIR" ]]; then
  if [[ "${EUID}" -eq 0 ]]; then
    INSTALL_DIR="/opt/kiss-startpage-docker"
  else
    INSTALL_DIR="${HOME}/kiss-startpage-docker"
  fi
fi

require_supported_docker_platform() {
  local os_name os_id os_like family
  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "Unsupported OS: $(uname -s)." >&2
    echo "This Docker one-shot installer supports Linux hosts only." >&2
    exit 1
  fi

  if [[ ! -r /etc/os-release ]]; then
    echo "Unsupported Linux distribution: /etc/os-release is missing." >&2
    echo "Supported distro families: ${SUPPORTED_DOCKER_DISTRO_HINT}." >&2
    exit 1
  fi

  # shellcheck disable=SC1091
  . /etc/os-release
  os_name="${PRETTY_NAME:-${NAME:-unknown}}"
  os_id="${ID:-unknown}"
  os_like="${ID_LIKE:-}"
  family=" ${os_id} ${os_like} "

  if [[ "$family" != *" debian "* && "$family" != *" ubuntu "* && \
        "$family" != *" rhel "* && "$family" != *" fedora "* && \
        "$family" != *" centos "* && "$family" != *" rocky "* && \
        "$family" != *" almalinux "* && "$family" != *" arch "* && \
        "$family" != *" alpine "* && "$family" != *" suse "* && \
        "$family" != *" opensuse "* ]]; then
    echo "Unsupported Linux distribution: ${os_name} (ID=${os_id}, ID_LIKE=${os_like:-<empty>})." >&2
    echo "Supported distro families: ${SUPPORTED_DOCKER_DISTRO_HINT}." >&2
    exit 1
  fi

  echo "[bootstrap-docker] Detected distro: ${os_name} (ID=${os_id}, ID_LIKE=${os_like:-<empty>})"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_supported_docker_platform
require_cmd git
require_cmd docker

DOCKER_PREFIX=()
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    DOCKER_PREFIX=(sudo)
  else
    echo "Docker daemon is not reachable for the current user." >&2
    echo "Run as a user in the docker group, or rerun with sudo." >&2
    exit 1
  fi
fi

if "${DOCKER_PREFIX[@]}" docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=("${DOCKER_PREFIX[@]}" docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=("${DOCKER_PREFIX[@]}" docker-compose)
else
  echo "Docker Compose is required (docker compose plugin or docker-compose)." >&2
  exit 1
fi

if [[ -e "$INSTALL_DIR" && ! -d "$INSTALL_DIR/.git" ]]; then
  echo "Target path exists and is not a git checkout: $INSTALL_DIR" >&2
  exit 1
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "[bootstrap-docker] Reusing existing checkout: $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --tags origin
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  echo "[bootstrap-docker] Cloning ${REPO_URL} (${BRANCH}) to $INSTALL_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

ENV_FILE="$INSTALL_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^KISS_PORT=' "$ENV_FILE"; then
    sed -i "s/^KISS_PORT=.*/KISS_PORT=${PORT}/" "$ENV_FILE"
  else
    printf '\nKISS_PORT=%s\n' "$PORT" >> "$ENV_FILE"
  fi
else
  printf 'KISS_PORT=%s\n' "$PORT" > "$ENV_FILE"
fi

echo "[bootstrap-docker] Starting container build and app"
(
  cd "$INSTALL_DIR"
  "${COMPOSE_CMD[@]}" up -d --build
)

if command -v curl >/dev/null 2>&1; then
  echo "[bootstrap-docker] Waiting for health endpoint"
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

host_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
host_ip="${host_ip:-127.0.0.1}"
echo
echo "One Shot Install (Docker) complete."
echo "Open:  http://${host_ip}:${PORT}/"
echo "Edit:  http://${host_ip}:${PORT}/edit"
echo "App dir: $INSTALL_DIR"
