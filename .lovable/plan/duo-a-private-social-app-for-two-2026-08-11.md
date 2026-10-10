# Duo — a private social app for two

An Instagram-grade app for couples: a shared private feed, a world map of places visited together, journaling, milestones, and an optional public toggle per post.

## What gets built (v1)

**Onboarding & pairing**
- Sign up with email/password + Google sign-in.
- Create a "space" and invite your partner with a short code or link. A space holds exactly two people.
- Anniversary date set during setup (powers milestones and streaks).

**Private feed**
- Post one or more photos with a caption, date, optional place, and optional mood.
- Reverse-chronological feed with big, edge-to-edge imagery; tap into a full post view with reactions and threaded comments between the two of you.
- Each post has a visibility switch: Private (default) or Public.

**World map**
- Google Maps world view with a pin for every post that has a place.
- Pinch/scroll to zoom from globe down to street level; clusters break apart as you zoom.
- Tapping a pin opens the photos taken there. Counters for countries and cities visited together.

**Journal**
- Written entries, optionally with a photo, separate from the feed.
- Two modes: shared (both can read) and sealed (private until a chosen unlock date).
- Calendar and list views.

**Milestones & achievements**
- Manual milestones (first date, first trip, moving in) with photo and date.
- Automatic badges: 10/50/100 posts, 5 cities, 3 countries, 30-day posting streak, anniversary years.
- A vertical timeline that mixes milestones and badges.

**Public side**
- Posts marked public appear in a global "Moments" feed and on the couple's public profile page (`/c/handle`), with their own share metadata for link previews.
- Public viewers see photos, caption, place, and couple handle only — no comments, no journal, no exact coordinates.

## Design

I'll propose three rendered design directions before building, then implement the one you pick. The target is a high-end photo-first product: near-black canvas so photography carries the color, one warm accent, generous type, restrained motion, and no stock-template feel. Photos are the interface; chrome stays out of the way.

## Technical notes

- Lovable Cloud for database, auth, and photo storage. Google Maps (managed) for the map.
- Tables: `profiles`, `spaces`, `space_members`, `posts`, `post_media`, `post_reactions`, `post_comments`, `journal_entries`, `milestones`, `achievements`, `places`.
- RLS scopes every private row to members of the space via a security-definer `is_space_member()` helper; a narrow `TO anon` SELECT policy exposes only public posts and public profile fields.
- Private photos live in a private storage bucket read through signed URLs; public posts also get a public derivative.
- Data access goes through TanStack server functions; protected screens live under the authenticated route gate, the public feed and profile pages stay server-rendered for shareable link previews.

## Build order

1. Cloud + schema + RLS, auth and pairing flow.
2. Design directions, then the design system and app shell.
3. Private feed with uploads, reactions, comments.
4. Map with pins and zoom.
5. Journal.
6. Milestones and achievements.
7. Public toggle, global feed, public profile pages.

## Not in v1

Chat/DMs, video, following other couples, notifications, native mobile builds. Easy to add later.
