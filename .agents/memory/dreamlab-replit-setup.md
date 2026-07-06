---
name: Dreamlab Replit Setup
description: Non-obvious lessons about running Rebur Engine (Dreamlab fork) on Replit.
---

## Editor connection flow (non-obvious)

Direct URL `/?instance=<worldId>` shows "Failed to connect". The correct flow is:
1. POST `/api/dashboard/start-instance` with `{"world_id":"..."}` → returns UUID instance ID
2. Wait for `status: "Started"` via GET `/api/dashboard/instances`
3. Open `/?instance=<uuid>` — the UUID, not the world path

**Why:** WebSocket endpoint is `/api/v1/connect/<instanceId>` (UUID), not the world path. The dashboard UI handles this automatically when user clicks Edit/Play.

## Required module

`deno-2` must remain in `.replit` modules — both startup scripts invoke `deno` directly. Removing it breaks all workflows on fresh environments.
