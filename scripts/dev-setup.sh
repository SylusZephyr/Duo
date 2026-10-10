#!/usr/bin/env bash
# One command to get Duo running on localhost with a full local backend.
#
#   ./scripts/dev-setup.sh
#
# Starts Postgres, Auth, Storage and Studio in Docker, applies every
# migration, loads the demo couple, and writes .env pointing at them. No
# Supabase account, no cloud project, no API keys required.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

bold "1/5  Checking what's installed"

command -v node >/dev/null || fail "Node.js is not installed — https://nodejs.org (v20 or newer)"
node_major=$(node -p "process.versions.node.split('.')[0]")
[ "$node_major" -ge 20 ] || fail "Node $node_major is too old; this needs v20 or newer."
echo "     node $(node -v)"

command -v docker >/dev/null || fail \
  "Docker is not installed. The local backend runs in it — https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || fail \
  "Docker is installed but not running. Start Docker Desktop (or the daemon) and try again."
echo "     docker ok"

if ! command -v supabase >/dev/null; then
  cat >&2 <<'MSG'
The Supabase CLI is not installed. Pick one:

  macOS / Linux   brew install supabase/tap/supabase
  Windows         scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
                  scoop install supabase
  any             npm install -g supabase

Then run this script again.
MSG
  exit 1
fi
echo "     supabase $(supabase --version 2>/dev/null | head -1)"

bold "2/5  Installing dependencies"
npm install --no-audit --no-fund

bold "3/5  Starting the local backend (first run pulls images — a few minutes)"
supabase start

bold "4/5  Applying migrations and loading the demo data"
# db reset replays supabase/migrations/* then runs supabase/seed.sql.
supabase db reset

bold "5/5  Writing .env"
# `supabase status -o env` prints the locally generated keys. They are the
# same on every machine — they are not secrets and never leave your computer.
eval "$(supabase status -o env | sed 's/^/LOCAL_/')"

cat > .env <<ENV
# Written by scripts/dev-setup.sh — points at your local Supabase.
# Delete this file and re-run the script to regenerate it.
VITE_SUPABASE_URL=${LOCAL_API_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${LOCAL_ANON_KEY}
VITE_SUPABASE_PROJECT_ID=duo

SUPABASE_URL=${LOCAL_API_URL}
SUPABASE_PUBLISHABLE_KEY=${LOCAL_ANON_KEY}
SUPABASE_PROJECT_ID=duo

# Maps is optional. Without a key the app runs and only the map screen is
# limited. See .env.example for how to get one and how to restrict it.
# VITE_GOOGLE_MAPS_BROWSER_KEY=
# GOOGLE_MAPS_API_KEY=
ENV

cat <<DONE

$(bold "Ready.")

  npm run dev        then open  http://localhost:8080

  Sign in as         alex@example.com  /  password123
  or their partner   sam@example.com   /  password123

  Supabase Studio    http://localhost:54323     (browse the tables)
  Email catcher      http://localhost:54324     (reset links land here)

  supabase stop      shut the backend down
  supabase db reset  wipe and reload the demo data

DONE
