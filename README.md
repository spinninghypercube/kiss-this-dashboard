# KISS this dashboard

> Your homelab start page, built in the browser — no config files, no YAML, no restarts.

## Features

- WYSIWYG layout and theming: design everything directly in the browser
- Drag-and-drop editing: reorder tabs, groups, and buttons visually
- Multiple icon library integrations plus embedded/custom icon support
- Mobile friendly
- Self-hosted auth and local persistence (no external account required)
- No heavy stack, no cloud dependency, no over-engineered setup
- Docker Compose or plain systemd deployment on Linux
- Windows one-shot installer (PowerShell) and optional EXE bootstrap artifact

<img width="430" height="840" alt="image" src="https://github.com/user-attachments/assets/ffaca904-8216-482e-828c-2874761dbcfd" />

<img width="430" height="840" alt="image" src="https://github.com/user-attachments/assets/144a5598-0fa5-42d4-b4e5-657938dbbc2c" />

<img width="1717" height="1320" alt="image" src="https://github.com/user-attachments/assets/dd011d34-da21-4252-8f83-6427fd951e8f" />

<img width="1716" height="1320" alt="image" src="https://github.com/user-attachments/assets/3d77beee-5de2-40c4-b71a-ad101f91c917" />

Important:
- On first visit, the app prompts you to create the first admin username/password (no shared default credentials).
- If you import an older users file with a legacy default account, the admin UI can still force a password change before edits.
- Reverse proxy setup is optional and not bundled; an nginx example is included under `ops/nginx/`.

## Quick Start

**Docker:**
```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-docker.sh | bash
```

**Linux (Debian/Ubuntu, systemd):**
```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash
```

**Windows (PowerShell):**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-windows.ps1 | iex"
```

Then open `http://<your-server-ip>:8788` — the first visit walks you through creating an admin account.

## Install Options

### Windows (PowerShell or EXE)

PowerShell one-shot installer (run as Administrator):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-windows.ps1 | iex"
```

Safer two-step variant (lets you inspect before running):

```powershell
iwr https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-windows.ps1 -OutFile bootstrap-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap-windows.ps1
```

What it does:
- checks or installs dependencies (`git`, `node`, `npm`, `go`, `nssm`) via `winget`
- clones/updates the repo in `C:\ProgramData\KissThisDashboard\app`
- builds frontend + backend
- installs/updates Windows service `kiss-this-dashboard-api`

Useful flags:
- `-Port 8788`
- `-Bind 127.0.0.1` (recommended for same-host reverse proxy setups)
- `-InstallRoot C:\ProgramData\KissThisDashboard`
- `-DataDir D:\kiss-data`
- `-Branch main`
- `-NoService` (run in current console instead of service mode)
- `-SkipDependencyInstall` (fail fast if tools are missing)

EXE option:
- download `kiss-this-dashboard-bootstrap.exe` from GitHub Releases
- run it as Administrator
- this EXE is generated from `ops/bootstrap-windows.ps1` by `.github/workflows/windows-bootstrap-exe.yml`

### Linux (Debian/Ubuntu, systemd)

Paste this on a Debian/Ubuntu server (runs as root via `sudo`), installs dependencies, clones the repo, builds the app, installs the systemd service, and prints the URL:

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash
```

Optional flags (append after `sudo bash -s --`):
- `--port 8788`
- `--bind 127.0.0.1` (recommended for same-host reverse proxy setups)
- `--install-dir /opt/kiss-this-dashboard`
- `--data-dir /var/lib/kiss-this-dashboard`
- `--branch main`

Example:

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash -s -- --port 8788
```

Same-host reverse proxy example (nginx/Caddy on the same machine):

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash -s -- --bind 127.0.0.1
```

### Docker (Docker Compose)

Paste this on a Linux host that already has Docker + Docker Compose installed. It clones the repo, builds the container, starts it, and prints the URL:

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-docker.sh | bash
```

Optional flags (append after `bash -s --`):
- `--port 8788`
- `--dir ~/kiss-this-dashboard-docker`
- `--branch main`

## Manual Install (Debian/Ubuntu, systemd)

Requirements:
- `go` (builds the backend binary)
- `node` + `npm` (builds the Svelte frontend)
- `curl`, `systemd`
- `jq` recommended (used by scripts and troubleshooting)
- `python3` optional (smoke test can use `jq` instead)

Run from the cloned repo:
1. Optional preflight:
   - `sudo bash ops/preflight.sh --port 8788`
2. Install:
   - `sudo bash ops/install.sh`
   - Same-host reverse proxy (local-only backend): `sudo bash ops/install.sh --bind 127.0.0.1`
3. Open:
   - Dashboard: `http://127.0.0.1:8788/`
   - Editor: `http://127.0.0.1:8788/edit`

What `ops/install.sh` does:
- creates a system user (`kiss-this-dashboard` by default)
- installs the app to `/opt/kiss-this-dashboard/current`
- builds `frontend-svelte/dist` and `backend-go/kissdash-go`
- creates persistent data dir (`/var/lib/kiss-this-dashboard`)
- creates private icons dir (`/var/lib/kiss-this-dashboard/private-icons`)
- installs and starts a `systemd` service

## Reverse Proxy (Optional)

If you want the app behind nginx on port 80/443:
- use `ops/nginx/kiss-this-dashboard.conf`
- it proxies all requests to the Go backend (`127.0.0.1:8788`)
- For same-host reverse proxy installs, prefer a local-only backend bind (`--bind 127.0.0.1`).
- If your reverse proxy runs on a different host/container, keep the default bind (`0.0.0.0`) or use host firewall rules.

## Manual Install (Docker Compose)

Requirements:
- `docker`
- Docker Compose plugin (`docker compose`) or `docker-compose`

Run from the cloned repo:
1. Start:
   - `docker compose up -d --build`
2. Open:
   - Dashboard: `http://127.0.0.1:8788/`
   - Editor: `http://127.0.0.1:8788/edit`

Notes:
- Persistent app data (config, users, private icons) is stored in the `dashboard_data` volume.
- To change the host port, set `KISS_PORT` in `.env` (for example `KISS_PORT=8080`).

## First Run / Credentials

- First run creates the first admin account through a setup form (username + password)
- No default login is shipped for new installs
- If a legacy default account is detected, the app may require a password change before editor writes are allowed
- Username can also be changed in the `Account` modal

## Backups and Restore

Backup current config + users (+ `private-icons/` if present):
- `sudo bash ops/backup.sh`

Custom paths:
- `sudo bash ops/backup.sh --data-dir /var/lib/kiss-this-dashboard --out-dir /var/backups/kiss-this-dashboard`

Restore from a backup:
- `sudo bash ops/restore.sh --backup /var/backups/kiss-this-dashboard/kiss-this-dashboard-backup-YYYYmmdd-HHMMSS.tar.gz`

Restore and restart service:
- `sudo bash ops/restore.sh --backup <file> --restart-service`

## Smoke Test (Post-Install Verification)

Basic smoke test:
- `bash ops/smoke-test.sh --base-url http://127.0.0.1:8788 --username smokeadmin --password 'smoketest123'`

If no admin account exists yet, the smoke test bootstraps the first one using the provided username/password.

## Updating

Easiest update path: rerun the same one-shot installer command you used for the initial install. This updates the app code/build and keeps your existing data.

Linux one-shot (systemd install):
- `curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash`

Docker one-shot (Docker Compose install):
- `curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-docker.sh | bash`

Windows one-shot (PowerShell install):
- `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-windows.ps1 | iex"`

Notes:
- Reuse the same flags you used originally (`--port`, `--bind`, `--install-dir`, `--data-dir`, `--dir`, `-Port`, `-Bind`, `-InstallRoot`, or `-DataDir`).
- Reuse the same user/root context you used originally, especially for the Docker one-shot install.
- If you installed from a local git checkout instead of the one-shot installers, use the manual upgrade flow below.

## Upgrades

Recommended upgrade flow:
1. `sudo bash ops/backup.sh`
2. Pull latest repo changes
3. Re-run install script:
   - `sudo bash ops/install.sh`
4. Restart service if needed:
   - `sudo systemctl restart kiss-this-dashboard-api`
5. Run smoke test:
   - `bash ops/smoke-test.sh --base-url http://127.0.0.1:8788 --username <user> --password '<pass>'`

## Project Layout

- `backend-go/main.go` Go API + auth + config storage + static file serving
- `frontend-svelte/` Svelte frontend source + Vite build config
- `Dockerfile` and `docker-compose.yml` for containerized deployment
- `dashboard-default-config.json` starter config used on first run and for reset-to-starter
- `ops/` user-facing install/backup/restore/smoke-test scripts + one-shot installers + systemd/nginx templates
- `.github/workflows/windows-bootstrap-exe.yml` Windows installer EXE build pipeline
