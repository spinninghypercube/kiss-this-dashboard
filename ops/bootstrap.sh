#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/spinninghypercube/kiss-startpage.git"
BRANCH="main"
PORT="8788"
BIND_ADDR="0.0.0.0"
INSTALL_DIR="/opt/kiss-startpage"
DATA_DIR="/var/lib/kiss-startpage"
GO_MIN_VERSION="1.24.0"
NODE_MIN_MAJOR="18"
NODE_FALLBACK_MAJOR="20"
SUPPORTED_DISTRO_HINT="Debian/Ubuntu family (ID or ID_LIKE includes debian/ubuntu) with apt-get"

usage() {
  cat <<USAGE
One Shot Install (Debian/Ubuntu, systemd)

Usage: curl -fsSL <this script> | sudo bash [-s -- [options]]

Options:
  --port PORT             App port (default: 8788)
  --bind ADDR             App bind address (default: 0.0.0.0; use 127.0.0.1 for same-host reverse proxy)
  --install-dir DIR       Install root for app files (default: /opt/kiss-startpage)
  --data-dir DIR          Persistent data dir (default: /var/lib/kiss-startpage)
  --branch NAME           Git branch or tag to install (default: main)
  --repo URL              Git repo URL (default: upstream GitHub repo)
  -h, --help              Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="${2:-}"; shift 2 ;;
    --bind) BIND_ADDR="${2:-}"; shift 2 ;;
    --install-dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --data-dir) DATA_DIR="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --repo) REPO_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

require_supported_distro() {
  local os_name os_id os_like family
  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "Unsupported OS: $(uname -s)." >&2
    echo "Supported distro: ${SUPPORTED_DISTRO_HINT}." >&2
    exit 1
  fi

  if [[ ! -r /etc/os-release ]]; then
    echo "Unsupported Linux distribution: /etc/os-release is missing." >&2
    echo "Supported distro: ${SUPPORTED_DISTRO_HINT}." >&2
    exit 1
  fi

  # shellcheck disable=SC1091
  . /etc/os-release
  os_name="${PRETTY_NAME:-${NAME:-unknown}}"
  os_id="${ID:-unknown}"
  os_like="${ID_LIKE:-}"
  family=" ${os_id} ${os_like} "

  if [[ "$family" != *" debian "* && "$family" != *" ubuntu "* ]]; then
    echo "Unsupported Linux distribution: ${os_name} (ID=${os_id}, ID_LIKE=${os_like:-<empty>})." >&2
    echo "Supported distro: ${SUPPORTED_DISTRO_HINT}." >&2
    exit 1
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Unsupported package manager on ${os_name}: apt-get not found." >&2
    echo "Supported distro: ${SUPPORTED_DISTRO_HINT}." >&2
    exit 1
  fi

  echo "[bootstrap] Detected distro: ${os_name} (ID=${os_id}, ID_LIKE=${os_like:-<empty>})"
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (for example: curl ... | sudo bash)" >&2
  exit 1
fi

require_supported_distro

version_ge() {
  local have="$1"
  local want="$2"
  [[ "$(printf '%s\n%s\n' "$want" "$have" | sort -V | head -1)" == "$want" ]]
}

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node --version | sed 's/^v//' | cut -d. -f1
}

go_version() {
  if ! command -v go >/dev/null 2>&1; then
    echo "0.0.0"
    return
  fi
  go version | awk '{print $3}' | sed 's/^go//'
}

install_node_if_needed() {
  local major
  major="$(node_major)"
  if [[ "$major" =~ ^[0-9]+$ ]] && (( major >= NODE_MIN_MAJOR )); then
    return
  fi
  echo "[bootstrap] Installing Node.js ${NODE_FALLBACK_MAJOR}.x (required for frontend build)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_FALLBACK_MAJOR}.x" | bash -
  apt-get install -y nodejs
}

install_go_if_needed() {
  local have
  have="$(go_version)"
  if version_ge "$have" "$GO_MIN_VERSION"; then
    return
  fi

  local arch go_arch go_tag tarball_url tmpdir
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) go_arch="amd64" ;;
    aarch64|arm64) go_arch="arm64" ;;
    *)
      echo "Unsupported architecture for automatic Go install: $arch" >&2
      echo "Install Go ${GO_MIN_VERSION}+ manually, then rerun." >&2
      exit 1
      ;;
  esac

  go_tag="$(curl -fsSL https://go.dev/VERSION?m=text | head -1)"
  if [[ -z "$go_tag" || "${go_tag#go}" == "$go_tag" ]]; then
    echo "Failed to detect latest Go version from go.dev" >&2
    exit 1
  fi
  echo "[bootstrap] Installing ${go_tag} from go.dev (required Go >= ${GO_MIN_VERSION})"
  tarball_url="https://go.dev/dl/${go_tag}.linux-${go_arch}.tar.gz"
  tmpdir="$(mktemp -d)"
  curl -fsSL "$tarball_url" -o "$tmpdir/go.tgz"
  rm -rf /usr/local/go
  tar -C /usr/local -xzf "$tmpdir/go.tgz"
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
  rm -rf "$tmpdir"
  export PATH="/usr/local/go/bin:$PATH"
}

print_urls() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  ip="${ip:-127.0.0.1}"
  echo
  echo "One Shot Install complete."
  if [[ "$BIND_ADDR" == "127.0.0.1" || "$BIND_ADDR" == "::1" || "$BIND_ADDR" == "localhost" ]]; then
    echo "Backend bind: ${BIND_ADDR} (local-only)"
    echo "Open via your reverse proxy URL."
    echo "Local app:  http://127.0.0.1:${PORT}/"
    echo "Local edit: http://127.0.0.1:${PORT}/edit"
  else
    echo "Open:  http://${ip}:${PORT}/"
    echo "Edit:  http://${ip}:${PORT}/edit"
  fi
}

apply_bind_override_if_needed() {
  local env_file="/etc/default/kiss-startpage-api"
  if [[ ! -f "$env_file" ]]; then
    return
  fi
  if grep -q '^DASH_BIND=' "$env_file"; then
    sed -i "s|^DASH_BIND=.*|DASH_BIND=${BIND_ADDR}|" "$env_file"
  else
    printf '\nDASH_BIND=%s\n' "$BIND_ADDR" >> "$env_file"
  fi
  if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    systemctl restart kiss-startpage-api || true
  fi
}

export DEBIAN_FRONTEND=noninteractive
echo "[bootstrap] Installing base dependencies (git/curl/rsync/jq/go/node/npm)"
apt-get update
apt-get install -y ca-certificates curl git rsync jq golang-go nodejs npm

install_node_if_needed
install_go_if_needed

echo "[bootstrap] Go version: $(go version)"
echo "[bootstrap] Node version: $(node --version)"
echo "[bootstrap] npm version: $(npm --version)"
echo "[bootstrap] Bind address: ${BIND_ADDR}"

tmp_root="$(mktemp -d)"
trap 'rm -rf "$tmp_root"' EXIT
repo_dir="$tmp_root/kiss-startpage"

echo "[bootstrap] Cloning ${REPO_URL} (${BRANCH})"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$repo_dir"

cd "$repo_dir"
echo "[bootstrap] Running preflight"
bash ops/preflight.sh --port "$PORT"
echo "[bootstrap] Running installer"
bash ops/install.sh --port "$PORT" --bind "$BIND_ADDR" --install-dir "$INSTALL_DIR" --data-dir "$DATA_DIR"
apply_bind_override_if_needed

print_urls
