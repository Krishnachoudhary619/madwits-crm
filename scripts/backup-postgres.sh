#!/bin/sh
# Create a timestamped PostgreSQL dump. Does not drop or overwrite data.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/madweb-crm-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$OUT"

echo "Wrote $OUT"
