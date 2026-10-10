# Duo v2 — from prototype to shippable product

The current build has the skeleton: pairing, feed, map, journal, milestones, public pages. What it lacks is the depth, polish, safety and reliability of a product you could sell. This plan closes that gap in six phases, each independently shippable.

## Phase 1 — Foundation hardening (do first)

- **Real-time everywhere.** Feed, comments, reactions, journal and typing indicators update live for both partners instead of on refresh.
- **Optimistic UI + offline queue.** Posting, reacting, commenting feel instant; uploads resume after a dropped connection.
- **Image pipeline.** Client-side downscale + EXIF strip on upload, blurhash placeholder stored per photo, responsive derivatives so the feed loads in under a second on mobile data. EXIF GPS is read for auto-place suggestion _before_ stripping, never stored silently.
- **Error, empty and loading states** for every screen: skeletons that match final layout, retry affordances, friendly failure copy. No blank screens.
- **Validation layer.** Zod schemas shared between client and server functions for every write path; length limits, file-type and size limits, rate limits per user.
- **Accessibility & responsiveness.** Keyboard paths, focus rings, contrast, reduced-motion support, safe-area handling, tablet/desktop layouts (not just a stretched phone).
- **Installable app.** Manifest, icons, splash, standalone display so it lives on the home screen.

## Phase 2 — Security & privacy (non-negotiable for launch)

- **Full RLS audit** of every table and every policy path, including the anon path, plus explicit grants. Automated security scan run and all critical findings resolved before publish.
- **Signed-URL discipline.** Short-lived signed media URLs, per-space path enforcement, no public bucket leakage of private photos; public posts get a separate derivative.
- **Sealed journal enforced server-side.** Unlock dates are checked in the database, not hidden in the UI.
- **Account safety.** Leaked-password protection, email verification, session list, password change, 2FA-ready auth surface.
- **Data rights.** Export everything (photos + text as a zip), delete account with full cascade, leave space, block/unpair flow with a clear explanation of what the other person keeps.
- **Public exposure controls.** Coordinate fuzzing on public posts, opt-in public handle, per-post and per-space kill switch, `noindex` on all private routes.
- **Abuse handling** on the public feed: report, hide, moderation queue behind an admin role stored in a separate `user_roles` table with a security-definer role check.
- **Legal pages** owned by you: privacy, terms, security contact, plus a cookie/analytics notice.

## Phase 3 — The features that make it a product

**Feed & moments**

- Multi-photo carousels with captions per photo, video support, albums/trips grouping, "On this day" resurfacing, collaborative posts (both credited), drafts, scheduled posts, edit history.
- Reactions beyond one emoji, threaded comments, voice notes on a moment.
- Search and filters: by place, person, mood, tag, date range; saved views.

**Map**

- Pin clustering that breaks apart on zoom, heatmap mode, country/city counters with a "passport" view, trip routes drawn between chronological pins, place detail pages aggregating every photo taken there, "want to go" wishlist pins, offline map tiles for travel.

**Journal**

- Rich text, prompts of the day, sealed letters with unlock notifications, mood tracking with a gentle chart, shared vs. solo entries, monthly recaps, calendar heat view.

**Us — relationship layer**

- Milestones with countdowns and anniversary reminders, streaks, badges with real progression, yearly "wrapped" recap generated from real data, shared bucket list with checkoff, questions-of-the-day ritual, a shared countdown widget for upcoming trips.

**Public side**

- Curated Moments feed, couple profile page with cover and stats, share cards rendered for link previews, follow-free by design (no vanity metrics), embeddable public trip pages.

**Notifications**

- Email and push for: partner posted, comment, reaction, sealed letter unlocked, anniversary tomorrow, streak at risk. Per-category preferences and quiet hours.

**Monetization**

- Free tier with limits (storage, video length, sealed letters); Duo+ subscription unlocking unlimited storage, video, printed photo-book export, offline maps, advanced recaps. Billing, upgrade/downgrade, receipts, and gating enforced server-side.

## Phase 4 — Design system, done properly

The current styling is a start, not a system. I'll rebuild it as a real design language before layering features on:

- **Tokens**: a full semantic scale — surfaces, elevation, text hierarchy, borders, states, accents — defined once in CSS, dark-first with a light theme, no hardcoded colors anywhere.
- **Type scale** with real optical sizing for display, headline, body, caption, mono.
- **Component library**: buttons, inputs, sheets, dialogs, tabs, chips, carousels, cards, toasts, empty states, avatars, badges — all variant-driven so screens compose instead of improvise.
- **Motion language**: shared-element transitions between feed and detail, sheet physics, image reveal on load, restrained and reduced-motion aware.
- **Photography-first layout rules**: consistent aspect ratios, gutters, dark chrome that recedes, one warm accent used sparingly.

Before I rebuild the visual layer I'll show you three rendered design directions for the feed screen and you pick one — that keeps the look intentional rather than accumulated.

## Phase 5 — Quality gates

- Automated tests on the critical paths: auth, pairing, upload, visibility toggle, RLS boundaries (a member of space A must never read space B).
- Seeded demo space so screens are never empty in review.
- Performance budget: image weight, bundle size, first paint on mid-range mobile.
- SEO and share metadata per public route; sitemap; structured data on public profile pages.
- Analytics on funnels (signup, pairing, first post) with privacy-respecting collection.

## Phase 6 — Launch readiness

Onboarding tour, in-app help and feedback, changelog, status/incident copy, support email, app store-ready marketing page, and a publish checklist run end to end.

## Technical notes

- Data access consolidated behind typed server functions with shared Zod validators; client hooks become thin wrappers with query keys per entity so real-time invalidation is precise.
- New tables: `post_tags`, `albums`, `album_posts`, `places`, `wishlist_places`, `bucket_list`, `prompts`, `prompt_answers`, `notifications`, `notification_prefs`, `reports`, `user_roles`, `subscriptions`. Each with grants, RLS, and space-scoped policies via the existing `is_space_member` helper.
- Media derivatives and blurhash generated on upload; storage paths stay space-scoped and private.
- Notifications delivered via scheduled public API routes with signature verification, plus email templates.
- Billing through a payment provider with server-side entitlement checks; no client-trusted plan state.

## Sequencing

I recommend building in this order: Phase 1 → 2 → 4 (design) → 3 (features, in the order Feed, Map, Journal, Us, Public, Notifications) → 5 → 6. Foundations and security first, design language before feature sprawl, monetization last.

## What I need from you

Tell me if the free/paid split above is right, whether video and notifications are in scope for the first sellable version, and I'll start with Phase 1 plus the three design directions.
