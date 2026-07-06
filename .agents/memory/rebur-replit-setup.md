---
name: Rebur Engine Replit Setup
description: Non-obvious lessons about running Rebur Engine on Replit — port mapping, env, branding, and feature notes.
---

## Editor connection flow (non-obvious)

Direct URL `/?instance=<worldId>` shows "Failed to connect". The correct flow is:
1. POST `/api/dashboard/start-instance` with `{"world_id":"..."}` → returns UUID instance ID
2. Wait for `status: "Started"` via GET `/api/dashboard/instances`
3. Open `/?instance=<uuid>` — the UUID, not the world path

**Why:** WebSocket endpoint is `/api/v1/connect/<instanceId>` (UUID), not the world path. The dashboard UI handles this automatically when user clicks Edit/Play.

## Required module

`deno-2` must remain in `.replit` modules — both startup scripts invoke `deno` directly. Removing it breaks all workflows on fresh environments.

**How to apply:** When editing `.replit`, always verify `modules` array includes `"deno-2"`.

## Package namespace rename (dreamlab → rebur)

All `@dreamlab/` imports were renamed to `@rebur/` across the codebase. The esbuild plugins in `build-system/_esbuild.ts` use regex patterns like `/^@rebur\/engine$/` — these are backslash-escaped regex literals that sed CANNOT match with `s/@dreamlab\//@rebur\//g` because the file content has `@dreamlab\/` (with literal backslash). Must use Python string replacement or targeted sed with `s|@dreamlab\\\/|@rebur\\\/|g`.

**Why:** sed pattern `s/@dreamlab\//@rebur\//g` only matches `@dreamlab/` (no backslash). Regex literals in TypeScript files use `@dreamlab\/` (with backslash), so sed misses them.

## Monaco Editor loading (AMD gotcha)

Monaco's AMD loader (`require(['vs/editor/editor.main'], callback)`) does NOT pass `monaco` as the callback argument. It exposes `monaco` on `globalThis` instead. The callback arg is typically `undefined`.

**Why:** Standard Monaco AMD behavior — the module is self-registering and populates `globalThis.monaco`.
**How to apply:** Always use `(globalThis as any).monaco` inside the AMD callback, not the callback parameter.

## Mobile layout approach

Mobile panel switching uses `data-mobile-panel` attribute on `main` element. CSS uses `grid-area: content` for all panels so they overlap, then `display: none !important` for inactive ones. The mobile nav bar (`#mobile-nav`) sets `grid-area: mobile-nav` and is hidden on desktop via `@media (min-width: 601px) { display: none }`.

## Worlds directory

Worlds are in `multiplayer/worlds/rebur/<name>/`. World IDs are `rebur/<name>`. The proxy reads this directory to serve the world list.

## External service URLs (keep as-is)

These `.dreamlab.gg` URLs are real external services the engine connects to — do not rename them:
- `keyvalue.dreamlab.gg` — KV store
- `s3-assets.dreamlab.gg` — asset CDN
- `distribution.dreamlab.gg` — code distribution
- `app.dreamlab.gg` — AI chatbot fallback
- `ai-chatbot.dreamlab.gg` — AI chatbot
- `docs.dreamlab.gg` — documentation

## Script Editor integration

Files are fetched/saved via `GET/PUT /api/v1/edit/{instanceId}/files/{path}`. The `instanceId` comes from `game.instanceId` (ClientGame), and `serverUrl` from `connectionDetails` (imported from `@rebur/client/util/server-url.ts`). The message event `{ action: "goToTab", tab: "scripts", fileName }` is dispatched by `window.parent.postMessage` in both `file-tree.tsx` (double-click file) and `behavior-editor.ts` (double-click script field) — since editor and parent are the same frame, `window.addEventListener("message")` in `main.ts` catches it.
