# KISS this dashboard

Self-hosted dashboard with a shared web-based admin editor, per-tab theming, and embedded icon support.

<img width="430" height="840" alt="image" src="https://github.com/user-attachments/assets/144a5598-0fa5-42d4-b4e5-657938dbbc2c" />

<img width="430" height="840" alt="image" src="https://github.com/user-attachments/assets/ffaca904-8216-482e-828c-2874761dbcfd" />

<img width="1717" height="1320" alt="image" src="https://github.com/user-attachments/assets/dd011d34-da21-4252-8f83-6427fd951e8f" />

<img width="1716" height="1320" alt="image" src="https://github.com/user-attachments/assets/3d77beee-5de2-40c4-b71a-ad101f91c917" />


Important:
- On first visit, the app prompts you to create the first admin username/password (no shared default credentials).
- If you import an older users file with a legacy default account, the admin UI can still force a password change before edits.
- Reverse proxy setup is intentionally not included in this repo. Bring your own if you need HTTPS/public access.

Choose one deployment method below (Docker Compose or systemd). Docker Compose is optional.

## Quick Start (Docker Compose, Optional)

Use this if you want a one-command Docker deployment.


Requirements:
- Docker + Docker Compose plugin (`docker compose`)

Steps:
1. Clone the repo.
2. Copy env file:
   - `cp .env.example .env`
3. Start the app:
   - `docker compose up -d`
4. Open:
   - Dashboard: `http://<host>:8080/`
   - Editor: `http://<host>:8080/edit`
5. On first visit, create your admin username/password in the setup form.

Notes:
- The container serves both the frontend and API on one port.
- Persistent data is stored in the `dashboard_data` Docker volume.

## Quick Start (Debian/Ubuntu, systemd)

Use this if you do not want Docker.


Requirements:
- `python3`, `curl`, `systemd`
- `jq` recommended (used by scripts and troubleshooting)

Run from the cloned repo:
1. Optional preflight:
   - `sudo bash ops/preflight.sh --port 8788`
2. Install:
   - `sudo bash ops/install.sh`
3. Open:
   - Dashboard: `http://127.0.0.1:8788/`
   - Editor: `http://127.0.0.1:8788/edit`

What `ops/install.sh` does:
- creates a system user (`kiss-this-dashboard` by default)
- installs the app to `/opt/kiss-this-dashboard/current`
- creates persistent data dir (`/var/lib/kiss-this-dashboard`)
- installs and starts a `systemd` service

## First Run / Credentials

- First run creates the first admin account through a setup form (username + password)
- No default login is shipped for new installs
- If a legacy default account is detected, the app may require a password change before editor writes are allowed
- Username can also be changed in the `Account` modal

## Backups and Restore

Backup current config + users:
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

## Reset to Starter Config (Admin UI)

In `Admin` -> `Tab Settings`, use:
- `Reset to Starter`

This replaces the current dashboard config with the starter config from `dashboard-default-config.json`.

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

## Releases / Versioning

- `CHANGELOG.md` is included for short release notes
- `maintainer/release.sh` helps create annotated git tags (maintainer workflow)

Example:
- `bash maintainer/release.sh 1.2.0`
- `git push origin main --tags`

## Project Layout

- `index.html` dashboard frontend
- `edit.html` editor frontend
- `dashboard-common.js` shared client logic + API calls
- `dashboard.js` dashboard rendering
- `admin.js` admin editor UI
- `backend/dashboard_api.py` API + auth + config storage + static file serving fallback
- `dashboard-default-config.json` starter config used on first run and for reset-to-starter
- `ops/` user-facing install/backup/restore/smoke-test scripts + systemd unit template
- `maintainer/` maintainer-only release tooling
