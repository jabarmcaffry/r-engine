#!/usr/bin/env bash
set -e

NPM_CACHE_DIR="/home/runner/workspace/.cache/deno/npm/package-firewall.replit.local"

echo "==> Pre-caching npm dependencies..."
deno cache --no-lock \
  engine/_deps/cbor2.ts \
  engine/_deps/cuid.ts \
  engine/_deps/fast-deep-equal.ts \
  engine/_deps/howler.ts \
  engine/_deps/morphdom.ts \
  engine/_deps/nanoid.ts \
  engine/_deps/pako.ts \
  engine/_deps/pixi.ts \
  engine/_deps/poly-decomp-es.ts \
  engine/_deps/rapier.ts \
  engine/_deps/type-fest.ts \
  util/polyfills/iterator-helpers.ts \
  2>/dev/null || true

echo "==> Fixing npm cache path (Replit registry adds extra /npm/ level)..."
# deno-loader expects: $NPM_CACHE_DIR/<pkg>/<version>
# Replit stores at:    $NPM_CACHE_DIR/npm/<pkg>/<version>
# Create symlinks at the top level for every package in the npm/ subdirectory
if [ -d "$NPM_CACHE_DIR/npm" ]; then
  for pkg_path in "$NPM_CACHE_DIR/npm"/*; do
    pkg=$(basename "$pkg_path")
    target="$NPM_CACHE_DIR/$pkg"
    # Handle scoped packages (@scope/name) — already a directory at npm/@scope/
    if [ ! -e "$target" ]; then
      ln -sf "$pkg_path" "$target"
    fi
  done
  echo "    Symlinks created."
fi

# Generate editor/.env.local dynamically using the Replit dev domain.
# wss:// is required: the client converts wss:→https: for storage then back to wss: for WebSocket.
PUBLIC_HOST="${REPLIT_DEV_DOMAIN:-localhost:5000}"
cat > editor/.env.local << EOF
IS_DEV=true
REBUR_MULTIPLAYER_PUBLIC_URL=wss://${PUBLIC_HOST}
EOF
echo "==> Generated editor/.env.local (PUBLIC_URL=wss://${PUBLIC_HOST})"

echo "==> Starting editor build watcher..."
(cd editor && deno run -A _build.ts --watch) &
BUILD_PID=$!

echo "==> Starting proxy server on port 5000..."
deno run -A proxy.ts

# Cleanup on exit
kill $BUILD_PID 2>/dev/null || true
