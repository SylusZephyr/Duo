#!/usr/bin/env bash
# Apply every migration to a throwaway Postgres and run the schema tests.
#
# Catches what a migration written by hand gets wrong — a typo in a trigger
# body, a policy that does not compile, a function that references a column
# that is not there — before any of it reaches a real project.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="$(mktemp -d)"

# initdb refuses to run as root. Where we are root (CI containers, sandboxes),
# drop to the unprivileged postgres account for the server lifecycle.
AS_PG=()
if [ "$(id -u)" = "0" ]; then
  PG_USER="${PG_USER:-postgres}"
  id -u "$PG_USER" >/dev/null 2>&1 || PG_USER=nobody
  AS_PG=(setpriv --reuid="$PG_USER" --regid="$(id -g "$PG_USER")" --clear-groups --)
  chmod 777 "$WORKDIR"
fi
PGDATA="$WORKDIR/data"
SOCKET="$WORKDIR/sock"
DB=evasive_test

cleanup() {
  "${AS_PG[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -s -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

mkdir -p "$SOCKET"
if [ "${#AS_PG[@]}" -gt 0 ]; then chmod 777 "$SOCKET"; fi
"${AS_PG[@]}" "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 >/dev/null
if ! "${AS_PG[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -s -l "$WORKDIR/server.log" \
  -o "-k $SOCKET -c listen_addresses=''" -w start >/dev/null; then
  echo "postgres failed to start:" >&2
  cat "$WORKDIR/server.log" >&2 || true
  exit 1
fi
"${AS_PG[@]}" "$PGBIN/createdb" -h "$SOCKET" -U postgres "$DB"

psql() { "${AS_PG[@]}" "$PGBIN/psql" -h "$SOCKET" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ supabase shim"
psql -f "$ROOT/supabase/tests/00_supabase_shim.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  [ -s "$migration" ] || continue
  echo "→ $(basename "$migration")"
  psql -f "$migration"
done

for test in "$ROOT"/supabase/tests/*_test.sql; do
  [ -e "$test" ] || continue
  echo "→ $(basename "$test")"
  psql -f "$test"
done

echo "✓ schema applies cleanly and all schema tests pass"
