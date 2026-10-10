-- ============================================================================
-- Server-side aggregates for a space.
--
-- /us and /map both read the feed query, which selects every post in a space
-- with its media, reactions, tags and every comment row — only to count them.
-- At a few dozen moments that is invisible. At a couple of years of daily
-- posting it is megabytes over the wire on every visit to the page, and it
-- grows without bound.
--
-- Counting belongs in the database. This returns the numbers /us needs in one
-- round trip, plus the recent distinct posting dates, so the streak can still
-- be worked out by the tested function in src/lib/achievements.ts rather than
-- being reimplemented here in SQL.
-- ============================================================================

CREATE INDEX IF NOT EXISTS posts_space_taken_idx
  ON public.posts (space_id, taken_at DESC, created_at DESC);

-- /map only wants the geotagged ones.
CREATE INDEX IF NOT EXISTS posts_space_located_idx
  ON public.posts (space_id)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE TYPE public.space_stats_result AS (
  moments INTEGER,
  cities INTEGER,
  countries INTEGER,
  journal_entries INTEGER,
  milestones INTEGER,
  places_pinned INTEGER,
  bucket_done INTEGER,
  bucket_total INTEGER,
  first_moment_at DATE,
  posting_dates DATE[]
);

/**
 * Aggregates for one space, for the member asking.
 *
 * posting_dates is capped at the most recent 400 distinct days: long enough
 * that no realistic streak is cut short, short enough that the payload cannot
 * grow with the couple's whole history.
 */
CREATE OR REPLACE FUNCTION public.space_stats(_space_id UUID)
RETURNS public.space_stats_result
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result public.space_stats_result;
BEGIN
  IF NOT public.is_space_member(_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not your space';
  END IF;

  SELECT
    count(*)::int,
    count(DISTINCT city)::int,
    count(DISTINCT country)::int,
    min(taken_at)
  INTO
    _result.moments,
    _result.cities,
    _result.countries,
    _result.first_moment_at
  FROM public.posts
  WHERE space_id = _space_id;

  SELECT count(*)::int INTO _result.journal_entries
    FROM public.journal_entries WHERE space_id = _space_id;

  SELECT count(*)::int INTO _result.milestones
    FROM public.milestones WHERE space_id = _space_id;

  SELECT count(*)::int INTO _result.places_pinned
    FROM public.wishlist_places WHERE space_id = _space_id;

  SELECT
    count(*) FILTER (WHERE done)::int,
    count(*)::int
  INTO _result.bucket_done, _result.bucket_total
  FROM public.bucket_list WHERE space_id = _space_id;

  SELECT COALESCE(array_agg(taken_at ORDER BY taken_at DESC), '{}')
  INTO _result.posting_dates
  FROM (
    SELECT DISTINCT taken_at
    FROM public.posts
    WHERE space_id = _space_id
    ORDER BY taken_at DESC
    LIMIT 400
  ) recent;

  RETURN _result;
END; $$;

REVOKE EXECUTE ON FUNCTION public.space_stats(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.space_stats(UUID) TO authenticated;
