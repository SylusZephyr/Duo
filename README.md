# Duo

A private social app for two. A shared feed of moments, a world map of the
places you have been, a journal with sealed letters you can date into the
future, a chat, games, countdowns and the milestones worth keeping — all
private between the two of you, until you choose to make something public.

**Live app**: https://evasive.lovable.app

See [ROADMAP.md](./ROADMAP.md) for where this is and what is still missing.

## Stack

TanStack Start (React 19) · Tailwind 4 · shadcn/ui · Supabase (Postgres, Auth,
Storage, Realtime) · deployed on Cloudflare via Nitro.

Most of the product rules live in the database: row-level security scopes every
table to a space, a space is capped at two members by both the join RPC and the
policy, and notifications are fanned out by triggers rather than by the client.

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

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
npm install
npm run dev
```
