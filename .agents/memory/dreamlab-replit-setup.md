---
name: Dreamlab Replit Setup
description: Proxy + env quirks, editor connection flow, and docs structure for Rebur Engine on Replit.
---

## How the engine runs on Replit

- Proxy server on port 5000 (`proxy.ts`) — single-port entrypoint. Serves dashboard, editor, docs, public assets. Forwards `/api/*`, `/internal/*`, `/worlds/*` to multiplayer server on port 8000.
- Multiplayer server on port 8000 (`multiplayer/server-host/main.ts`) — manages game instances.
- Editor built by esbuild watcher, served from `editor/web/`.

## Editor connection flow (important)

Direct URL `/?instance=<worldId>` does NOT work — it shows "Failed to connect". The correct flow:
1. POST `http://localhost:5000/api/dashboard/start-instance` with `{"world_id":"dreamlab/spaceship-demo"}` → returns `{id: "<instanceId>", status: "Building engine", ...}`
2. Wait for status to become "Started" by polling `GET /api/dashboard/instances`
3. Open `/?instance=<instanceId>` (the UUID, not the world path)
The dashboard UI handles this automatically when user clicks "Edit" or "Play".

**Why:** world IDs are paths (`dreamlab/spaceship-demo`), but instance IDs are UUIDs. The WebSocket endpoint is `/api/v1/connect/<instanceId>`.

## Auth token

`DREAMLAB_MULTIPLAYER_AUTH_TOKEN` env var is used as a Bearer token for privileged multiplayer endpoints. Defaults to `"token"` if not set. The proxy adds it server-side for `/api/dashboard/*` routes — never exposed to the browser.

## Docs

`public/docs.html` is a single-page app with sidebar nav and hash routing. All 33+ documentation sections covering the full Dreamlab engine API. The `/docs` route in proxy.ts serves it.

## Env setup

`start-editor.sh` includes a workaround for Replit's npm registry symlink issue (extra `/npm/` level in cache path). `multiplayer/pre-exec/prepare.ts` generates `.env.local` with the correct public URL from `REPLIT_DEV_DOMAIN`.
