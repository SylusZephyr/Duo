-- Moderation: who may report, who may act, and what a takedown actually does.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(_id uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', _id::text, true); $$;

DO $$
DECLARE
  _alex uuid; _sam uuid; _stranger uuid; _mod uuid;
  _space uuid; _code text; _public uuid; _private uuid; _n int;
BEGIN
  INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('alex@e.com','{"display_name":"Alex"}') RETURNING id INTO _alex;
  INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('sam@e.com','{"display_name":"Sam"}') RETURNING id INTO _sam;
  INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('x@e.com','{"display_name":"Stranger"}') RETURNING id INTO _stranger;
  INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('mod@e.com','{"display_name":"Mod"}') RETURNING id INTO _mod;
  INSERT INTO public.user_roles (user_id, role) VALUES (_mod, 'moderator');

  PERFORM pg_temp.as_user(_alex);
  _space := (public.create_space('Alex & Sam')).id;
  _code := public.rotate_invite_code(_space);
  PERFORM pg_temp.as_user(_sam);
  PERFORM public.join_space_by_code(_code);

  PERFORM pg_temp.as_user(_alex);
  INSERT INTO public.posts (space_id, author_id, caption, visibility)
    VALUES (_space, _alex, 'public one', 'public') RETURNING id INTO _public;
  INSERT INTO public.posts (space_id, author_id, caption, visibility)
    VALUES (_space, _alex, 'private one', 'private') RETURNING id INTO _private;

  -- ---- reporting --------------------------------------------------------
  PERFORM pg_temp.as_user(_stranger);
  PERFORM public.report_post(_public, 'spam', 'buy my thing');
  ASSERT (SELECT count(*) FROM public.reports WHERE post_id = _public) = 1,
    'a stranger can report a public moment';

  -- Twice is still once: repeat taps must not inflate the queue.
  PERFORM public.report_post(_public, 'spam', 'again');
  ASSERT (SELECT count(*) FROM public.reports WHERE post_id = _public) = 1,
    'reporting twice does not double-count';

  -- A private moment is not reportable, because it is not visible.
  BEGIN
    PERFORM public.report_post(_private, 'spam');
    RAISE EXCEPTION 'expected reporting a private post to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%not public%', 'private posts are not reportable: ' || SQLERRM;
  END;

  -- ---- who can see and act ----------------------------------------------
  -- A non-moderator gets an empty queue, not an error.
  ASSERT (SELECT count(*) FROM public.moderation_queue()) = 0,
    'the queue is empty for a non-moderator';
  ASSERT public.open_report_count() = 0, 'and the badge reads zero';

  BEGIN
    PERFORM public.moderate_post(_public, 'take_down', 'nope');
    RAISE EXCEPTION 'expected a non-moderator to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%Not a moderator%', 'only moderators may act: ' || SQLERRM;
  END;

  PERFORM pg_temp.as_user(_mod);
  ASSERT (SELECT count(*) FROM public.moderation_queue()) = 1,
    'the moderator sees the reported post';
  ASSERT (SELECT report_count FROM public.moderation_queue()) = 1, 'with its count';
  ASSERT public.open_report_count() = 1, 'and the badge agrees';

  -- ---- takedown -----------------------------------------------------------
  PERFORM public.moderate_post(_public, 'take_down', 'advertising');

  ASSERT NOT public.is_post_public(_public), 'a taken-down post is no longer public';
  ASSERT (SELECT status FROM public.reports WHERE post_id = _public) = 'actioned',
    'its reports are closed';
  ASSERT (SELECT moderated_by FROM public.posts WHERE id = _public) = _mod,
    'the action is attributed';

  -- The couple keeps their own moment.
  PERFORM pg_temp.as_user(_alex);
  ASSERT EXISTS (SELECT 1 FROM public.posts WHERE id = _public),
    'a takedown does not destroy the couple''s memory';

  -- And cannot quietly undo it by editing the post.
  UPDATE public.posts SET moderated_at = NULL, caption = 'edited' WHERE id = _public;
  ASSERT (SELECT moderated_at FROM public.posts WHERE id = _public) IS NOT NULL,
    'the author cannot clear their own takedown';
  ASSERT (SELECT caption FROM public.posts WHERE id = _public) = 'edited',
    'but an ordinary edit still works';

  -- ---- restore ------------------------------------------------------------
  PERFORM pg_temp.as_user(_mod);
  PERFORM public.moderate_post(_public, 'restore');
  ASSERT public.is_post_public(_public), 'a restore puts it back';
  ASSERT (SELECT count(*) FROM public.moderation_queue()) = 0, 'and clears the queue';

  -- ---- dismiss ------------------------------------------------------------
  PERFORM pg_temp.as_user(_stranger);
  PERFORM public.report_post(_public, 'hate');
  PERFORM pg_temp.as_user(_mod);
  SELECT count(*) INTO _n FROM public.moderation_queue();
  ASSERT _n = 1, 'a fresh report reopens the queue';
  PERFORM public.moderate_post(_public, 'dismiss', 'not a violation');
  ASSERT public.is_post_public(_public), 'dismissing leaves the post up';
  ASSERT (SELECT count(*) FROM public.moderation_queue()) = 0, 'and empties the queue';

  -- An unknown action is rejected rather than silently doing nothing.
  BEGIN
    PERFORM public.moderate_post(_public, 'delete_everything');
    RAISE EXCEPTION 'expected an unknown action to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%Unknown action%', 'actions are an allow-list: ' || SQLERRM;
  END;

  RAISE NOTICE 'moderation: ok';
END $$;

ROLLBACK;
