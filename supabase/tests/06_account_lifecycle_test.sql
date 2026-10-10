-- Export and deletion: what leaves with you, and what stays with your partner.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(_id uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', _id::text, true); $$;

DO $$
DECLARE
  _alex uuid; _sam uuid; _space uuid; _code text; _post uuid; _export jsonb; _solo uuid; _solospace uuid;
BEGIN
  INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('alex@e.com','{"display_name":"Alex"}') RETURNING id INTO _alex;
  INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('sam@e.com','{"display_name":"Sam"}') RETURNING id INTO _sam;

  PERFORM pg_temp.as_user(_alex);
  _space := (public.create_space('Alex & Sam', '2024-02-14')).id;
  _code := public.rotate_invite_code(_space);
  PERFORM pg_temp.as_user(_sam);
  PERFORM public.join_space_by_code(_code);

  PERFORM pg_temp.as_user(_alex);
  INSERT INTO public.posts (space_id, author_id, caption) VALUES (_space, _alex, 'ours')
    RETURNING id INTO _post;
  INSERT INTO public.post_media (post_id, storage_path, position)
    VALUES (_post, 'spaces/x/photo.jpg', 0);
  INSERT INTO public.journal_entries (space_id, author_id, title) VALUES (_space, _alex, 'entry');
  INSERT INTO public.messages (space_id, author_id, body) VALUES (_space, _alex, 'hello');

  -- ---- export ------------------------------------------------------------
  _export := public.export_my_data();

  ASSERT _export -> 'account' ->> 'display_name' = 'Alex', 'the export names the account';
  ASSERT jsonb_array_length(_export -> 'moments') = 1, 'it includes the moments';
  ASSERT jsonb_array_length(_export -> 'journal') = 1, 'and the journal';
  ASSERT jsonb_array_length(_export -> 'messages') = 1, 'and the chat';
  ASSERT _export -> 'media_paths' @> '["spaces/x/photo.jpg"]'::jsonb,
    'and lists the files so they can be downloaded';
  ASSERT _export -> 'space' ->> 'invite_code' IS NULL,
    'but never the live invite code';

  -- ---- one partner leaves -------------------------------------------------
  PERFORM public.delete_my_account();

  ASSERT NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _alex), 'the account is gone';
  ASSERT NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _alex), 'so is the profile';

  -- The shared history is Sam's too, so it survives, de-attributed.
  ASSERT EXISTS (SELECT 1 FROM public.spaces WHERE id = _space),
    'the space survives while one member remains';
  ASSERT (SELECT count(*) FROM public.posts WHERE space_id = _space) = 1,
    'the shared moment stays';
  ASSERT (SELECT author_id FROM public.posts WHERE id = _post) IS NULL,
    'but is no longer attributed to the deleted account';
  ASSERT (SELECT count(*) FROM public.messages WHERE space_id = _space) = 1,
    'the chat history stays';
  ASSERT (SELECT created_by FROM public.spaces WHERE id = _space) = _sam,
    'ownership moves to whoever is left';
  ASSERT (SELECT invite_code_expires_at FROM public.spaces WHERE id = _space) <= now(),
    'and the departing member''s invite code is spent';

  -- ---- the last one out ---------------------------------------------------
  PERFORM pg_temp.as_user(_sam);
  PERFORM public.delete_my_account();

  ASSERT NOT EXISTS (SELECT 1 FROM public.spaces WHERE id = _space),
    'the space goes when nobody is left';
  ASSERT (SELECT count(*) FROM public.posts WHERE space_id = _space) = 0,
    'and takes its moments with it';

  -- ---- a solo account with no space ---------------------------------------
  INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('solo@e.com','{"display_name":"Solo"}')
    RETURNING id INTO _solo;
  PERFORM pg_temp.as_user(_solo);
  PERFORM public.delete_my_account();
  ASSERT NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _solo),
    'deleting works without ever having joined a space';

  RAISE NOTICE 'account lifecycle: ok';
END $$;

ROLLBACK;
