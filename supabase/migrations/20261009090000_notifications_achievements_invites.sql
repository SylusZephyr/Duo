-- ============================================================================
-- Retention loop, shared achievements and safer invite codes.
--
-- Three problems this fixes:
--
-- 1. Notifications were written from the browser, by one call site (/compose).
--    A comment, a reaction, a journal entry or a milestone produced nothing, and
--    any notification could be skipped by a client that simply didn't call.
--    Fan-out now happens in the database, on the write itself.
--
-- 2. The achievements table was never written to. Badges were recomputed in the
--    browser on every render, so nothing was ever "unlocked" — there was no
--    moment, no record of when it happened, and the partner never heard about it.
--
-- 3. Invite codes were generated in the browser with Math.random(), inserted
--    directly, and never expired. A code screenshotted into a group chat stayed
--    valid forever, and space creation was two un-atomic inserts: a failed
--    membership insert left an orphaned space its creator could not see.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Notification plumbing
-- ---------------------------------------------------------------------------

-- The inbox is always read newest-first, filtered to one user.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- Partial index for the unread badge, which is read on every screen.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

-- Everyone gets a prefs row, so a missing row can never be mistaken for
-- "notifications off" (or vice versa) by whichever code path reads it.
INSERT INTO public.notification_prefs (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_prefs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

/**
 * Is this kind of notification switched on for this user?
 *
 * Unknown kinds default to on: a new notification kind should be visible until
 * someone deliberately adds a switch for it, not silently dropped.
 *
 * Quiet hours (quiet_from / quiet_to) deliberately do NOT suppress the row.
 * The in-app inbox is a record the couple can scroll back through; quiet hours
 * are about when a device may buzz, and belong to push delivery.
 */
CREATE OR REPLACE FUNCTION public.notification_kind_enabled(_user_id UUID, _kind TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefs public.notification_prefs;
BEGIN
  SELECT * INTO _prefs FROM public.notification_prefs WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  RETURN CASE _kind
    WHEN 'moment'      THEN _prefs.partner_posted
    WHEN 'story'       THEN _prefs.partner_posted
    WHEN 'journal'     THEN _prefs.partner_posted
    WHEN 'prompt'      THEN _prefs.partner_posted
    WHEN 'game'        THEN _prefs.partner_posted
    WHEN 'comment'     THEN _prefs.comments
    WHEN 'reaction'    THEN _prefs.reactions
    WHEN 'sealed'      THEN _prefs.sealed_unlocked
    WHEN 'milestone'   THEN _prefs.anniversaries
    WHEN 'achievement' THEN _prefs.streaks
    ELSE TRUE
  END;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notification_kind_enabled(UUID, TEXT) FROM anon, authenticated;

/** Display name for a notification body, with a safe fallback. */
CREATE OR REPLACE FUNCTION public.display_name_of(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(btrim(display_name), '') FROM public.profiles WHERE id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.display_name_of(UUID) FROM anon, authenticated;

/**
 * Notify everyone in a space except the actor. With the two-member cap that is
 * exactly one person today, but nothing here assumes it.
 *
 * Deliberately never raises: a notification must not be able to fail the write
 * that caused it. A couple would rather lose a bell than lose a photo.
 */
CREATE OR REPLACE FUNCTION public.notify_space(
  _space_id UUID,
  _actor_id UUID,
  _kind TEXT,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _link TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _space_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, space_id, kind, title, body, link)
  SELECT m.user_id, _space_id, _kind, _title, _body, _link
  FROM public.space_members m
  WHERE m.space_id = _space_id
    AND (_actor_id IS NULL OR m.user_id <> _actor_id)
    AND public.notification_kind_enabled(m.user_id, _kind);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_space(%, %) failed: %', _space_id, _kind, SQLERRM;
END; $$;

REVOKE EXECUTE ON FUNCTION
  public.notify_space(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM anon, authenticated;

/** Short preview of free text for a notification body. */
CREATE OR REPLACE FUNCTION public.preview_text(_text TEXT, _limit INT DEFAULT 90)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _text IS NULL OR btrim(_text) = '' THEN NULL
    WHEN length(btrim(_text)) <= _limit THEN btrim(_text)
    ELSE left(btrim(_text), _limit - 1) || '…'
  END
$$;

-- ---------------------------------------------------------------------------
-- Fan-out triggers
--
-- Each one answers "what would the other person want to know about?" and
-- nothing else. Chat messages are deliberately absent: the chat tab carries
-- its own unread count, and one bell per message would make the inbox useless.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.on_post_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id,
    NEW.author_id,
    'moment',
    COALESCE(public.display_name_of(NEW.author_id), 'Your person') || ' added a moment',
    public.preview_text(NEW.caption),
    '/moment/' || NEW.id
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS posts_notify ON public.posts;
CREATE TRIGGER posts_notify AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.on_post_created();

CREATE OR REPLACE FUNCTION public.on_comment_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _space_id UUID;
BEGIN
  SELECT space_id INTO _space_id FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.notify_space(
    _space_id,
    NEW.author_id,
    'comment',
    COALESCE(public.display_name_of(NEW.author_id), 'Your person') || ' replied',
    public.preview_text(NEW.body),
    '/moment/' || NEW.post_id
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS post_comments_notify ON public.post_comments;
CREATE TRIGGER post_comments_notify AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.on_comment_created();

CREATE OR REPLACE FUNCTION public.on_reaction_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _space_id UUID;
  _author_id UUID;
BEGIN
  SELECT space_id, author_id INTO _space_id, _author_id
  FROM public.posts WHERE id = NEW.post_id;

  -- A reaction is only news to the person whose moment it is.
  IF _author_id IS NULL OR _author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_space(
    _space_id,
    NEW.user_id,
    'reaction',
    COALESCE(public.display_name_of(NEW.user_id), 'Your person') || ' reacted ' || NEW.emoji,
    NULL,
    '/moment/' || NEW.post_id
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS post_reactions_notify ON public.post_reactions;
CREATE TRIGGER post_reactions_notify AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.on_reaction_created();

CREATE OR REPLACE FUNCTION public.on_journal_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id,
    NEW.author_id,
    'journal',
    CASE
      WHEN NEW.is_sealed
        THEN COALESCE(public.display_name_of(NEW.author_id), 'Your person')
             || ' sealed a letter for you'
      ELSE COALESCE(public.display_name_of(NEW.author_id), 'Your person')
             || ' wrote in the journal'
    END,
    -- A sealed letter must give nothing away before its date.
    CASE WHEN NEW.is_sealed THEN NULL ELSE public.preview_text(NULLIF(NEW.title, '')) END,
    '/journal'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS journal_entries_notify ON public.journal_entries;
CREATE TRIGGER journal_entries_notify AFTER INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.on_journal_created();

CREATE OR REPLACE FUNCTION public.on_milestone_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id, NEW.created_by, 'milestone',
    'New milestone: ' || NEW.title,
    public.preview_text(NEW.description),
    '/us'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS milestones_notify ON public.milestones;
CREATE TRIGGER milestones_notify AFTER INSERT ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.on_milestone_created();

CREATE OR REPLACE FUNCTION public.on_story_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id, NEW.author_id, 'story',
    COALESCE(public.display_name_of(NEW.author_id), 'Your person') || ' posted a story',
    public.preview_text(NULLIF(NEW.caption, '')),
    '/feed'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS stories_notify ON public.stories;
CREATE TRIGGER stories_notify AFTER INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.on_story_created();

CREATE OR REPLACE FUNCTION public.on_prompt_answered()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id, NEW.author_id, 'prompt',
    COALESCE(public.display_name_of(NEW.author_id), 'Your person')
      || ' answered today''s question',
    NULL,
    '/journal'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS prompt_answers_notify ON public.prompt_answers;
CREATE TRIGGER prompt_answers_notify AFTER INSERT ON public.prompt_answers
  FOR EACH ROW EXECUTE FUNCTION public.on_prompt_answered();

CREATE OR REPLACE FUNCTION public.on_game_round_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id, NEW.created_by, 'game',
    COALESCE(public.display_name_of(NEW.created_by), 'Your person') || ' started a round',
    public.preview_text(NEW.question),
    '/games'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS game_rounds_notify ON public.game_rounds;
CREATE TRIGGER game_rounds_notify AFTER INSERT ON public.game_rounds
  FOR EACH ROW EXECUTE FUNCTION public.on_game_round_created();

CREATE OR REPLACE FUNCTION public.on_game_answered()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id, NEW.user_id, 'game',
    COALESCE(public.display_name_of(NEW.user_id), 'Your person') || ' answered — see how you did',
    NULL,
    '/games'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS game_answers_notify ON public.game_answers;
CREATE TRIGGER game_answers_notify AFTER INSERT ON public.game_answers
  FOR EACH ROW EXECUTE FUNCTION public.on_game_answered();

CREATE OR REPLACE FUNCTION public.on_bucket_item_done()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.done AND NOT OLD.done THEN
    PERFORM public.notify_space(
      NEW.space_id, NEW.done_by, 'milestone',
      'Ticked off the list: ' || NEW.title,
      NULL,
      '/us'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS bucket_list_notify ON public.bucket_list;
CREATE TRIGGER bucket_list_notify AFTER UPDATE ON public.bucket_list
  FOR EACH ROW EXECUTE FUNCTION public.on_bucket_item_done();

-- ---------------------------------------------------------------------------
-- Achievements
--
-- Badge thresholds stay in TypeScript (src/lib/achievements.ts) so there is one
-- definition of them; the client records the keys it has earned. UNIQUE
-- (space_id, key) makes that idempotent, and the write — not the client — is
-- what tells the couple about it. An achievement belongs to both of them, so
-- unlike every trigger above this one notifies the actor as well.
-- ---------------------------------------------------------------------------

ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS earned_by UUID
  REFERENCES auth.users ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.on_achievement_earned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_space(
    NEW.space_id,
    NULL, -- both partners hear about it
    'achievement',
    'Badge unlocked',
    NEW.key, -- the client resolves the key to its title from BADGES
    '/us'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS achievements_notify ON public.achievements;
CREATE TRIGGER achievements_notify AFTER INSERT ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.on_achievement_earned();

-- The badge wall is read on every visit to /us.
CREATE INDEX IF NOT EXISTS achievements_space_earned_idx
  ON public.achievements (space_id, earned_at DESC);

-- ---------------------------------------------------------------------------
-- Sealed letters
--
-- A sealed letter whose date arrives is the one notification nobody's action
-- can trigger, so it needs a sweep. The function is idempotent — a letter is
-- announced once — and safe to call as often as you like.
-- ---------------------------------------------------------------------------

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS unlock_announced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS journal_pending_unlock_idx
  ON public.journal_entries (unlock_at)
  WHERE is_sealed AND unlock_announced_at IS NULL;

CREATE OR REPLACE FUNCTION public.announce_unlocked_letters()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry RECORD;
  _count INTEGER := 0;
BEGIN
  FOR _entry IN
    SELECT id, space_id, author_id
    FROM public.journal_entries
    WHERE is_sealed
      AND unlock_at IS NOT NULL
      AND unlock_at <= current_date
      AND unlock_announced_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.notify_space(
      _entry.space_id,
      NULL, -- the writer waited for this too
      'sealed',
      'A sealed letter just opened',
      NULL,
      '/journal'
    );
    UPDATE public.journal_entries
      SET unlock_announced_at = now()
      WHERE id = _entry.id;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.announce_unlocked_letters() FROM anon;
-- Any member may trigger the sweep (it only ever reveals their own letters).
GRANT EXECUTE ON FUNCTION public.announce_unlocked_letters() TO authenticated;

-- Letters sealed before this migration were never announced; treat the ones
-- already open as announced so nobody wakes up to a pile of old bells.
UPDATE public.journal_entries
  SET unlock_announced_at = now()
  WHERE is_sealed AND unlock_at IS NOT NULL AND unlock_at <= current_date
    AND unlock_announced_at IS NULL;

-- Preferred: run the sweep hourly server-side rather than relying on a client
-- opening the app. Enabled automatically where pg_cron is available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule('announce-unlocked-letters')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'announce-unlocked-letters');
    PERFORM cron.schedule(
      'announce-unlocked-letters',
      '7 * * * *',
      'SELECT public.announce_unlocked_letters()'
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable: sealed letters are announced when a client opens the journal.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Invite codes
--
-- Codes were generated in the browser with Math.random(), which is neither
-- unpredictable nor collision-safe, and they never expired. And creating a
-- space was two separate inserts: if the membership insert failed, the creator
-- was left locked out of a space only they owned.
-- ---------------------------------------------------------------------------

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS invite_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_code_rotated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.spaces.invite_code_expires_at IS
  'NULL means the code never expires. Codes issued from rotate_invite_code expire.';

/** Unguessable 8-character code from a crypto source, no look-alike glyphs. */
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  _alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  _code TEXT;
  _attempt INTEGER := 0;
BEGIN
  LOOP
    _code := '';
    FOR _i IN 1..8 LOOP
      _code := _code || substr(
        _alphabet,
        1 + (get_byte(gen_random_bytes(1), 0) % length(_alphabet)),
        1
      );
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.spaces WHERE invite_code = _code);

    _attempt := _attempt + 1;
    IF _attempt >= 10 THEN
      RAISE EXCEPTION 'Could not allocate an invite code';
    END IF;
  END LOOP;

  RETURN _code;
END; $$;

REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM anon, authenticated;

/**
 * Create a space and its first membership in one transaction, with a
 * server-generated code that expires in a week.
 */
CREATE OR REPLACE FUNCTION public.create_space(
  _name TEXT,
  _anniversary DATE DEFAULT NULL
)
RETURNS public.spaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _space public.spaces;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF EXISTS (SELECT 1 FROM public.space_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a space';
  END IF;

  INSERT INTO public.spaces (name, created_by, invite_code, anniversary_date, invite_code_expires_at)
  VALUES (
    COALESCE(NULLIF(btrim(_name), ''), 'Us'),
    auth.uid(),
    public.generate_invite_code(),
    _anniversary,
    now() + interval '7 days'
  )
  RETURNING * INTO _space;

  INSERT INTO public.space_members (space_id, user_id)
  VALUES (_space.id, auth.uid());

  RETURN _space;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_space(TEXT, DATE) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_space(TEXT, DATE) TO authenticated;

/** Issue a fresh code, invalidating the old one. Members only. */
CREATE OR REPLACE FUNCTION public.rotate_invite_code(_space_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code TEXT;
BEGIN
  IF NOT public.is_space_member(_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not your space';
  END IF;

  _code := public.generate_invite_code();

  UPDATE public.spaces
    SET invite_code = _code,
        invite_code_expires_at = now() + interval '7 days',
        invite_code_rotated_at = now()
    WHERE id = _space_id;

  RETURN _code;
END; $$;

REVOKE EXECUTE ON FUNCTION public.rotate_invite_code(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_invite_code(UUID) TO authenticated;

/**
 * Join by code, now rejecting expired codes and codes for a space that is
 * already a pair. The two-member cap is enforced here and by RLS on
 * space_members, so neither path alone has to be trusted.
 */
CREATE OR REPLACE FUNCTION public.join_space_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _space public.spaces;
  _count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT * INTO _space FROM public.spaces
    WHERE upper(invite_code) = upper(btrim(_code));

  IF _space.id IS NULL THEN
    RAISE EXCEPTION 'That invite code does not exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = _space.id AND user_id = auth.uid()
  ) THEN
    RETURN _space.id;
  END IF;

  IF _space.invite_code_expires_at IS NOT NULL
     AND _space.invite_code_expires_at <= now() THEN
    RAISE EXCEPTION 'That invite code has expired — ask for a new one';
  END IF;

  IF EXISTS (SELECT 1 FROM public.space_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a space';
  END IF;

  SELECT count(*) INTO _count FROM public.space_members WHERE space_id = _space.id;
  IF _count >= 2 THEN
    RAISE EXCEPTION 'That space is already full';
  END IF;

  INSERT INTO public.space_members (space_id, user_id) VALUES (_space.id, auth.uid());

  -- A code that has been used by the pair it was meant for is spent.
  UPDATE public.spaces SET invite_code_expires_at = now() WHERE id = _space.id;

  PERFORM public.notify_space(
    _space.id,
    auth.uid(),
    'milestone',
    COALESCE(public.display_name_of(auth.uid()), 'Your person') || ' joined your space',
    NULL,
    '/feed'
  );

  RETURN _space.id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.join_space_by_code(TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_space_by_code(TEXT) TO authenticated;

-- Spaces are no longer created by a direct insert; keep the column honest for
-- anything still writing one, and stop the browser inventing codes.
REVOKE INSERT ON public.spaces FROM authenticated;
