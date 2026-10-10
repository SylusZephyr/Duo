-- ============================================================================
-- Moderation.
--
-- `reports` and `user_roles` existed with no way to use them: a reporter could
-- file a report and then nobody — not even an admin — could read it, because
-- the only SELECT policy was "reporters can see their own". There was no
-- takedown either, so a public moment could not be removed from /explore
-- without deleting the couple's own post.
--
-- This adds the missing half: moderators can see the queue and act on it, a
-- takedown hides a post from the public without destroying it for the couple,
-- and every action is attributed and timestamped.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Takedown state on the post
-- ---------------------------------------------------------------------------

-- Deliberately not a delete. A moderator removing something from /explore must
-- not destroy a couple's own memory — it stops being public, nothing more.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_note TEXT;

COMMENT ON COLUMN public.posts.moderated_at IS
  'Set when a moderator removes the post from public view. The post remains
   fully visible to its own space.';

CREATE INDEX IF NOT EXISTS posts_moderated_idx
  ON public.posts (moderated_at) WHERE moderated_at IS NOT NULL;

/**
 * A post is public only if its author marked it public AND no moderator has
 * taken it down. Every public-facing path goes through this, so a takedown
 * takes effect everywhere at once.
 */
CREATE OR REPLACE FUNCTION public.is_post_public(_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id
      AND p.visibility = 'public'
      AND p.moderated_at IS NULL
  )
$$;

-- The RLS policy inlines the same rule rather than calling the function, so
-- the planner can still use posts_public_idx.
DROP POLICY IF EXISTS "Public posts are viewable by anyone" ON public.posts;
CREATE POLICY "Public posts are viewable by anyone" ON public.posts FOR SELECT
  USING (visibility = 'public' AND moderated_at IS NULL);

-- A space member must not be able to clear a takedown by editing their post.
DROP POLICY IF EXISTS "Members can update space posts" ON public.posts;
CREATE POLICY "Members can update space posts" ON public.posts FOR UPDATE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()))
  WITH CHECK (public.is_space_member(space_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_moderation_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only moderate_post() may change these. A normal UPDATE carries them over
  -- unchanged, however the client phrased it.
  IF current_setting('duo.moderating', true) IS DISTINCT FROM 'on' THEN
    NEW.moderated_at    := OLD.moderated_at;
    NEW.moderated_by    := OLD.moderated_by;
    NEW.moderation_note := OLD.moderation_note;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.protect_moderation_fields() FROM anon, authenticated;

DROP TRIGGER IF EXISTS posts_protect_moderation ON public.posts;
CREATE TRIGGER posts_protect_moderation BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.protect_moderation_fields();

-- ---------------------------------------------------------------------------
-- The report queue
-- ---------------------------------------------------------------------------

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution TEXT;

-- status moves open -> actioned | dismissed, and nothing else.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('open', 'actioned', 'dismissed'));

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_reason_check
  CHECK (reason IN ('sexual', 'violence', 'hate', 'harassment', 'minor', 'spam', 'other'));

CREATE INDEX IF NOT EXISTS reports_open_idx
  ON public.reports (created_at DESC) WHERE status = 'open';

/** Is this user allowed to work the queue? */
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'moderator') OR public.has_role(_user_id, 'admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_moderator(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_moderator(UUID) TO authenticated;

CREATE POLICY "Moderators can read every report" ON public.reports
  FOR SELECT TO authenticated USING (public.is_moderator(auth.uid()));

-- ---------------------------------------------------------------------------
-- Acting on a report
-- ---------------------------------------------------------------------------

/**
 * Take a post down, or restore it, and close the reports against it.
 *
 * SECURITY DEFINER with an explicit moderator check: the moderation columns
 * are otherwise frozen by the trigger above, so this is the only way they
 * move. _reason is free text for the audit trail, not shown to the couple.
 */
CREATE OR REPLACE FUNCTION public.moderate_post(
  _post_id UUID,
  _action TEXT,
  _reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator(auth.uid()) THEN
    RAISE EXCEPTION 'Not a moderator';
  END IF;

  IF _action NOT IN ('take_down', 'restore', 'dismiss') THEN
    RAISE EXCEPTION 'Unknown action: %', _action;
  END IF;

  PERFORM set_config('duo.moderating', 'on', true);

  IF _action = 'take_down' THEN
    UPDATE public.posts
       SET moderated_at = now(), moderated_by = auth.uid(), moderation_note = _reason
     WHERE id = _post_id;

    UPDATE public.reports
       SET status = 'actioned', reviewed_at = now(), reviewed_by = auth.uid(),
           resolution = _reason
     WHERE post_id = _post_id AND status = 'open';

  ELSIF _action = 'restore' THEN
    UPDATE public.posts
       SET moderated_at = NULL, moderated_by = NULL, moderation_note = NULL
     WHERE id = _post_id;

    UPDATE public.reports
       SET status = 'dismissed', reviewed_at = now(), reviewed_by = auth.uid(),
           resolution = COALESCE(_reason, 'Restored')
     WHERE post_id = _post_id AND status = 'open';

  ELSE -- dismiss: the report was not valid; the post was never touched
    UPDATE public.reports
       SET status = 'dismissed', reviewed_at = now(), reviewed_by = auth.uid(),
           resolution = COALESCE(_reason, 'No action needed')
     WHERE post_id = _post_id AND status = 'open';
  END IF;

  PERFORM set_config('duo.moderating', 'off', true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.moderate_post(UUID, TEXT, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_post(UUID, TEXT, TEXT) TO authenticated;

/**
 * The open queue, with the context a moderator needs to decide, in one call.
 * Returns nothing at all to a non-moderator rather than erroring, so the UI
 * can simply render an empty page.
 */
CREATE OR REPLACE FUNCTION public.moderation_queue()
RETURNS TABLE (
  post_id UUID,
  caption TEXT,
  taken_at DATE,
  place TEXT,
  space_handle TEXT,
  media_paths TEXT[],
  report_count BIGINT,
  reasons TEXT[],
  first_reported_at TIMESTAMPTZ,
  is_taken_down BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.caption,
    p.taken_at,
    NULLIF(concat_ws(' · ', p.place_name, p.city, p.country), ''),
    s.handle,
    COALESCE(array_agg(DISTINCT m.storage_path) FILTER (WHERE m.storage_path IS NOT NULL), '{}'),
    count(DISTINCT r.id),
    array_agg(DISTINCT r.reason),
    min(r.created_at),
    p.moderated_at IS NOT NULL
  FROM public.reports r
  JOIN public.posts p ON p.id = r.post_id
  JOIN public.spaces s ON s.id = p.space_id
  LEFT JOIN public.post_media m ON m.post_id = p.id
  WHERE r.status = 'open'
    AND public.is_moderator(auth.uid())
  GROUP BY p.id, p.caption, p.taken_at, p.place_name, p.city, p.country,
           s.handle, p.moderated_at
  ORDER BY count(DISTINCT r.id) DESC, min(r.created_at) ASC
$$;

REVOKE EXECUTE ON FUNCTION public.moderation_queue() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderation_queue() TO authenticated;

/** How many reports are waiting — for the badge in the UI. */
CREATE OR REPLACE FUNCTION public.open_report_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_moderator(auth.uid())
      THEN (SELECT count(DISTINCT post_id)::int FROM public.reports WHERE status = 'open')
    ELSE 0
  END
$$;

REVOKE EXECUTE ON FUNCTION public.open_report_count() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_report_count() TO authenticated;

/**
 * File a report.
 *
 * One row per (post, reporter), so repeat taps never inflate the queue. But a
 * reporter whose earlier report was resolved may raise it again: a post can be
 * edited after a dismissal, and a single "no action" must not immunise it
 * against the same person forever. Re-reporting an already-open report is a
 * no-op.
 */
CREATE OR REPLACE FUNCTION public.report_post(
  _post_id UUID,
  _reason TEXT,
  _details TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF NOT public.is_post_public(_post_id) THEN
    RAISE EXCEPTION 'That moment is not public';
  END IF;

  INSERT INTO public.reports (post_id, reporter_id, reason, details)
  VALUES (_post_id, auth.uid(), _reason, left(COALESCE(_details, ''), 1000))
  ON CONFLICT (post_id, reporter_id) DO UPDATE
    SET reason      = EXCLUDED.reason,
        details     = EXCLUDED.details,
        status      = 'open',
        created_at  = now(),
        reviewed_at = NULL,
        reviewed_by = NULL,
        resolution  = NULL
  WHERE public.reports.status <> 'open';
END; $$;

REVOKE EXECUTE ON FUNCTION public.report_post(UUID, TEXT, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_post(UUID, TEXT, TEXT) TO authenticated;
