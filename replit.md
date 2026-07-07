# Rebur Engine

A fork of [jabarmcaffry/rebur-engine](https://github.com/jabarmcaffry/rebur-engine) — a multiplayer 3D game engine and visual editor — adapted to run on Replit.

## Architecture

| Component | Port | Description |
|-----------|------|-------------|
| Proxy server (`proxy.ts`) | 5000 | Deno HTTP/WS proxy — serves static editor files and forwards `/api/*`, `/internal/*`, `/worlds/*` to the multiplayer server |
| Multiplayer server | 8000 | Deno server (`server-host/main.ts`) — game session management, world scripts, file API |
| esbuild dev server | 5173 | Internal only — live-rebuilds the editor and client bundles |

Replit only exposes one port per subdomain, so the proxy on port 5000 handles everything the browser sees.

## How to run

Both workflows start automatically:
- **Multiplayer Server** — `cd multiplayer && deno task start --spawn-fail --spawn rebur/spaceship-demo`
- **Start application** — `bash start-editor.sh` (pre-caches npm deps, fixes symlinks, starts esbuild watcher, starts proxy)

Open the webview to see the editor.

## Key files

| File | Purpose |
|------|---------|
| `proxy.ts` | Deno HTTP + WebSocket reverse proxy on port 5000 |
| `start-editor.sh` | Startup script: npm cache fix → esbuild watch → proxy |
| `editor/.env.local` | `IS_DEV=true`, `REBUR_MULTIPLAYER_PUBLIC_URL` (must be `wss://` prefix pointing to the Replit dev domain) |
| `multiplayer/.env.local` | `IS_DEV=true`, `BIND_ADDRESS=0.0.0.0:8000`, auth tokens, `REBUR_MULTIPLAYER_PUBLIC_URL` (must be the Replit dev domain HTTPS URL) |
| `multiplayer/server-host/session.ts` | Close code 1001→1000 fix (line ~233) — Deno rejects sending close code 1001 |

## Environment notes

- **Deno 2** is required (not Node). The `.replit` file includes `deno-2` in the modules list.
- **npm symlink fix**: Replit's package firewall stores npm packages at `.../package-firewall.replit.local/npm/<pkg>` but esbuild's deno-loader expects `.../package-firewall.replit.local/<pkg>`. `start-editor.sh` creates the needed symlinks on every start.
- **`REBUR_MULTIPLAYER_PUBLIC_URL`** in `multiplayer/.env.local` must be set to the Replit dev domain (e.g. `https://a3d55577-...-riker.replit.dev`) so the Handshake packet embeds reachable resource URLs. The browser fetches world scripts and assets from `{PUBLIC_URL}/worlds/...` which the proxy forwards to port 8000.
- **`editor/.env.local`** uses `wss://` prefix because the client converts `wss:→https:` for storage then back for WebSocket; passing `https://` caused `http://` storage and plain `ws://` connections which Replit's proxy rejects.

## Package namespace

All internal packages use `@rebur/` namespace (e.g. `@rebur/engine`, `@rebur/ui`, `@rebur/client/`). The import maps in `deno.json`, `editor/deno.json`, `multiplayer/deno.jsonc`, and `client/deno.json` resolve these to local source paths.

## Worlds directory

Worlds live in `multiplayer/worlds/rebur/<world-name>/`. World IDs follow the pattern `rebur/<world-name>`.

## Editor features

- **Script Editor**: Double-click any `.ts`/`.tsx` file in the Project panel, or double-click a behavior's script field in the Inspector, to open it in the built-in Monaco editor (Scripts tab in the bottom panel). Files auto-save after 1.5 s of inactivity.
- **Mobile layout**: On screens ≤ 600px, a bottom navigation bar lets you switch between Game, Project (file tree), Inspector, and Panels tabs.

## GitHub remote

The upstream WorldQL origin has been replaced with `https://github.com/jabarmcaffry/rebur-engine`. Local branch is `trunk`.

## User preferences

- Keep Deno-native patterns; do not introduce Node.js tooling.
- Do not add Docker or virtual environments (Replit's NixOS handles the runtime).
- All naming must use "Rebur" / `@rebur/` / `REBUR_` — no "dreamlab" branding anywhere in user-visible code.
