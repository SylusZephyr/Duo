# Roadmap

An honest account of where this app is, what was fixed, and what is still
between it and thousands of paying couples.

## Where it started

The app was further along than its commit history suggests. Typecheck and
build were clean, the data layer was well written — optimistic reaction and
comment updates with rollback, realtime per-space channels, row-level security
enforcing the two-person cap in both the join RPC and the policy — and the
schema covered far more than the UI used.

The problems were not missing screens. They were **loops that did not close**:
things the database was ready for that nothing in the product ever completed.

## Done

### The retention loop

`notifications`, `notification_prefs` and a realtime hook all existed, and
**nothing rendered them**. Only `/compose` ever wrote a notification, so a
comment, a reaction, a journal entry, a milestone, a story, a game round or a
completed bucket-list item produced silence. For an app whose whole premise is
two people paying attention to each other, the engagement engine was switched
off.

Fan-out moved into the database, on the write itself, so it cannot be skipped
by a client that fails to call. There is now an inbox, a bell with an unread
count on every screen, and a preferences panel.

### The progression loop

The `achievements` table was never written to. Badges were recomputed in the
browser on every render, which means nothing was ever _unlocked_: no moment,
no date, and the partner never found out. Reaching a badge now writes the row
that dates it and tells both of them.

### Scale

`useMoments` selected every post in a space — with its media, reactions, tags
and every comment row — and `/feed`, `/map` and `/us` all shared it. At a
couple of years of daily posting that is megabytes on every navigation,
growing without bound. Each screen now asks for what it needs: a paged feed,
a narrow geotagged query for the map, and a server-side aggregate for the
counts.

### Privacy and account safety

Invite codes were generated in the browser with `Math.random()` and never
expired — a code screenshotted into a group chat stayed valid forever. Codes
are now server-generated, unguessable, expiring, rotatable, and spent once the
pair is complete. Space creation became atomic, so a half-failed signup can no
longer leave someone locked out of a space only they own.

There was no password recovery at all. There is now.

### Engineering

No test runner, no CI, and `npm run lint` failing with 1240 errors — all
formatting, so the gate had never once been run. There are now 79 unit tests,
three SQL test suites that run every migration against a real Postgres, and CI
running lint, typecheck, tests, schema tests and a build on every push.

## Next, in the order I would do it

### 1. A reason to open it today

This is the product problem, and it is bigger than any of the engineering
above. The app has _more_ features than it needs — chat, games, dates,
journal, map, stories, bucket list — and no daily hook. The daily prompt
exists but is a passive link on the feed. Streaks are computed and never shown
or defended.

Concretely: put the prompt front and centre with both answers revealed only
once both have answered; surface the streak and warn before it breaks; make
the "on this day" memory a first-class screen. None of this needs new tables.

### 2. Web push

The inbox is in-app only. `notification_prefs.quiet_from` / `quiet_to` already
exist and are deliberately unused — they describe when a device may buzz, which
only means something once push exists. This needs a `push_subscriptions` table,
a service worker, a VAPID key pair, and an edge function that drains new
notification rows. Quiet hours should be honoured there, not by suppressing the
inbox row.

### 3. Moderation, before `/explore` is promoted

The `reports` and `user_roles` tables exist with **no surface at all**: no way
to report a public moment, and no way to action a report. Today `/explore`
shows public moments from strangers with nothing behind it. Shipping that to
thousands of users without a report button and a queue is the single most
likely way this ends up in an app-store removal or a news story.

### 4. Account lifecycle

GDPR/CCPA need export and deletion. Deletion is mostly there via
`ON DELETE CASCADE`, but a shared space raises a genuine question the schema
does not answer: when one partner deletes their account, what happens to
moments the other person is in? That is a product decision before it is a
migration.

### 5. Payments

Nothing exists. The natural line is storage: free tier capped, paid tier for
unlimited photos and full-resolution originals. Needs Stripe, a `subscriptions`
table, and quota enforcement in RLS rather than only in the UI.

### 6. Media pipeline

Photos are resized in the browser and uploaded straight to Supabase storage.
That is fine at this size and will not stay fine — originals are never kept,
there are no server-side derivatives, and signed URLs are minted per render.
A transform/CDN layer is the fix, when the bill says so.

## Known issues not yet addressed

- **`npm audit` reports vulnerabilities in transitive dependencies.** Each
  needs checking for a reachable path before bumping anything; `npm audit fix`
  on a lockfile this deep is as likely to break the build as to help.
- **The Google Maps keys need restricting.** The browser key ships in the page
  and cannot be hidden, so it needs an HTTP-referrer restriction in the Google
  Cloud console or it can be used from anywhere and billed to this project.
  The server key should be a separate, IP-restricted key rather than a copy of
  the browser one.
- **`albums` / `album_posts` have no UI.** Either build it or drop the tables;
  dead schema invites someone to assume it works.
- **No load test.** Nothing here has been run against a realistic dataset on a
  real Supabase instance. "Ready for thousands of couples" cannot honestly be
  claimed until it has been.
- **No error budget or monitoring.** `src/lib/error-reporting.ts` normalises
  errors and logs them, with a `setErrorReporter` hook and nothing plugged
  into it. There is no alerting, no uptime check, and no dashboard.

## Running the checks

```sh
npm run verify     # lint + typecheck + unit tests
npm run test:db    # every migration applied to a throwaway Postgres, plus schema tests
npm run build
```

`npm run test:db` needs a local `postgresql-16` (`PGBIN` overrides the path).
It never touches a real project.
