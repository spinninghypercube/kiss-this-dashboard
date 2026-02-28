# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning where practical.

## [Unreleased]

## [1.3.0] - 2026-02-23

### Added
- Starter default config seeded from the maintainer's `Default` tab plus an empty `Extra tab`
- Docker Compose quick-start (`docker-compose.yml`, `.env.example`)
- Debian/Ubuntu install tooling (`ops/install.sh`) and preflight checks (`ops/preflight.sh`)
- Backup/restore scripts (`ops/backup.sh`, `ops/restore.sh`)
- Smoke test script (`ops/smoke-test.sh`)
- Release helper script (`maintainer/release.sh`) and README deployment docs
- First-run admin account bootstrap flow (no default credentials for new installs)
- Admin `Reset to Starter` action
- Backend static file serving fallback for single-service deployments
- Admin drag-and-drop reordering for tabs, groups, and buttons (desktop + touch)
- Tab theme preset manager with built-in presets plus save/load for per-tab custom presets

### Changed
- New installs now start with `Default` + `Extra tab` starter tabs from `startpage-default-config.json`
- Group/button reorder arrow mini-actions were replaced with drag handles in the admin editor
