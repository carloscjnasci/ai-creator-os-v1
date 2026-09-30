# AGENTS.md — AI Creator OS (Base44 dev environment)

## What this is
A local-first Vite + React 18 + TypeScript single-page app ("AI Creator OS").
No backend. Persistence is via browser localStorage. Firebase and an AI gateway
are **optional** integrations — the app boots and is fully usable without them.

## Running it
- `docker compose -f docker-compose.base44.yml up -d` starts the dev server on port 3000.
- The compose uses `node:22`, bind-mounts the repo, installs deps from `package-lock.json`
  on startup, and runs `npm run dev` (Vite with HMR).
- `node_modules` lives in a named volume (not the host), so host-side `npm install` is not needed.
- Vite config already sets `host: 0.0.0.0`, `port: 3000`, `allowedHosts: true`, so the
  preview proxy host is accepted without extra config.

## Environment / secrets
- All env vars are optional. `.env.base44-defaults` ships empty placeholders so the app boots.
- Real values (if the user wants Firebase sync or the AI gateway) are delivered via
  `/run/base44/app.env` and override the defaults.
- `VITE_AI_GATEWAY_URL` — AI provider gateway for the prompt engine.
- `VITE_FIREBASE_*` — Firebase config; when all present, Firebase auth/firestore/storage
  are initialized. Otherwise the app falls back to localStorage.

## Verifying it works
- `curl -s localhost:3000/` returns the Vite-served `index.html` with `@vite/client` (dev, not a build).
- Healthcheck: `docker compose ps` should show `web` as `healthy`.
- The app's root route renders the dashboard; check the browser preview for the main UI.

## Tests
- `npm run test:run` runs the Vitest suite (jsdom).
- `npm run lint` runs the i18n validator + `tsc --noEmit`.
- `npm run build` runs the i18n validator then `vite build`.
