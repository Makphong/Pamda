#!/bin/sh
set -eu

escape_js_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

AUTH_API_BASE_URL_VALUE="${VITE_AUTH_API_BASE_URL:-${AUTH_API_BASE_URL:-}}"
GOOGLE_CLIENT_ID_VALUE="${VITE_GOOGLE_CLIENT_ID:-${GOOGLE_CLIENT_ID:-}}"

AUTH_API_BASE_URL_ESCAPED="$(escape_js_string "$AUTH_API_BASE_URL_VALUE")"
GOOGLE_CLIENT_ID_ESCAPED="$(escape_js_string "$GOOGLE_CLIENT_ID_VALUE")"

cat > /app/dist/runtime-config.js <<EOF
window.__PM_CALENDAR_RUNTIME_CONFIG__ = {
  VITE_AUTH_API_BASE_URL: "${AUTH_API_BASE_URL_ESCAPED}",
  VITE_GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID_ESCAPED}"
};
EOF

exec "$@"
