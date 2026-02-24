# KISS this dashboard

KISS this dashboard is a self-hosted homepage/dashboard for homelabs and personal start pages, with a built-in web editor so you can design the layout directly in the browser.

## Why This One (USPs)

- Keep it stupid simple: no heavy stack, no cloud dependency, no over-engineered setup.
- WYSIWYG layout and theming: edit the actual dashboard UI instead of filling in config files blind.
- Mobile friendly: dashboard and editor both work well on phones/tablets.
- Drag-and-drop editing: reorder tabs, groups, and buttons visually.
- Per-tab theming + reusable theme presets.
- Multiple icon library integrations plus embedded/custom icon support.
- Self-hosted auth and local persistence (no external account required).
- Flexible deploy options: Docker Compose or plain systemd on Debian/Ubuntu.

<img width="1491" height="951" alt="Screenshot from 2026-02-23 00-24-16" src="https://github.com/user-attachments/assets/9ce32591-78b1-444f-ae69-bf5ebdde0358" />

<img width="1493" height="953" alt="Screenshot from 2026-02-23 00-25-21" src="https://github.com/user-attachments/assets/d4a06fd5-36af-40ac-90ef-125bdcdf3f38" />

<img width="1494" height="953" alt="Screenshot from 2026-02-23 00-26-16" src="https://github.com/user-attachments/assets/c08809dc-4f1d-49cc-9952-702c18a1818b" />

<img width="431" height="887" alt="Screenshot from 2026-02-23 00-27-21" src="https://github.com/user-attachments/assets/1163f1d6-6966-4290-a1aa-644bb4ece851" />

<img width="431" height="885" alt="Screenshot from 2026-02-23 00-27-59" src="https://github.com/user-attachments/assets/30a75978-7e76-497e-8169-bb92cddd255a" />


Important:
- On first visit, the app prompts you to create the first admin username/password (no shared default credentials).
- If you import an older users file with a legacy default account, the admin UI can still force a password change before edits.
- Reverse proxy setup is intentionally not included in this repo. Bring your own if you need HTTPS/public access.

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
