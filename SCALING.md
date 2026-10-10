# Going live, and what 100 concurrent users actually costs

Short answer: **yes, 100 people at once fits comfortably on free tiers** — but
only because of specific choices in the code, and the thing that breaks first
is not what most people expect. It is not CPU, not the database, and not
request counts. It is **photo egress** and **realtime fan-out**.

---

## 1 · What "100 simultaneous users" means here

100 people online is 50 couples. Each browser tab holds **one** websocket to
Supabase (the client multiplexes every channel over it), so:

|                      | At 100 concurrent                                                      |
| -------------------- | ---------------------------------------------------------------------- |
| Realtime connections | ~100 (one per open tab)                                                |
| Realtime free limit  | ~200 peak concurrent                                                   |
| Workers requests     | page loads + server functions only — data goes browser→Supabase direct |
| Workers free limit   | ~100,000/day                                                           |
| Database rows        | trivial — a year of 50 couples is a few MB                             |

Connections and requests are not close to the ceiling. Two other things are.

---

## 2 · The thing that breaks first: photo egress — **now fixed**

This is a photo app. Supabase free gives roughly **5 GB egress/month**, and
every image view streams from storage.

```
5 GB  ÷  100 users  =  ~50 MB per user per month
```

Images are resized client-side to a 2560px long edge before upload, so a photo
lands around 400 KB–1 MB. That was **50–120 photo views per user per month**
before the wall — a couple scrolling their own feed a few times a week passes
it. Both halves of the fix are now in place.

### Fixed: an ~800px derivative for anything card-sized

`prepareImage()` now writes two objects per upload: the 2560px original and an
800px WebP preview beside it at `<path>.preview.<ext>`. `SignedImage` fetches
the preview by default and only takes the original where someone is actually
looking at the photo (`variant="full"` — the moment page and the story
viewer). A feed card was pulling roughly ten times the bytes its pixels
needed.

The preview path is derived, not stored, so there is no column and no
backfill: uploads from before this change have no preview, the signed URL
404s, and the component falls back to the original.

### Fixed: Cloudflare in front of storage, for public photos

Public pages used to embed signed storage URLs. Those expire, so every
visitor got a fresh one and **no cache anywhere could hold a single byte** — a
moment shared a thousand times cost a thousand downloads out of Supabase.

Explore and public space pages now emit `/i/<storage path>`, handled by
`handlePublicMedia()` in `src/lib/public-media.server.ts` (dispatched from
`src/server.ts` before the renderer loads). It checks the path against the
database with the anonymous key — so row-level security, not our own
reasoning, decides whether a stranger may have it — then streams the object
with `max-age=600, s-maxage=3600`. Cloudflare's cache and bandwidth are
unmetered on the free plan, so repeat views cost Supabase nothing.

**The hour is deliberate.** Not `immutable`, even though the bytes never
change, because the permission can: un-publishing a moment or a moderator
taking one down has to actually stop it being served. One hour is the window
in which a taken-down public photo may still come from an edge cache. If you
need that to be zero, drop `s-maxage` and accept the egress, or purge the
Cloudflare cache as part of `moderate_post`.

Private photos are untouched by this — they still go through per-user signed
URLs, because a shared cache is exactly what they must not have. Private
egress is bounded by the two people in the space, which is the one case the
free tier handles comfortably.

---

## 3 · The thing that breaks second: realtime fan-out — **now fixed**

This one was a genuine bug, and it is the difference between "100 users is
fine" and "100 users melts the realtime server".

`post_media`, `post_reactions`, `post_comments` and `message_reactions` had no
`space_id`, so the client could not filter its subscription and subscribed to
**every row in those tables**. Row-level security still decided what each
client received — nothing leaked — but the realtime server had to evaluate
those policies **once per subscriber per change**.

```
cost per reaction  =  O(connected users)
total cost         =  O(users x writes)      ← grows with the product
```

At 100 users and 50 couples posting, one reaction cost 100 policy
evaluations. Double the users _and_ the activity and the work quadruples.

`20261010060000_realtime_scoping.sql` adds `space_id` to all four tables,
derived from the parent row by a trigger, and the client now subscribes with
`filter: space_id=eq.<id>`. Realtime applies the filter **before** the policy
check, so one reaction costs work for the two people in that space:

```
cost per reaction  =  O(1)
```

The column is set by the trigger, never by the client, so a forged
`space_id` cannot be used to subscribe to another couple's stream — there is a
test for exactly that in `supabase/tests/04_realtime_scoping_test.sql`.

**Also removed:** `useUnreadMessages` polled every 30 seconds on top of the
realtime invalidation that already covered it. At 100 users that was ~288,000
redundant queries a day for a number that was already live.

---

## 4 · Before you launch

Ordered by what will actually hurt.

### Must do

1. **Apply the migrations.** `supabase db push`. Nothing works without it.
2. **Turn email confirmation ON** in Supabase Auth. Off locally for
   convenience; off in production means anyone can register an address they do
   not own.
3. **Restrict the Maps keys** — browser key by HTTP referrer, server key by
   API — and set a **Google Cloud budget alert**. An unrestricted Maps key is
   the classic surprise bill.
4. **Rotate the exposed Maps key** if you have not. It was public.
5. **Set the Site URL and both redirect URLs** to the real origin, or sign-in
   and password reset both fail.

### Should do before real users

6. **A moderation surface.** `reports` and `user_roles` exist with **no UI**.
   `/explore` shows strangers' public moments with no way to report and no way
   to action a report. With 100 users this is the single most likely way
   things go badly — not a performance problem, a trust-and-safety one.
7. **Cloudflare in front of storage** (section 2). Egress is the wall.
8. **Uptime check.** Free: UptimeRobot or Cloudflare Health Checks. Without
   one you find out from a user.
9. **An error reporter.** `src/lib/error-reporting.ts` has a
   `setErrorReporter` hook and nothing plugged in. Sentry's free tier covers
   this scale.

### Watch

10. **Supabase pauses a free project after ~7 days idle.** With 100 active
    users this never fires. It will if your beta goes quiet.
11. **Database egress and storage** in the Supabase dashboard — the first
    number to move.

---

## 5 · Is the framework scalable?

Where it already is:

- **The database enforces the rules, not the client.** Row-level security
  scopes every table to a space; the two-person cap is enforced in both the
  join RPC and the policy. Adding a second client (a native app, say) inherits
  every rule for free.
- **Notifications fan out in Postgres**, on the write itself. A client that
  fails to call cannot skip them.
- **Counting happens in SQL.** `space_stats()` returns aggregates in one round
  trip instead of shipping rows to the browser to call `.length` on.
- **The feed is paginated** and the map query is narrow and capped.
- **Nitro means hosting is a flag.** `NITRO_PRESET=vercel|netlify|node-server`
  moves the whole app without touching code.
- **Every migration is tested** against a real Postgres in CI, so schema
  changes cannot silently break.
- **Public photos are cached at the edge and served downscaled** (section 2),
  which turns the first quota you would have hit into a non-event.
- **`/healthz` answers in under three seconds**, reporting `degraded` rather
  than hanging when the database is unreachable — so an uptime monitor
  catches a project paused for inactivity, which on the free tier happens
  after about a week idle.

Where it will need work, in the order it will bite:

| At roughly              | What gives                  | What to do                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **~500 users**          | Private-photo egress        | Public photos are already cached and downscaled (section 2); the remaining cost is private feeds. Extend the proxy to signed-in viewers with a per-user cache key, or move to Pro.                                                             |
| **~200 concurrent**     | Realtime connection cap     | Supabase Pro, or drop realtime on screens that do not need it                                                                                                                                                                                  |
| **~1,000 users**        | Supabase free DB and egress | Pro at $25/mo — still cheap at that size                                                                                                                                                                                                       |
| **Any public growth**   | Moderation                  | The queue from item 6 stops being optional                                                                                                                                                                                                     |
| **Daily-use retention** | No push notifications       | Web push: a `push_subscriptions` table, a service worker, VAPID keys, an edge function draining new notification rows. `notification_prefs.quiet_from`/`quiet_to` already exist and are deliberately unused until there is something to defer. |

Nothing above requires re-architecting. That is the useful property: the
scaling path is "turn things on", not "rewrite it".

---

## 6 · Honest limits of this document

These numbers are the right order of magnitude, but **none of this has been
load-tested**. There is no benchmark behind the 100-user figure — it is
arithmetic over published quotas and a reading of the query patterns. Before
you rely on it with real people:

```sh
npm run test:db      # schema correctness, which IS tested
curl -s https://your-app.workers.dev/healthz   # liveness, including the database
```

…then run something like k6 or Artillery against a staging project with a few
hundred seeded couples and watch the Supabase dashboard. Egress and realtime
messages are the two graphs that matter.

Quotas change. Confirm against
[supabase.com/pricing](https://supabase.com/pricing) and
[Cloudflare's Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
rather than trusting the numbers here.
