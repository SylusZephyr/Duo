-- space_id on the child tables: derived, not trusted, and never null.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(_id uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', _id::text, true); $$;

DO $$
DECLARE
  _alex uuid; _sam uuid; _mallory uuid;
  _space uuid; _other uuid; _post uuid; _msg uuid; _code text;
BEGIN
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('alex@example.com', '{"display_name":"Alex"}') RETURNING id INTO _alex;
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('sam@example.com', '{"display_name":"Sam"}') RETURNING id INTO _sam;
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('mallory@example.com', '{"display_name":"Mallory"}') RETURNING id INTO _mallory;

  PERFORM pg_temp.as_user(_alex);
  _space := (public.create_space('Alex & Sam')).id;
  _code := public.rotate_invite_code(_space);
  PERFORM pg_temp.as_user(_sam);
  PERFORM public.join_space_by_code(_code);

  PERFORM pg_temp.as_user(_mallory);
  _other := (public.create_space('Someone else')).id;

  PERFORM pg_temp.as_user(_alex);
  INSERT INTO public.posts (space_id, author_id, caption)
    VALUES (_space, _alex, 'a') RETURNING id INTO _post;
  INSERT INTO public.messages (space_id, author_id, body)
    VALUES (_space, _alex, 'hi') RETURNING id INTO _msg;

  -- The trigger fills space_id in from the parent.
  INSERT INTO public.post_reactions (post_id, user_id, emoji) VALUES (_post, _sam, '🫶');
  ASSERT (SELECT space_id FROM public.post_reactions WHERE post_id = _post) = _space,
    'a reaction inherits its post''s space';

  INSERT INTO public.post_comments (post_id, author_id, body) VALUES (_post, _sam, 'hi');
  ASSERT (SELECT space_id FROM public.post_comments WHERE post_id = _post) = _space,
    'a comment inherits its post''s space';

  INSERT INTO public.post_media (post_id, storage_path, position)
    VALUES (_post, 'spaces/x/a.jpg', 0);
  ASSERT (SELECT space_id FROM public.post_media WHERE post_id = _post) = _space,
    'media inherits its post''s space';

  INSERT INTO public.message_reactions (message_id, user_id, emoji) VALUES (_msg, _sam, '😂');
  ASSERT (SELECT space_id FROM public.message_reactions WHERE message_id = _msg) = _space,
    'a message reaction inherits its message''s space';

  -- A client cannot aim a row at another space to eavesdrop on its realtime
  -- stream: the trigger overwrites whatever was sent.
  INSERT INTO public.post_comments (post_id, author_id, body, space_id)
    VALUES (_post, _alex, 'spoofed', _other);
  ASSERT (SELECT count(*) FROM public.post_comments WHERE space_id = _other) = 0,
    'a forged space_id is overwritten, not stored';

  -- Re-pointing at a parent re-derives the space rather than keeping a stale one.
  UPDATE public.post_comments SET space_id = _other WHERE post_id = _post;
  UPDATE public.post_comments SET post_id = _post WHERE post_id = _post;
  ASSERT (SELECT count(DISTINCT space_id) FROM public.post_comments WHERE post_id = _post) = 1
     AND (SELECT DISTINCT space_id FROM public.post_comments WHERE post_id = _post) = _space,
    'an update that touches post_id re-derives space_id';

  RAISE NOTICE 'realtime scoping: ok';
END $$;

ROLLBACK;
