-- Space creation, invites and the two-person cap.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', _id::text, true);
$$;

DO $$
DECLARE
  _alex uuid;
  _sam uuid;
  _mallory uuid;
  _space public.spaces;
  _code TEXT;
  _joined uuid;
BEGIN
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('alex@example.com', '{"display_name":"Alex"}')
    RETURNING id INTO _alex;
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('sam@example.com', '{"display_name":"Sam"}')
    RETURNING id INTO _sam;
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('mallory@example.com', '{"display_name":"Mallory"}')
    RETURNING id INTO _mallory;

  -- handle_new_user bootstraps a profile and a prefs row for every account.
  ASSERT (SELECT count(*) FROM public.profiles WHERE id IN (_alex, _sam, _mallory)) = 3,
    'every new user gets a profile';
  ASSERT (SELECT count(*) FROM public.notification_prefs
          WHERE user_id IN (_alex, _sam, _mallory)) = 3,
    'every new user gets notification prefs';
  ASSERT (SELECT display_name FROM public.profiles WHERE id = _alex) = 'Alex',
    'display name comes from the signup metadata';

  -- create_space is atomic: the space and its first membership, or neither.
  PERFORM pg_temp.as_user(_alex);
  _space := public.create_space('Alex & Sam', '2024-02-14');

  ASSERT _space.name = 'Alex & Sam', 'the space keeps its name';
  ASSERT _space.anniversary_date = DATE '2024-02-14', 'the anniversary is kept';
  ASSERT EXISTS (SELECT 1 FROM public.space_members
                 WHERE space_id = _space.id AND user_id = _alex),
    'the creator is a member straight away';

  -- Server-generated codes: 8 characters, no look-alike glyphs, and dated.
  ASSERT length(_space.invite_code) = 8, 'invite codes are 8 characters';
  ASSERT _space.invite_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$',
    'invite codes avoid characters that are misread';
  ASSERT _space.invite_code_expires_at > now(), 'a fresh code is live';
  ASSERT _space.invite_code_expires_at < now() + interval '8 days',
    'a fresh code expires within the week';

  -- One space per person.
  BEGIN
    PERFORM public.create_space('Another');
    RAISE EXCEPTION 'expected a second space to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%already in a space%', 'the refusal says why: ' || SQLERRM;
  END;

  -- A blank name still gets something to show.
  PERFORM pg_temp.as_user(_mallory);
  ASSERT (public.create_space('   ')).name = 'Us', 'a blank name falls back to Us';

  -- Rotating replaces the code and invalidates the old one.
  PERFORM pg_temp.as_user(_alex);
  _code := public.rotate_invite_code(_space.id);
  ASSERT _code <> _space.invite_code, 'rotation issues a different code';

  PERFORM pg_temp.as_user(_sam);
  BEGIN
    PERFORM public.join_space_by_code(_space.invite_code);
    RAISE EXCEPTION 'expected the rotated-away code to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%does not exist%', 'the old code is gone: ' || SQLERRM;
  END;

  -- Only a member may rotate.
  BEGIN
    PERFORM public.rotate_invite_code(_space.id);
    RAISE EXCEPTION 'expected rotation by a non-member to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%Not your space%', 'outsiders cannot rotate: ' || SQLERRM;
  END;

  -- Codes are case- and whitespace-insensitive for the person typing them in.
  _joined := public.join_space_by_code('  ' || lower(_code) || '  ');
  ASSERT _joined = _space.id, 'a lowercased, padded code still joins';
  ASSERT (SELECT count(*) FROM public.space_members WHERE space_id = _space.id) = 2,
    'both partners are now members';

  -- Joining tells the other partner.
  ASSERT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = _alex AND title LIKE 'Sam joined%'
  ), 'the waiting partner hears that they joined';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = _sam AND title LIKE '%joined your space%'
  ), 'the person who joined is not told about themselves';

  -- Joining is idempotent for someone already inside.
  ASSERT public.join_space_by_code(_code) = _space.id,
    'an existing member re-entering their own code is a no-op';

  -- A used code is spent, so a screenshot of it is worthless.
  PERFORM pg_temp.as_user(_mallory);
  DELETE FROM public.space_members WHERE user_id = _mallory;
  BEGIN
    PERFORM public.join_space_by_code(_code);
    RAISE EXCEPTION 'expected a spent code to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%expired%' OR SQLERRM LIKE '%full%',
      'a third person cannot walk in: ' || SQLERRM;
  END;

  -- And the cap holds even with a freshly issued code.
  PERFORM pg_temp.as_user(_alex);
  _code := public.rotate_invite_code(_space.id);
  PERFORM pg_temp.as_user(_mallory);
  BEGIN
    PERFORM public.join_space_by_code(_code);
    RAISE EXCEPTION 'expected a full space to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%full%', 'a space for two stays a space for two: ' || SQLERRM;
  END;

  -- An expired code is refused even when there is room.
  PERFORM pg_temp.as_user(_sam);
  DELETE FROM public.space_members WHERE user_id = _sam AND space_id = _space.id;
  UPDATE public.spaces SET invite_code_expires_at = now() - interval '1 day'
    WHERE id = _space.id;
  PERFORM pg_temp.as_user(_mallory);
  BEGIN
    PERFORM public.join_space_by_code(_code);
    RAISE EXCEPTION 'expected an expired code to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%expired%', 'expiry is enforced: ' || SQLERRM;
  END;

  -- A code nobody issued is refused.
  BEGIN
    PERFORM public.join_space_by_code('ZZZZZZZZ');
    RAISE EXCEPTION 'expected an unknown code to be refused';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%does not exist%', 'unknown codes are refused: ' || SQLERRM;
  END;

  RAISE NOTICE 'spaces: ok';
END $$;

ROLLBACK;
