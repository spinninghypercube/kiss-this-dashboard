# nginx Example

This folder contains an example `nginx` site config for deployments that:

- proxy all requests to the Go backend (which serves the built Svelte frontend and API)

File:
- `ops/nginx/kiss-startpage.conf`

Behavior:
- `/`, `/edit`, `/admin`, `/api/*`, and `/icons/*` are handled by the Go backend
- legacy `/admin` and `/edit.html` aliases are normalized by the backend
