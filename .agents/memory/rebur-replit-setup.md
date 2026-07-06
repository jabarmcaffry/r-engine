---
name: Rebur Replit Setup
description: Key quirks and decisions for running the Rebur multiplayer engine on Replit (proxy, env, codecs, close codes)
---

## Proxy architecture
- Single port exposed by Replit (port 5000 → webview). All traffic goes through `proxy.ts` (Deno HTTP+WS reverse proxy).
- Proxy forwards `/api/*`, `/internal/*`, `/worlds/*` to port 8000 (multiplayer server). Static editor files served from `editor/web`.
- `/worlds/*` forwarding is critical: client fetches world scripts and assets from the public URL; without this the game hangs at "Connecting..." after receiving Handshake.

## MULTIPLAYER_PUBLIC_URL must be the Replit dev domain
- The Handshake packet embeds `world_script_base_url` = `${MULTIPLAYER_PUBLIC_URL}/worlds/...`
- Browser fetches resources from this URL. If set to `http://localhost:8000`, browser can't reach it → game stuck at "Connecting..." indefinitely (no error visible in console).
- Fix: `DREAMLAB_MULTIPLAYER_PUBLIC_URL=https://${REPLIT_DEV_DOMAIN}` in `multiplayer/.env.local`.
- `start-multiplayer.sh` generates this dynamically at startup.

## editor/.env.local wss:// requirement
- `editor/.env.local` must use `wss://` prefix for `DREAMLAB_MULTIPLAYER_PUBLIC_URL`.
- Client code: `serverUrl.protocol = serverUrl.protocol === "wss:" ? "https:" : "http:"` — stores https:// for base URL, then converts back to wss:// for WebSocket.
- If `https://` is passed: stored as `http://` → `ws://` connection → Replit proxy rejects plain WebSocket (needs wss://).
- `start-editor.sh` generates this dynamically: `wss://${REPLIT_DEV_DOMAIN}`.

## Deno close code fix
- `multiplayer/server-host/session.ts` line ~233: changed `socket.close(1001)` → `socket.close(1000)`.
- Deno disallows SENDING close code 1001 (valid to receive, but not send).

## npm symlink fix (start-editor.sh)
- Replit package firewall stores npm packages at `.../package-firewall.replit.local/npm/<pkg>`.
- esbuild deno-loader expects `.../package-firewall.replit.local/<pkg>` (no `/npm/` level).
- `start-editor.sh` creates symlinks at the expected path on every startup.

## GitHub push
- Raw `git push origin trunk:main --force` fails: "Invalid username or token" — GitHub HTTPS requires token auth.
- The `gitPush` callback also returns PUSH_REJECTED — the `jabarmcaffry/rebur-engine` repo is not properly connected via Replit's git integration.
- User needs to connect the repo in Replit's git settings for the push to work.

## Screenshot tool limitation
- Screenshot tool accesses port 5000 directly (`http://127.0.0.1:5000`). The editor JS tries to connect via `wss://REPLIT_DEV_DOMAIN/api/v1/connect/...` which goes through Replit's public proxy. The headless screenshot browser may not always reach the public dev domain, so "Connecting..." in screenshots is not always a real bug.

## Why **Why:** entries matter
- Always decode the Handshake packet to verify `world_script_base_url` when debugging connection issues (byte 0 = compression flag, rest = CBOR).
