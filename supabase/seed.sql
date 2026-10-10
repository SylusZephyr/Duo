-- Demo data for local development.
--
-- `supabase db reset` runs this after the migrations. It is never applied to a
-- hosted project: `supabase db push` sends migrations only.
--
-- Two accounts you can sign in as straight away, both password `password123`:
--
--   alex@example.com
--   sam@example.com
--
-- They share one space with a year of moments, a journal, milestones, a
-- someday list, chat, a sealed letter and a wall of earned badges — enough
-- that every screen has something real on it.

BEGIN;

DO $$
DECLARE
  _alex  uuid := '11111111-1111-4111-8111-111111111111';
  _sam   uuid := '22222222-2222-4222-8222-222222222222';
  _space uuid := '33333333-3333-4333-8333-333333333333';
  _post  uuid;
  _round uuid;
  _today date := current_date;
BEGIN
  -- Idempotent: re-running the seed replaces the demo rather than doubling it.
  DELETE FROM auth.users WHERE id IN (_alex, _sam);
  DELETE FROM public.spaces WHERE id = _space;

  -- ---- accounts -----------------------------------------------------------
  -- crypt() with a bcrypt salt is what GoTrue expects in encrypted_password.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  VALUES
    (_alex, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'alex@example.com', crypt('password123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Alex"}'::jsonb, now() - interval '400 days', now()),
    (_sam, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sam@example.com', crypt('password123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Sam"}'::jsonb, now() - interval '400 days', now());

  -- GoTrue needs an identity row per provider to let the account sign in.
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at,
    created_at, updated_at
  )
  VALUES
    (gen_random_uuid(), _alex, _alex::text, 'email',
     format('{"sub":"%s","email":"alex@example.com","email_verified":true}', _alex)::jsonb,
     now(), now(), now()),
    (gen_random_uuid(), _sam, _sam::text, 'email',
     format('{"sub":"%s","email":"sam@example.com","email_verified":true}', _sam)::jsonb,
     now(), now(), now());

  -- handle_new_user() created the profiles; give them some character.
  UPDATE public.profiles
     SET display_name = 'Alex', bio = 'Takes the photos.', handle = 'alex'
   WHERE id = _alex;
  UPDATE public.profiles
     SET display_name = 'Sam', bio = 'Writes the captions.', handle = 'sam'
   WHERE id = _sam;

  -- ---- the space ----------------------------------------------------------
  INSERT INTO public.spaces (
    id, name, handle, invite_code, invite_code_expires_at, is_public,
    anniversary_date, created_by, created_at
  )
  VALUES (
    _space, 'Alex & Sam', 'alexandsam', 'DEMO2UVW', now() + interval '7 days',
    true, _today - 418, _alex, now() - interval '400 days'
  );

  INSERT INTO public.space_members (space_id, user_id, joined_at)
  VALUES (_space, _alex, now() - interval '400 days'),
         (_space, _sam,  now() - interval '399 days');

  -- ---- moments ------------------------------------------------------------
  -- Spread across months and countries so the feed groups, the map clusters
  -- and the distance and city counts on /us are non-trivial.
  INSERT INTO public.posts
    (space_id, author_id, caption, mood, taken_at, visibility, place_name, city, country, lat, lng)
  VALUES
    (_space, _alex, 'Rooftop, 2am, nobody else awake.', 'tender', _today,      'private', 'The roof',        'Lisbon',   'Portugal',  38.7223,  -9.1393),
    (_space, _sam,  'You made coffee before I woke up again.', 'warm', _today - 1, 'private', 'Home',         'Lisbon',   'Portugal',  38.7223,  -9.1393),
    (_space, _alex, 'Got lost on purpose.', 'joy',            _today - 2,  'private', 'Alfama',              'Lisbon',   'Portugal',  38.7139,  -9.1265),
    (_space, _sam,  'Train window for six hours and you never complained.', 'calm', _today - 9, 'public', 'Santa Apolónia', 'Lisbon', 'Portugal', 38.7139, -9.1222),
    (_space, _alex, 'First time seeing snow together.', 'joy', _today - 61,  'public',  'Vysoká',             'Prague',   'Czechia',   50.0875,  14.4213),
    (_space, _sam,  'You cried at the bridge. I did too.', 'tender', _today - 62, 'private', 'Charles Bridge','Prague',   'Czechia',   50.0865,  14.4114),
    (_space, _alex, 'Cheapest hostel, best week.', 'silly',   _today - 150, 'private', 'Gràcia',              'Barcelona','Spain',     41.4036,   2.1744),
    (_space, _sam,  'Sunburnt and happy.', 'joy',             _today - 151, 'private', 'Barceloneta',         'Barcelona','Spain',     41.3784,   2.1925),
    (_space, _alex, 'The day we decided.', 'warm',            _today - 280, 'private', 'Primrose Hill',       'London',   'United Kingdom', 51.5390, -0.1608),
    (_space, _sam,  'Where it started.', 'missing',           _today - 417, 'public',  'The bus stop',        'London',   'United Kingdom', 51.5074, -0.1278);

  -- A streak needs consecutive days; the three most recent give /us one.
  -- Reactions and comments so the cards are not bare.
  SELECT id INTO _post FROM public.posts
   WHERE space_id = _space AND taken_at = _today LIMIT 1;

  INSERT INTO public.post_reactions (post_id, user_id, emoji) VALUES (_post, _sam, '🫶');
  INSERT INTO public.post_comments (post_id, author_id, body)
  VALUES (_post, _sam, 'I remember how cold it was.'),
         (_post, _alex, 'Worth it.');

  INSERT INTO public.post_tags (post_id, tag) VALUES (_post, 'nights'), (_post, 'lisbon');

  -- ---- journal, including a letter already open and one still sealed ------
  INSERT INTO public.journal_entries
    (space_id, author_id, title, body, mood, entry_date, is_sealed, unlock_at, unlock_announced_at)
  VALUES
    (_space, _sam, 'Sunday', 'We did nothing all day and it was perfect.', 'calm', _today - 3, false, NULL, NULL),
    (_space, _alex, 'A year in', 'Writing this down so I remember the ordinary parts too.', 'warm', _today - 40, false, NULL, NULL),
    (_space, _alex, 'Read this when you need it', 'You were right about the flat.', 'tender', _today - 200, true, _today - 10, now()),
    (_space, _sam, 'Open on our next anniversary', 'Not yet.', 'tender', _today - 5, true, _today + 300, NULL);

  -- ---- milestones, someday list, places we want to go ---------------------
  INSERT INTO public.milestones (space_id, created_by, title, description, happened_at)
  VALUES
    (_space, _alex, 'Moved in together', 'Two suitcases and a plant.', _today - 280),
    (_space, _sam,  'Adopted Noodle',    'He hated us for a week.',    _today - 120),
    (_space, _alex, 'One year',          NULL,                          _today - 53);

  INSERT INTO public.bucket_list (space_id, created_by, title, note, done, done_at, done_by)
  VALUES
    (_space, _sam,  'See the northern lights', 'Tromsø in February?', false, NULL, NULL),
    (_space, _alex, 'Learn to make proper pasta', NULL, true, now() - interval '30 days', _alex),
    (_space, _sam,  'Swim somewhere we should not', NULL, true, now() - interval '90 days', _sam),
    (_space, _alex, 'Drive the whole coast', NULL, false, NULL, NULL);

  INSERT INTO public.wishlist_places (space_id, created_by, name, city, country, lat, lng, note, visited)
  VALUES
    (_space, _sam,  'Tromsø',   'Tromsø',   'Norway', 69.6492, 18.9553, 'For the lights', false),
    (_space, _alex, 'Kyoto',    'Kyoto',    'Japan',  35.0116, 135.7681, 'Autumn', false);

  -- ---- countdowns and gifts ----------------------------------------------
  INSERT INTO public.countdowns (space_id, created_by, title, emoji, happens_at, repeats_yearly)
  VALUES
    (_space, _alex, 'Our anniversary', '🕯️', _today - 418, true),
    (_space, _sam,  'Sam''s birthday',  '🎂', _today + 24,  true);

  INSERT INTO public.gift_ideas (space_id, created_by, title, note, for_user, claimed)
  VALUES (_space, _alex, 'That camera strap', 'The tan one', _sam, false);

  -- ---- chat ---------------------------------------------------------------
  INSERT INTO public.messages (space_id, author_id, body, kind, seen_at, created_at)
  VALUES
    (_space, _alex, 'are you home?',            'text', now(), now() - interval '3 hours'),
    (_space, _sam,  'ten minutes',              'text', now(), now() - interval '3 hours' + interval '2 min'),
    (_space, _alex, 'i got the bread you like', 'text', NULL,  now() - interval '2 hours');

  -- ---- a game round, answered by one side ---------------------------------
  INSERT INTO public.game_rounds (space_id, game, question, options, created_by, round_date)
  VALUES (_space, 'guess', 'Where did we first say it?', '["The bus stop","Your kitchen","The bridge"]'::jsonb, _sam, _today)
  RETURNING id INTO _round;
  INSERT INTO public.game_answers (round_id, space_id, user_id, answer)
  VALUES (_round, _space, _alex, 'The bus stop');

  -- ---- badges already earned ----------------------------------------------
  -- Inserting these fires the achievements trigger, so the inbox gets its
  -- unlock notifications the same way the running app would produce them.
  INSERT INTO public.achievements (space_id, key, earned_by, earned_at)
  VALUES
    (_space, 'first_moment',    _alex, now() - interval '400 days'),
    (_space, 'ten_moments',     _sam,  now() - interval '60 days'),
    (_space, 'three_cities',    _alex, now() - interval '150 days'),
    (_space, 'two_countries',   _sam,  now() - interval '150 days'),
    (_space, 'journal_starter', _alex, now() - interval '200 days'),
    (_space, 'first_year',      _sam,  now() - interval '53 days');

  -- ---- daily prompt -------------------------------------------------------
  INSERT INTO public.prompts (body, day_index)
  SELECT * FROM (VALUES
    ('What did you notice about each other today?', 1),
    ('What is something you are glad you did not say?', 2),
    ('Describe the other person''s laugh.', 3)
  ) AS p(body, day_index)
  WHERE NOT EXISTS (SELECT 1 FROM public.prompts);

  RAISE NOTICE 'Seeded: alex@example.com / sam@example.com, both password123';
END $$;

COMMIT;
