---
name: Rebur Engine Replit Setup
description: Non-obvious lessons about running Rebur Engine on Replit — port mapping, env quirks, deno-2 module requirement, and feature implementation notes.
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

## Dashboard Play button bug (root cause)

`public/dashboard.html` `pollUntilReady()` called `openEditor(instanceId)` for **both** edit and play modes. The fix: pass `mode` and `serverUrl` through, then branch — `openEditor` for editor mode, `openPlay(instanceId, serverUrl)` for game mode, which navigates to `/play/?instance=<id>&server=<wsUrl>`.

Also: `startPlay` was calling a nonexistent `/api/v1/start-play-world` endpoint. Changed to use `/api/dashboard/start-instance` with `edit_mode: false` (same as edit but without edit flag). Now returns `{ id, server }`.

**Why:** The original dashboard was written before play/editor separation existed — both buttons went to the editor.

## Play/Editor separation (Roblox-style)

Play mode is fully separated from the editor:
- **Editor (Studio)**: `/?instance=<id>` — full editor UI, for world creators
- **Player (Game)**: `/play?instance=<id>&play_session=1&server=<wsUrl>` — player client (client/), no editor chrome

**Implementation:**
- Play button in editor opens `/play?...` in a new tab via `#openPlayTab()`
- `client/src/init.tsx` forwards `play_session=1` from URL params to the WebSocket URL
- proxy.ts serves `client/web/` at `/play/*` via `serveDir` with `urlRoot: "play"`
- `start-editor.sh` watch-builds both `editor/` and `client/` in parallel
- Stop button in editor still calls `POST /api/v1/stop-play-session/<instanceId>`
- Server-side play session state is pushed back via `edit:play-session` WebSocket channel

**Why:** Roblox-style separation — editors stay in studio, players connect to a separate client with no editor chrome.

## Mobile layout removal

All mobile-specific CSS and JS has been removed (no @media max-width: 600px breakpoints). The editor uses desktop layout on all screen sizes. Deleted files: `editor/client/mobile-nav.ts`, `editor/client/css/mobile-nav.css`. Removed imports and `setupMobileNav()` call from `editor/client/main.ts`.

## Worlds directory

Worlds are in `multiplayer/worlds/rebur/<name>/`. World IDs are `rebur/<name>`. The proxy reads this directory to serve the world list.

## External service separation (dreamlab → rebur)

All dreamlab.gg service URLs have been removed. Optional features now require self-hosted servers:
- **KV store**: set `REBUR_KV_PUBLIC_URL` + `REBUR_KV_SIGNING_KEY` env vars. Config fields are optional; KV features silently disabled when unset.
- **Distribution server**: set `REBUR_DISTRIBUTION_PUBLIC_URL` env var. Optional; world-fetch throws a clear error if a remote world is requested without it.
- **NEXT_PUBLIC_URL**: set `REBUR_NEXT_PUBLIC_URL` env var. Optional; Discord auth routes throw if accessed without it.
- **AI chatbot**: only works with localhost:5177 (local dev). External chatbot URL removed — no self-hosted alternative needed unless building it.
- **Cloud assets**: `cloudAssetBaseURL` defaults to `""` (disabled). Set via game options if hosting assets elsewhere.

## CSS web component selectors

CSS files in `editor/client/components/` and `client/src/css/` use `rebur-*` selectors (e.g., `rebur-button`, `rebur-data-tree`). TypeScript definitions in the same directories also register as `rebur-*`. If adding new web components, use `rebur-` prefix in both TS and CSS.

## Script Editor integration

Files are fetched/saved via `GET/PUT /api/v1/edit/{instanceId}/files/{path}`. The `instanceId` comes from `game.instanceId` (ClientGame), and `serverUrl` from `connectionDetails` (imported from `@rebur/client/util/server-url.ts`). The message event `{ action: "goToTab", tab: "scripts", fileName }` is dispatched by `window.parent.postMessage` in both `file-tree.tsx` (double-click file) and `behavior-editor.ts` (double-click script field) — since editor and parent are the same frame, `window.addEventListener("message")` in `main.ts` catches it.

## 3D migration — renderer API

`IRendererBackend` (engine/renderer/api.ts) has `canvas: HTMLCanvasElement` directly — no `.app.canvas` (that was the PixiJS 2D renderer). All entity/input code must use `game.renderer.canvas`.

**How to apply:** Any new code accessing the canvas must use `game.renderer.canvas`, not `game.renderer.app.canvas`.

## 3D migration — Camera.getActive

`Camera.getActive(game)` is now a static method on `engine/entity/entities/camera.ts`. It calls `game.entities.lookupByType(Camera).find(c => c.active)`. Many 2D entities (sprite, tiling-sprite, render-container, rich-text, animated-sprite, physics-debug) still call `Camera.getActive` — this is fine since the method now exists.

**Why:** The original 2D camera had `getActive` as a static method; it was removed during the 3D migration but is needed by many entity types still partially 2D.

## 3D migration — Camera.screenToWorld stub

`Camera.screenToWorld(screen)` currently returns `new Vector2(screen.x, screen.y)` (screen position as proxy). This keeps mouse/click events firing. A proper Three.js `Raycaster` implementation is needed for true world-space coordinates.

**Why:** Mouse/click events only fire when `cursor.world` is defined; returning `undefined` would break all click interactions.

## 3D migration — UILayer/UIPanel element

`UILayer` and `UIPanel` now expose an `element: HTMLDivElement` getter and mount it to `(game as ClientGame).container` on `EntitySpawned`. This is the DOM anchor for `UIBehavior` children. The div uses `position:absolute` fill with `pointer-events:none` so it overlays the Three.js canvas without blocking renderer input.

## 3D migration — wasd-movement-behavior Vec3

WASD movement now uses `Vec3` (not `Vector2`). Forward/back is `z ∓ 1` (Three.js -Z forward convention). Use `movement.normalized().scale(speed)` — Vec3 uses `.scale(n)` for scalar multiply, `.normalized()` (not `.normalize()`).
