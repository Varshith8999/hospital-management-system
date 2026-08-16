#!/bin/sh
# Waits for MySQL, applies migrations (and optional seeds), then starts the API.
set -e

echo "[entrypoint] Waiting for the database at ${DB_HOST}:${DB_PORT}…"

ATTEMPTS="${DB_WAIT_ATTEMPTS:-40}"
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  if node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}).then((c) => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; then
    echo "[entrypoint] Database is ready."
    break
  fi

  if [ "$i" -eq "$ATTEMPTS" ]; then
    echo "[entrypoint] Database never became ready after ${ATTEMPTS} attempts." >&2
    exit 1
  fi

  echo "[entrypoint] Attempt ${i}/${ATTEMPTS} - database not ready, retrying in 3s…"
  i=$((i + 1))
  sleep 3
done

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running migrations…"
  npx sequelize-cli db:migrate
fi

if [ "${RUN_SEEDERS:-false}" = "true" ]; then
  echo "[entrypoint] Seeding demo data…"
  # Seeds are tracked in SequelizeSeeds, so re-running is a no-op.
  npx sequelize-cli db:seed:all || echo "[entrypoint] Seeding skipped (already applied)."
fi

echo "[entrypoint] Starting: $*"
exec "$@"
