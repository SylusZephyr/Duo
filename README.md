# Duo

A private social app for two. A shared feed of moments, a world map of the
places you have been, a journal with sealed letters you can date into the
future, a chat, games, countdowns and the milestones worth keeping — all
private between the two of you, until you choose to make something public.

See [ROADMAP.md](./ROADMAP.md) for where this is and what is still missing.

## Stack

TanStack Start (React 19) · Tailwind 4 · shadcn/ui · Supabase (Postgres, Auth,
Storage, Realtime) · Google Maps · built with Nitro, deployable to Cloudflare.

There is no platform SDK in the dependency tree. The Vite config is written out
in full, Google sign-in goes through Supabase Auth, the map calls Google's APIs
directly from server functions, and error reporting is a local module with one
hook to plug a real service into. Nothing here depends on a hosting vendor.

Most of the product rules live in the database: row-level security scopes every
table to a space, a space is capped at two members by both the join RPC and the
policy, and notifications are fanned out by triggers rather than by the client.

## Setup

```sh
npm install
cp .env.example .env    # then fill it in
npm run dev
```

`.env.example` documents every variable and why the two Google Maps keys are
separate. Supabase Auth also needs Google enabled as a provider, with
`https://your-domain/auth/callback` in its redirect allow-list.

## Checks

```sh
npm run verify     # lint + typecheck + unit tests
npm run test:db    # applies every migration to a throwaway Postgres, then runs schema tests
npm run build
```

`npm run test:db` needs a local `postgresql-16` and never touches a real
project: it starts a cluster in a temp directory, applies
`supabase/migrations/*.sql` behind a small Supabase shim, runs the assertions
in `supabase/tests/`, and throws the cluster away. CI runs all of it.

## Database changes

Migrations are plain SQL in `supabase/migrations/`, applied in filename order.
Add one, run `npm run test:db` until it is green, then apply it to the project
with `supabase db push`. **A migration in the repo is not a migration in
production** — the schema tests prove it applies, not that it has been applied.

## Deploying

`npm run build` produces a Nitro bundle under `.output`, targeting
`cloudflare-module` by default. Set `NITRO_PRESET` to build for anywhere else
Nitro supports — `node-server`, `vercel`, `netlify` and so on — without
touching the config.

Environment variables come from the host's own settings, not from `.env`,
which is gitignored.
