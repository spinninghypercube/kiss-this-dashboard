# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning where practical.

## [Unreleased]

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

### Changed
- New installs now start with `Default` + `Extra tab` starter tabs from `dashboard-default-config.json`
