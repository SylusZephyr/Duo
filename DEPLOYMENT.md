# Running Duo

Two ways: **locally**, with everything on your machine and no accounts at all,
or **hosted**, on free tiers.

---

# Part 1 · Localhost

Nothing here costs money or needs an account. You get real Postgres, real
auth, real file storage and a demo couple with a year of history.

## Install three things

|                    |                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **Node.js 20+**    | https://nodejs.org                                                                            |
| **Docker Desktop** | https://docs.docker.com/get-docker/ — the backend runs inside it. Start it before continuing. |
| **Supabase CLI**   | `brew install supabase/tap/supabase`, or `npm install -g supabase`, or Scoop on Windows       |

## Then one command

```sh
git clone https://github.com/SylusZephyr/Duo.git
cd Duo
./scripts/dev-setup.sh
```

It checks your tooling, installs packages, boots the backend, applies every
migration, loads the demo data and writes `.env` for you. First run pulls
Docker images and takes a few minutes; after that it is seconds.

```sh
npm run dev
```

Open **http://localhost:8080** and sign in:

```
alex@example.com   password123
sam@example.com    password123
```

Both are in the same space, so sign in as one in a normal window and the other
in a private window to watch realtime, chat and notifications work between
them.

| Also running           |                                                                          |
| ---------------------- | ------------------------------------------------------------------------ |
| http://localhost:54323 | Supabase Studio — browse and edit the tables                             |
| http://localhost:54324 | Email catcher — password reset links land here, nothing is actually sent |

| Command             |                                              |
| ------------------- | -------------------------------------------- |
| `supabase stop`     | shut the backend down                        |
| `supabase db reset` | wipe and reload the demo data                |
| `npm run verify`    | lint, typecheck, unit tests                  |
| `npm run test:db`   | every migration against a throwaway Postgres |

### Windows

Use **WSL2** and run everything inside it. Docker Desktop with the WSL2 backend
works; `./scripts/dev-setup.sh` is a bash script, so run it from the WSL shell
rather than PowerShell.

### If something breaks

**"Docker is installed but not running"** — start Docker Desktop and wait for
the whale icon to settle.

**Port already in use** — something else holds 54321-54324 or 8080. `supabase
stop` then `supabase start`, or change the ports in `supabase/config.toml`.

**Signed in but every screen is empty** — the seed did not load. `supabase db
reset`.

**The map is blank** — expected. Maps needs a Google key; everything else works
without one. See Part 2.

---

# Part 2 · Hosting it for free

Supabase free tier for the backend, Cloudflare Workers free tier for the app.
Roughly 30 minutes end to end.

Know the two real constraints before you start:

- **Supabase pauses a free project after about 7 days with no activity.** Your
  data is kept, but the app goes down until you restore it by hand from the
  dashboard. For a couples app in daily use this rarely triggers; for one you
  check monthly it will.
- **Cloudflare Workers free is about 100,000 requests/day**, resetting at
  00:00 UTC.

Both are generous for two people or a small beta. Confirm current numbers at
[supabase.com/pricing](https://supabase.com/pricing) and
[Cloudflare's Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
— these change.

## Step 1 · Supabase project

1. [database.new](https://database.new) → sign in with GitHub → **New project**.
2. Name it, set a **database password** (save it — you need it in step 2), pick
   the region closest to you, choose the **Free** plan.
3. Wait for it to provision.
4. **Project Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / publishable key** → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Reference ID** → `VITE_SUPABASE_PROJECT_ID`

The publishable key is meant to be in the browser. Row-level security, not key
secrecy, is what protects the data — and every table here has it.

Never copy the **service_role** key into this project. Nothing in the app
needs it and it bypasses every policy.

## Step 2 · Apply the database schema

Nothing works until this runs — no triggers, no `create_space()`, no
`space_stats()`.

```sh
supabase login
supabase link --project-ref YOUR_REFERENCE_ID
supabase db push
```

`db push` asks for the database password from step 1. It applies
`supabase/migrations/*` in order and never touches `seed.sql`, so no demo data
reaches production.

Verify in **Studio → Table Editor**: you should see `spaces`, `posts`,
`notifications`, `achievements` and the rest.

## Step 3 · Auth

**Authentication → URL Configuration**

- **Site URL** → your deployed origin, e.g. `https://duo.your-subdomain.workers.dev`
- **Redirect URLs** → add both:
  ```
  https://your-origin/auth/callback
  https://your-origin/reset-password
  ```

Without these, Google sign-in and password reset both bounce.

**Authentication → Providers → Email** — leave **Confirm email** ON in
production. It is off locally for convenience; on, it stops anyone registering
an address they do not own.

### Google sign-in (optional)

Email and password work without this. For Google:

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services
   → Credentials → Create OAuth client ID → Web application**.
2. Authorised redirect URI — copy the **callback URL** shown in Supabase's
   Google provider page (it looks like
   `https://YOUR_REF.supabase.co/auth/v1/callback`).
3. Paste the client ID and secret into Supabase → **Providers → Google** →
   enable.

## Step 4 · Google Maps (optional)

The map screen needs this; nothing else does. **Two separate keys**, because
they are exposed differently.

In [Google Cloud Console](https://console.cloud.google.com) → **APIs &
Services**:

1. Enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API**.
2. **Browser key** → `VITE_GOOGLE_MAPS_BROWSER_KEY`
   - Application restriction: **HTTP referrers** → your domain only
   - API restriction: **Maps JavaScript API** only
3. **Server key** → `GOOGLE_MAPS_API_KEY`
   - API restriction: **Places API (New)** + **Geocoding API**
   - Never goes in a `VITE_` variable — that would ship it to the browser

Set a **budget alert** on the Google Cloud project. A leaked, unrestricted Maps
key is the classic way to wake up to a bill.

## Step 5 · Deploy to Cloudflare

1. [dash.cloudflare.com](https://dash.cloudflare.com) → sign up (free).
2. Copy your **Account ID** from the dashboard sidebar.
3. **My Profile → API Tokens → Create Token → Edit Cloudflare Workers**
   template → create → copy the token.
4. In GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, add:

   | Secret                          | Value                  |
   | ------------------------------- | ---------------------- |
   | `CLOUDFLARE_API_TOKEN`          | from step 3            |
   | `CLOUDFLARE_ACCOUNT_ID`         | from step 2            |
   | `VITE_SUPABASE_URL`             | step 1                 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | step 1                 |
   | `VITE_SUPABASE_PROJECT_ID`      | step 1                 |
   | `VITE_GOOGLE_MAPS_BROWSER_KEY`  | step 4, or leave unset |

5. Push to `main`. `.github/workflows/deploy.yml` builds and deploys after CI
   passes. Or trigger it by hand from the **Actions** tab.

The `VITE_` values are compiled into the bundle at build time, which is why
they are build secrets rather than runtime settings.

### Server-side variables

`GOOGLE_MAPS_API_KEY` is read at runtime, not build time, so it goes on the
worker:

```sh
npx wrangler secret put GOOGLE_MAPS_API_KEY --config .output/server/wrangler.json
```

### Deploying by hand instead

```sh
npm run build
npx wrangler deploy --config .output/server/wrangler.json
```

### Somewhere other than Cloudflare

Nitro builds for many targets; set `NITRO_PRESET` and the rest is unchanged:

```sh
NITRO_PRESET=vercel npm run build
NITRO_PRESET=netlify npm run build
NITRO_PRESET=node-server npm run build   # then: node .output/server/index.mjs
```

## Step 6 · Close the loop

Once deployed, go back to **Step 3** and set the Site URL and redirect URLs to
the real origin Cloudflare gave you. Sign-in will not work until you do.

---

## Step 7 · Point a monitor at `/healthz`

```sh
curl -s https://your-app.workers.dev/healthz
# {"status":"ok","database":"ok","latency_ms":84,"checked_at":"..."}
```

`200 ok` means the Worker is serving **and** the database answered.
`503 degraded` means the Worker is up and Supabase is not — which is the
failure that will actually happen to you: a free-tier project pauses after
about a week with no traffic, and the app then looks broken for reasons the
dashboard does not volunteer. The check gives up after three seconds rather
than hanging, so any uptime service can poll it.

Free options: a Cloudflare Worker cron, UptimeRobot, or Better Stack. Polling
it every five minutes also keeps the Supabase project from idling into a
pause in the first place.

---

## Step 8 · Set the contact address on the legal pages

`/privacy` and `/terms` are live and linked from the landing page and from
settings. Both show `VITE_SUPPORT_EMAIL`, falling back to an obvious
placeholder — set it to an inbox you read, in both `.env` and your GitHub
secrets:

```
VITE_SUPPORT_EMAIL=you@your-domain.com
```

A privacy policy promising that data requests reach `support@example.com` is
worse than not having one. Read both pages once before launch: they describe
real behaviour, including that deleting an account leaves shared moments with
the partner, and you are the one standing behind that.

---

## Checklist

- [ ] Supabase project created, Free plan
- [ ] `supabase db push` run — tables visible in Studio
- [ ] Site URL and both redirect URLs set to the deployed origin
- [ ] Email confirmation **ON** in production
- [ ] Maps keys created and restricted, budget alert set (if using the map)
- [ ] All six GitHub secrets added
- [ ] Deploy workflow green
- [ ] Signed up on the live site and created a space
- [ ] `/healthz` returns `200 ok` from the deployed origin
- [ ] An uptime monitor polls it
- [ ] `VITE_SUPPORT_EMAIL` set, and `/privacy` and `/terms` read through
- [ ] Export and delete-account tried once on a throwaway account

## Costs

Everything above is free tier. You will pay when you outgrow Supabase's
database or egress allowance, exceed 100k Workers requests/day, or use enough
Maps calls to pass Google's monthly credit. For two people, none of that
happens.

## Sources

- [Supabase pricing](https://supabase.com/pricing)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Supabase local development](https://supabase.com/docs/guides/local-development)
