# KISS this dashboard

Your homelab start page, built in the browser.

## Features

- WYSIWYG layout and theming
- Drag-and-drop tabs, groups, and buttons
- Multiple icon library integrations
- Local auth and local data storage
- Docker or systemd install on Linux
- One-click EXE installer on Windows

![KISS2](https://github.com/user-attachments/assets/ac51d41b-fb4f-454e-acee-7e43b74cd556)

## Quick Start

### Windows

[Download Windows installer (.exe)](https://github.com/spinninghypercube/kiss-this-dashboard/releases/download/windows-installer-latest/kiss-this-dashboard-bootstrap.exe)

- Run as Administrator.
- Opens on `http://<your-server-ip>:8788`.
- EXE assets include versioned files like `kiss-this-dashboard-bootstrap-v2.1.1.exe` plus stable `kiss-this-dashboard-bootstrap.exe`.

Optional PowerShell one-shot:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-windows.ps1 | iex"
```

### Linux (One-shot)

Docker:

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-docker.sh | bash
```

Debian/Ubuntu systemd:

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash
```

## Installer Options

| Installer | Main Script | Useful Flags |
|---|---|---|
| Windows | `ops/bootstrap-windows.ps1` | `-Port`, `-Bind`, `-InstallRoot`, `-DataDir`, `-Branch`, `-NoService`, `-SkipDependencyInstall` |
| Linux systemd | `ops/bootstrap.sh` | `--port`, `--bind`, `--install-dir`, `--data-dir`, `--branch` |
| Linux Docker | `ops/bootstrap-docker.sh` | `--port`, `--dir`, `--branch` |

### Sample Commands (Defaults)

Windows EXE (default install/update):

- Download and run: `kiss-this-dashboard-bootstrap.exe` as Administrator

Windows PowerShell (default install):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-windows.ps1 | iex"
```

Linux Debian/Ubuntu systemd (default install):

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash
```

Linux Debian/Ubuntu systemd (local reverse proxy on same host):

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash -s -- --bind 127.0.0.1
```

Linux Docker (default install):

```bash
curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-docker.sh | bash
```

## Updating

Update by rerunning the installer you used initially:

- Linux systemd: `curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap.sh | sudo bash`
- Linux Docker: `curl -fsSL https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-docker.sh | bash`
- Windows PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/spinninghypercube/kiss-this-dashboard/main/ops/bootstrap-windows.ps1 | iex"`
- Windows EXE: rerun `kiss-this-dashboard-bootstrap.exe` as Administrator

Backup and restore (Linux/systemd installs):

- Backup: `sudo bash ops/backup.sh`
- Restore: `sudo bash ops/restore.sh --backup <file> --restart-service`

Smoke test:

- `bash ops/smoke-test.sh --base-url http://127.0.0.1:8788 --username smokeadmin --password 'smoketest123'`

Windows EXE update notes:

- Yes, the EXE can update an existing Windows install in place.
- Default install path users can just rerun the EXE.
- If you use custom paths, pass the same `-InstallRoot` and `-DataDir` values when rerunning so the same instance is updated.

## Security Notes

- First visit creates the first admin account. No default shared credentials for new installs.
- For same-host reverse proxy setups, use loopback bind:
  - Linux systemd: `--bind 127.0.0.1`
  - Windows: `-Bind 127.0.0.1`
- Nginx example config is in `ops/nginx/`.

## Where Things Live

- Linux systemd: app `/opt/kiss-this-dashboard/current`, data `/var/lib/kiss-this-dashboard`
- Linux Docker: persistent data in `dashboard_data` volume
- Windows: app/data under `C:\ProgramData\KissThisDashboard` by default

## Repo Layout

- `backend-go/` API + auth + config storage + static file serving
- `frontend-svelte/` UI source and build
- `ops/` install/backup/restore/smoke-test and one-shot scripts
- `.github/workflows/windows-bootstrap-exe.yml` EXE build + release publishing
