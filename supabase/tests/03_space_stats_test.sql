-- space_stats: the aggregates /us reads, and who may read them.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', _id::text, true);
$$;

DO $$
DECLARE
  _alex uuid;
  _mallory uuid;
  _space uuid;
  _stats public.space_stats_result;
BEGIN
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('alex@example.com', '{"display_name":"Alex"}') RETURNING id INTO _alex;
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('mallory@example.com', '{"display_name":"Mallory"}') RETURNING id INTO _mallory;

  PERFORM pg_temp.as_user(_alex);
  _space := (public.create_space('Alex & Sam')).id;

  -- An empty space reads as zeroes, not nulls, so the UI never shows blanks.
  _stats := public.space_stats(_space);
  ASSERT _stats.moments = 0, 'no moments yet';
  ASSERT _stats.cities = 0, 'no cities yet';
  ASSERT _stats.countries = 0, 'no countries yet';
  ASSERT _stats.journal_entries = 0, 'no entries yet';
  ASSERT _stats.bucket_total = 0, 'no list yet';
  ASSERT _stats.first_moment_at IS NULL, 'no first moment yet';
  ASSERT _stats.posting_dates = '{}', 'no posting dates yet';

  INSERT INTO public.posts (space_id, author_id, caption, taken_at, city, country)
  VALUES
    (_space, _alex, 'a', DATE '2026-03-15', 'Lisbon', 'Portugal'),
    (_space, _alex, 'b', DATE '2026-03-15', 'Lisbon', 'Portugal'),
    (_space, _alex, 'c', DATE '2026-03-14', 'Porto',  'Portugal'),
    (_space, _alex, 'd', DATE '2026-03-10', 'Madrid', 'Spain'),
    -- A moment with no place must not inflate the city or country counts.
    (_space, _alex, 'e', DATE '2026-03-09', NULL, NULL);

  _stats := public.space_stats(_space);
  ASSERT _stats.moments = 5, 'every moment counts: ' || _stats.moments;
  ASSERT _stats.cities = 3, 'distinct cities, nulls excluded: ' || _stats.cities;
  ASSERT _stats.countries = 2, 'distinct countries, nulls excluded: ' || _stats.countries;
  ASSERT _stats.first_moment_at = DATE '2026-03-09', 'the earliest moment dates the story';

  -- Posting dates are distinct and newest-first, which is what the streak
  -- function in TypeScript expects.
  ASSERT _stats.posting_dates = ARRAY[
    DATE '2026-03-15', DATE '2026-03-14', DATE '2026-03-10', DATE '2026-03-09'
  ], 'two posts on one day collapse to one date';

  INSERT INTO public.journal_entries (space_id, author_id, title) VALUES (_space, _alex, 'x');
  INSERT INTO public.milestones (space_id, created_by, title) VALUES (_space, _alex, 'm');
  INSERT INTO public.wishlist_places (space_id, created_by, name)
    VALUES (_space, _alex, 'Tokyo');
  INSERT INTO public.bucket_list (space_id, created_by, title, done)
    VALUES (_space, _alex, 'one', true), (_space, _alex, 'two', false);

  _stats := public.space_stats(_space);
  ASSERT _stats.journal_entries = 1, 'journal entries counted';
  ASSERT _stats.milestones = 1, 'milestones counted';
  ASSERT _stats.places_pinned = 1, 'wishlist places counted';
  ASSERT _stats.bucket_done = 1 AND _stats.bucket_total = 2,
    'the list counts done against total';

  -- The cap keeps the payload bounded however long they have been together.
  INSERT INTO public.posts (space_id, author_id, caption, taken_at)
  SELECT _space, _alex, 'bulk', DATE '2020-01-01' + n
  FROM generate_series(1, 600) AS n;

  _stats := public.space_stats(_space);
  ASSERT array_length(_stats.posting_dates, 1) = 400,
    'posting dates are capped at 400: ' || array_length(_stats.posting_dates, 1);
  ASSERT _stats.posting_dates[1] = DATE '2026-03-15',
    'the cap keeps the most recent dates, which is what a streak needs';
  ASSERT _stats.moments = 605, 'the count itself is not capped';

  -- Someone else's numbers are nobody else's business.
  PERFORM pg_temp.as_user(_mallory);
  BEGIN
    PERFORM public.space_stats(_space);
    RAISE EXCEPTION 'expected stats for a space you are not in to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%Not your space%', 'outsiders get nothing: ' || SQLERRM;
  END;

  RAISE NOTICE 'space_stats: ok';
END $$;

ROLLBACK;
