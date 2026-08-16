#!/bin/sh
# Writes the runtime configuration the SPA reads before it boots, so a single
# image can point at any backend without being rebuilt.
set -e

CONFIG_FILE=/usr/share/nginx/html/config.js

cat > "$CONFIG_FILE" <<CONFIG
window.__APP_CONFIG__ = {
  API_URL: "${API_URL:-/api}"
};
CONFIG

# Ensure index.html loads it exactly once (idempotent across restarts).
if ! grep -q '/config.js' /usr/share/nginx/html/index.html; then
  sed -i 's#<head>#<head>\n    <script src="/config.js"></script>#' \
    /usr/share/nginx/html/index.html
fi

echo "[app-config] API_URL=${API_URL:-/api}"
