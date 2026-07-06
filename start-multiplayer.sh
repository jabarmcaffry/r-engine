#!/usr/bin/env bash
set -e

# Generate multiplayer/.env.local dynamically using the Replit dev domain.
# REPLIT_DEV_DOMAIN is automatically set by Replit (e.g. abc123.riker.replit.dev).
# Fall back to localhost if not in Replit (local dev).
PUBLIC_HOST="${REPLIT_DEV_DOMAIN:-localhost:8000}"
PUBLIC_URL="https://${PUBLIC_HOST}"

cat > multiplayer/.env.local << EOF
IS_DEV="true"
BIND_ADDRESS="0.0.0.0:8000"

DREAMLAB_MULTIPLAYER_AUTH_TOKEN="token"
DREAMLAB_MULTIPLAYER_ENABLE_METRICS="false"

DREAMLAB_NEXT_GAME_JWT_SECRET="token"

# Public URL used in Handshake packets — must be reachable by the browser.
# /worlds/* on this domain is proxied by start-editor.sh's proxy to port 8000.
DREAMLAB_MULTIPLAYER_PUBLIC_URL="${PUBLIC_URL}"

DREAMLAB_KV_PUBLIC_URL="https://keyvalue.dreamlab.gg"
DREAMLAB_KV_SIGNING_KEY="e9GYhoAu7HUTt49MujMC8GVKpd8xcpU7jyHjSVHOnEI"

DREAMLAB_CODE_EDITOR_YJS_URL=""
EOF

echo "==> Generated multiplayer/.env.local (PUBLIC_URL=${PUBLIC_URL})"

cd multiplayer && deno task start "$@"
