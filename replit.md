# Rebur Engine (Dreamlab Fork)

A fork of [WorldQL/dreamlab-engine](https://github.com/WorldQL/dreamlab-engine) — a multiplayer 2D game engine and visual editor — adapted to run on Replit.

## Architecture

| Component | Port | Description |
|-----------|------|-------------|
| Proxy server (`proxy.ts`) | 5000 | Deno HTTP/WS proxy — serves static editor files and forwards `/api/*`, `/internal/*`, `/worlds/*` to the multiplayer server |
| Multiplayer server | 8000 | Deno server (`server-host/main.ts`) — game session management, world scripts, file API |
| esbuild dev server | 5173 | Internal only — live-rebuilds the editor and client bundles |

Replit only exposes one port per subdomain, so the proxy on port 5000 handles everything the browser sees.

## How to run

Both workflows start automatically:
- **Multiplayer Server** — `cd multiplayer && deno task start --spawn-fail --spawn dreamlab/spaceship-demo`
- **Start application** — `bash start-editor.sh` (pre-caches npm deps, fixes symlinks, starts esbuild watcher, starts proxy)

Open the webview to see the editor.

## Key files

| File | Purpose |
|------|---------|
| `proxy.ts` | Deno HTTP + WebSocket reverse proxy on port 5000 |
| `start-editor.sh` | Startup script: npm cache fix → esbuild watch → proxy |
| `editor/.env.local` | `IS_DEV=true`, `DREAMLAB_MULTIPLAYER_PUBLIC_URL` (must be `wss://` prefix pointing to the Replit dev domain) |
| `multiplayer/.env.local` | `IS_DEV=true`, `BIND_ADDRESS=0.0.0.0:8000`, auth tokens, `DREAMLAB_MULTIPLAYER_PUBLIC_URL` (must be the Replit dev domain HTTPS URL) |
| `multiplayer/server-host/session.ts` | Close code 1001→1000 fix (line ~233) — Deno rejects sending close code 1001 |

## Environment notes

- **Deno 2** is required (not Node). The `.replit` file includes `deno-2` in the modules list.
- **npm symlink fix**: Replit's package firewall stores npm packages at `.../package-firewall.replit.local/npm/<pkg>` but esbuild's deno-loader expects `.../package-firewall.replit.local/<pkg>`. `start-editor.sh` creates the needed symlinks on every start.
- **`DREAMLAB_MULTIPLAYER_PUBLIC_URL`** in `multiplayer/.env.local` must be set to the Replit dev domain (e.g. `https://a3d55577-...-riker.replit.dev`) so the Handshake packet embeds reachable resource URLs. The browser fetches world scripts and assets from `{PUBLIC_URL}/worlds/...` which the proxy forwards to port 8000.
- **`editor/.env.local`** uses `wss://` prefix because the client converts `wss:→https:` for storage then back for WebSocket; passing `https://` caused `http://` storage and plain `ws://` connections which Replit's proxy rejects.

## GitHub remote

The upstream WorldQL origin has been replaced with `https://github.com/jabarmcaffry/rebur-engine`. Local branch is `trunk`.

## User preferences

- Keep Deno-native patterns; do not introduce Node.js tooling.
- Do not add Docker or virtual environments (Replit's NixOS handles the runtime).
