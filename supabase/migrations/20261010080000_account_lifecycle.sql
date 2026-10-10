-- ============================================================================
-- Account export and deletion.
--
-- GDPR and CCPA both require that someone can get their data out and have it
-- erased. Neither existed. Deletion was especially unanswered: a space is
-- shared, so "delete my account" raises a question the schema had no answer
-- to — what happens to moments the other person is also in?
--
-- The rule chosen here: a space belongs to both people, so one leaving does
-- not erase it. The leaver's account, profile and authorship are removed; the
-- shared moments stay with the partner, attributed to a deleted account. If
-- both leave, the last one out takes the space with them.
--
-- That is a product decision as much as a technical one, and it is written
-- down in PRIVACY.md so people can read it before they sign up.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Export
-- ---------------------------------------------------------------------------

/**
 * Everything this person's space holds, as one JSON document.
 *
 * Scoped to the caller's own space — there is no argument to point it
 * somewhere else. Storage objects are referenced by path rather than inlined;
 * the client turns those into signed download URLs.
 */
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me    UUID := auth.uid();
  _space UUID;
  _out   JSONB;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT space_id INTO _space FROM public.space_members WHERE user_id = _me LIMIT 1;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'format_version', 1,
    'account', (
      SELECT jsonb_build_object(
        'id', u.id, 'email', u.email, 'created_at', u.created_at,
        'display_name', p.display_name, 'handle', p.handle, 'bio', p.bio
      )
      FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = _me
    ),
    'space', (
      SELECT to_jsonb(s) - 'invite_code' FROM public.spaces s WHERE s.id = _space
    ),
    'members', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'display_name', p.display_name, 'joined_at', m.joined_at)), '[]'::jsonb)
      FROM public.space_members m JOIN public.profiles p ON p.id = m.user_id
      WHERE m.space_id = _space
    ),
    'moments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'moment', to_jsonb(po),
        'media', (SELECT COALESCE(jsonb_agg(to_jsonb(md)), '[]'::jsonb)
                    FROM public.post_media md WHERE md.post_id = po.id),
        'reactions', (SELECT COALESCE(jsonb_agg(to_jsonb(rx)), '[]'::jsonb)
                    FROM public.post_reactions rx WHERE rx.post_id = po.id),
        'comments', (SELECT COALESCE(jsonb_agg(to_jsonb(cm)), '[]'::jsonb)
                    FROM public.post_comments cm WHERE cm.post_id = po.id),
        'tags', (SELECT COALESCE(jsonb_agg(tg.tag), '[]'::jsonb)
                    FROM public.post_tags tg WHERE tg.post_id = po.id)
      ) ORDER BY po.taken_at DESC), '[]'::jsonb)
      FROM public.posts po WHERE po.space_id = _space
    ),
    'journal',    (SELECT COALESCE(jsonb_agg(to_jsonb(j)), '[]'::jsonb) FROM public.journal_entries j WHERE j.space_id = _space),
    'milestones', (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM public.milestones m WHERE m.space_id = _space),
    'messages',   (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM public.messages m WHERE m.space_id = _space),
    'bucket_list',(SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb) FROM public.bucket_list b WHERE b.space_id = _space),
    'places',     (SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM public.wishlist_places w WHERE w.space_id = _space),
    'countdowns', (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM public.countdowns c WHERE c.space_id = _space),
    'gifts',      (SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM public.gift_ideas g WHERE g.space_id = _space),
    'stories',    (SELECT COALESCE(jsonb_agg(to_jsonb(st)), '[]'::jsonb) FROM public.stories st WHERE st.space_id = _space),
    'games',      (SELECT COALESCE(jsonb_agg(to_jsonb(gr)), '[]'::jsonb) FROM public.game_rounds gr WHERE gr.space_id = _space),
    'achievements',(SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.achievements a WHERE a.space_id = _space),
    'notifications',(SELECT COALESCE(jsonb_agg(to_jsonb(n)), '[]'::jsonb) FROM public.notifications n WHERE n.user_id = _me),
    'notification_prefs', (SELECT to_jsonb(np) FROM public.notification_prefs np WHERE np.user_id = _me),
    'media_paths', (
      SELECT COALESCE(jsonb_agg(DISTINCT path), '[]'::jsonb) FROM (
        SELECT md.storage_path AS path FROM public.post_media md
          JOIN public.posts po ON po.id = md.post_id WHERE po.space_id = _space
        UNION
        SELECT st.storage_path FROM public.stories st WHERE st.space_id = _space
        UNION
        SELECT ms.storage_path FROM public.messages ms
          WHERE ms.space_id = _space AND ms.storage_path IS NOT NULL
        UNION
        SELECT je.photo_path FROM public.journal_entries je
          WHERE je.space_id = _space AND je.photo_path IS NOT NULL
      ) paths
    )
  ) INTO _out;

  RETURN _out;
END; $$;

REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

-- ---------------------------------------------------------------------------
-- Deletion
-- ---------------------------------------------------------------------------

-- Authorship columns point at auth.users with ON DELETE CASCADE, which would
-- take the couple's shared moments with the leaver. Posts, comments, messages
-- and journal entries are joint history, so they survive with a null author.
ALTER TABLE public.posts            DROP CONSTRAINT IF EXISTS posts_author_id_fkey;
ALTER TABLE public.posts            ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.posts            ADD CONSTRAINT posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users ON DELETE SET NULL;

ALTER TABLE public.post_comments    DROP CONSTRAINT IF EXISTS post_comments_author_id_fkey;
ALTER TABLE public.post_comments    ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.post_comments    ADD CONSTRAINT post_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users ON DELETE SET NULL;

ALTER TABLE public.messages         DROP CONSTRAINT IF EXISTS messages_author_id_fkey;
ALTER TABLE public.messages         ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.messages         ADD CONSTRAINT messages_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users ON DELETE SET NULL;

ALTER TABLE public.journal_entries  DROP CONSTRAINT IF EXISTS journal_entries_author_id_fkey;
ALTER TABLE public.journal_entries  ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.journal_entries  ADD CONSTRAINT journal_entries_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users ON DELETE SET NULL;

ALTER TABLE public.milestones       DROP CONSTRAINT IF EXISTS milestones_created_by_fkey;
ALTER TABLE public.milestones       ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.milestones       ADD CONSTRAINT milestones_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users ON DELETE SET NULL;

/**
 * Erase the caller's account.
 *
 * Personal records go; shared history stays with the partner, de-attributed.
 * If this was the last member, the space and everything in it goes too —
 * cascades from spaces handle that.
 *
 * Irreversible, and the client confirms before calling.
 */
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me       UUID := auth.uid();
  _space    UUID;
  _others   INTEGER;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT space_id INTO _space FROM public.space_members WHERE user_id = _me LIMIT 1;

  IF _space IS NOT NULL THEN
    DELETE FROM public.space_members WHERE space_id = _space AND user_id = _me;

    SELECT count(*) INTO _others FROM public.space_members WHERE space_id = _space;

    -- Last one out: nobody is left to own it, so it goes.
    IF _others = 0 THEN
      DELETE FROM public.spaces WHERE id = _space;
    ELSE
      -- Someone remains. Their space must not keep pointing at a ghost, and a
      -- stale invite code must not outlive the person who shared it.
      UPDATE public.spaces
         SET created_by = (SELECT user_id FROM public.space_members
                            WHERE space_id = _space LIMIT 1),
             invite_code_expires_at = now()
       WHERE id = _space AND created_by = _me;
    END IF;
  END IF;

  -- Things that are only ever personal.
  DELETE FROM public.notifications      WHERE user_id = _me;
  DELETE FROM public.notification_prefs WHERE user_id = _me;
  DELETE FROM public.post_reactions     WHERE user_id = _me;
  DELETE FROM public.message_reactions  WHERE user_id = _me;
  DELETE FROM public.story_views        WHERE user_id = _me;
  DELETE FROM public.reports            WHERE reporter_id = _me;
  DELETE FROM public.user_roles         WHERE user_id = _me;
  DELETE FROM public.profiles           WHERE id = _me;

  -- Removing the auth row de-attributes the shared history via SET NULL.
  DELETE FROM auth.users WHERE id = _me;
END; $$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
