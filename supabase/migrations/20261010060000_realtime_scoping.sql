-- ============================================================================
-- Scope realtime subscriptions to one space.
--
-- post_media, post_reactions, post_comments and message_reactions have no
-- space_id, so the client could not filter its realtime subscription on them
-- and subscribed to *every* row in those tables. Row-level security still
-- decided what each client was allowed to receive — nothing leaked — but the
-- realtime server had to evaluate those policies once per subscriber per
-- change. That is O(connected users x writes): with 100 people online, a
-- single reaction costs 100 policy evaluations, and the cost grows with the
-- product of both numbers rather than with either one.
--
-- Carrying space_id on these rows lets the subscription say
-- `filter: space_id=eq.<id>`, which realtime applies before the policy check.
-- One reaction then costs work for the two people in that space.
--
-- The column is derived from the parent row by a trigger, never from the
-- client, so it cannot be set to someone else's space.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- post_media / post_reactions / post_comments — space comes from the post
-- ---------------------------------------------------------------------------

ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS space_id UUID
  REFERENCES public.spaces ON DELETE CASCADE;
ALTER TABLE public.post_reactions ADD COLUMN IF NOT EXISTS space_id UUID
  REFERENCES public.spaces ON DELETE CASCADE;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS space_id UUID
  REFERENCES public.spaces ON DELETE CASCADE;

UPDATE public.post_media m SET space_id = p.space_id
  FROM public.posts p WHERE p.id = m.post_id AND m.space_id IS DISTINCT FROM p.space_id;
UPDATE public.post_reactions r SET space_id = p.space_id
  FROM public.posts p WHERE p.id = r.post_id AND r.space_id IS DISTINCT FROM p.space_id;
UPDATE public.post_comments c SET space_id = p.space_id
  FROM public.posts p WHERE p.id = c.post_id AND c.space_id IS DISTINCT FROM p.space_id;

/** Derive space_id from the parent post, ignoring whatever the client sent. */
CREATE OR REPLACE FUNCTION public.set_space_from_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT space_id INTO NEW.space_id FROM public.posts WHERE id = NEW.post_id;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_space_from_post() FROM anon, authenticated;

DROP TRIGGER IF EXISTS post_media_space ON public.post_media;
CREATE TRIGGER post_media_space BEFORE INSERT OR UPDATE OF post_id ON public.post_media
  FOR EACH ROW EXECUTE FUNCTION public.set_space_from_post();

DROP TRIGGER IF EXISTS post_reactions_space ON public.post_reactions;
CREATE TRIGGER post_reactions_space BEFORE INSERT OR UPDATE OF post_id ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.set_space_from_post();

DROP TRIGGER IF EXISTS post_comments_space ON public.post_comments;
CREATE TRIGGER post_comments_space BEFORE INSERT OR UPDATE OF post_id ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_space_from_post();

-- ---------------------------------------------------------------------------
-- message_reactions — space comes from the message
-- ---------------------------------------------------------------------------

ALTER TABLE public.message_reactions ADD COLUMN IF NOT EXISTS space_id UUID
  REFERENCES public.spaces ON DELETE CASCADE;

UPDATE public.message_reactions r SET space_id = m.space_id
  FROM public.messages m WHERE m.id = r.message_id AND r.space_id IS DISTINCT FROM m.space_id;

CREATE OR REPLACE FUNCTION public.set_space_from_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT space_id INTO NEW.space_id FROM public.messages WHERE id = NEW.message_id;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_space_from_message() FROM anon, authenticated;

DROP TRIGGER IF EXISTS message_reactions_space ON public.message_reactions;
CREATE TRIGGER message_reactions_space
  BEFORE INSERT OR UPDATE OF message_id ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.set_space_from_message();

-- ---------------------------------------------------------------------------
-- Now that every row carries one, require it.
-- ---------------------------------------------------------------------------

ALTER TABLE public.post_media       ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE public.post_reactions   ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE public.post_comments    ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE public.message_reactions ALTER COLUMN space_id SET NOT NULL;

-- Realtime matches the filter against these, and the app reads by space too.
CREATE INDEX IF NOT EXISTS post_media_space_idx        ON public.post_media (space_id);
CREATE INDEX IF NOT EXISTS post_reactions_space_idx    ON public.post_reactions (space_id);
CREATE INDEX IF NOT EXISTS post_comments_space_idx     ON public.post_comments (space_id);
CREATE INDEX IF NOT EXISTS message_reactions_space_idx ON public.message_reactions (space_id);

-- Realtime sends the old row on UPDATE/DELETE only with full replica identity,
-- which is what lets the filter match on those events as well as INSERT.
ALTER TABLE public.post_media        REPLICA IDENTITY FULL;
ALTER TABLE public.post_reactions    REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments     REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
