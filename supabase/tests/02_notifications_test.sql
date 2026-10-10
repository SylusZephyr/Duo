-- Notification fan-out: who hears about what, and what stays private.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', _id::text, true);
$$;

CREATE OR REPLACE FUNCTION pg_temp.inbox(_user uuid) RETURNS SETOF public.notifications
LANGUAGE sql AS $$
  SELECT * FROM public.notifications WHERE user_id = _user ORDER BY created_at, id;
$$;

CREATE OR REPLACE FUNCTION pg_temp.count_kind(_user uuid, _kind text) RETURNS bigint
LANGUAGE sql AS $$
  SELECT count(*) FROM public.notifications WHERE user_id = _user AND kind = _kind;
$$;

DO $$
DECLARE
  _alex uuid;
  _sam uuid;
  _space uuid;
  _post uuid;
  _round uuid;
  _item uuid;
  _letter uuid;
  _code TEXT;
BEGIN
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('alex@example.com', '{"display_name":"Alex"}') RETURNING id INTO _alex;
  INSERT INTO auth.users (email, raw_user_meta_data)
    VALUES ('sam@example.com', '{"display_name":"Sam"}') RETURNING id INTO _sam;

  PERFORM pg_temp.as_user(_alex);
  _space := (public.create_space('Alex & Sam')).id;
  _code := public.rotate_invite_code(_space);
  PERFORM pg_temp.as_user(_sam);
  PERFORM public.join_space_by_code(_code);

  DELETE FROM public.notifications;

  -- A moment reaches the partner, and only the partner.
  PERFORM pg_temp.as_user(_alex);
  INSERT INTO public.posts (space_id, author_id, caption)
    VALUES (_space, _alex, 'Rooftop, 2am, nobody else awake')
    RETURNING id INTO _post;

  ASSERT pg_temp.count_kind(_sam, 'moment') = 1, 'the partner hears about a new moment';
  ASSERT pg_temp.count_kind(_alex, 'moment') = 0, 'the author is not told about their own post';
  ASSERT (SELECT title FROM pg_temp.inbox(_sam) WHERE kind = 'moment') = 'Alex added a moment',
    'the notification names who posted';
  ASSERT (SELECT body FROM pg_temp.inbox(_sam) WHERE kind = 'moment')
         = 'Rooftop, 2am, nobody else awake',
    'the caption is previewed';
  ASSERT (SELECT link FROM pg_temp.inbox(_sam) WHERE kind = 'moment') = '/moment/' || _post,
    'the notification deep-links to the moment';

  -- A comment reaches the other person.
  PERFORM pg_temp.as_user(_sam);
  INSERT INTO public.post_comments (post_id, author_id, body)
    VALUES (_post, _sam, 'I remember the cold');
  ASSERT pg_temp.count_kind(_alex, 'comment') = 1, 'a comment reaches the other person';
  ASSERT pg_temp.count_kind(_sam, 'comment') = 0, 'not the commenter';

  -- A reaction is news only to whoever made the thing.
  INSERT INTO public.post_reactions (post_id, user_id, emoji) VALUES (_post, _sam, '🫶');
  ASSERT pg_temp.count_kind(_alex, 'reaction') = 1, 'the author hears about a reaction';
  ASSERT (SELECT title FROM pg_temp.inbox(_alex) WHERE kind = 'reaction') = 'Sam reacted 🫶',
    'the reaction notification carries the emoji';

  -- Reacting to your own moment notifies nobody.
  PERFORM pg_temp.as_user(_alex);
  INSERT INTO public.post_reactions (post_id, user_id, emoji) VALUES (_post, _alex, '😄');
  ASSERT pg_temp.count_kind(_sam, 'reaction') = 0,
    'a self-reaction is not news to the partner';

  -- An open journal entry previews its title.
  INSERT INTO public.journal_entries (space_id, author_id, title, body)
    VALUES (_space, _alex, 'Sunday', 'We did nothing all day and it was perfect');
  ASSERT (SELECT body FROM pg_temp.inbox(_sam) WHERE kind = 'journal') = 'Sunday',
    'an open entry previews its title';

  -- A sealed letter announces itself but gives nothing away.
  DELETE FROM public.notifications;
  INSERT INTO public.journal_entries
    (space_id, author_id, title, body, is_sealed, unlock_at)
    VALUES (_space, _alex, 'Read this in a year', 'the secret', true,
            current_date + 365)
    RETURNING id INTO _letter;

  ASSERT (SELECT title FROM pg_temp.inbox(_sam) WHERE kind = 'journal')
         = 'Alex sealed a letter for you',
    'the partner knows a letter is waiting';
  ASSERT (SELECT body FROM pg_temp.inbox(_sam) WHERE kind = 'journal') IS NULL,
    'a sealed letter leaks neither its title nor its body';

  -- The sweep ignores a letter whose date has not come.
  ASSERT public.announce_unlocked_letters() = 0, 'a future letter is not announced';

  -- Once the date passes, both of them hear about it, exactly once.
  UPDATE public.journal_entries SET unlock_at = current_date - 1 WHERE id = _letter;
  ASSERT public.announce_unlocked_letters() = 1, 'the sweep opens a due letter';
  ASSERT pg_temp.count_kind(_sam, 'sealed') = 1, 'the recipient is told';
  ASSERT pg_temp.count_kind(_alex, 'sealed') = 1, 'so is the person who wrote it';
  ASSERT public.announce_unlocked_letters() = 0, 'the sweep is idempotent';
  ASSERT pg_temp.count_kind(_sam, 'sealed') = 1, 'and does not repeat itself';

  -- Milestones, stories, prompts and games all reach the partner.
  DELETE FROM public.notifications;
  INSERT INTO public.milestones (space_id, created_by, title)
    VALUES (_space, _alex, 'Moved in together');
  ASSERT pg_temp.count_kind(_sam, 'milestone') = 1, 'a milestone reaches the partner';

  INSERT INTO public.stories (space_id, author_id, storage_path, caption)
    VALUES (_space, _alex, 'spaces/x/stories/a.jpg', 'morning');
  ASSERT pg_temp.count_kind(_sam, 'story') = 1, 'a story reaches the partner';

  INSERT INTO public.game_rounds (space_id, game, question, created_by)
    VALUES (_space, 'guess', 'Where did we first meet?', _alex)
    RETURNING id INTO _round;
  ASSERT pg_temp.count_kind(_sam, 'game') = 1, 'a new round reaches the partner';

  PERFORM pg_temp.as_user(_sam);
  INSERT INTO public.game_answers (round_id, space_id, user_id, answer)
    VALUES (_round, _space, _sam, 'the bus stop');
  ASSERT pg_temp.count_kind(_alex, 'game') = 1, 'an answer reaches the person who asked';

  -- Ticking off a bucket-list item is news; editing one is not.
  INSERT INTO public.bucket_list (space_id, created_by, title)
    VALUES (_space, _sam, 'See the northern lights') RETURNING id INTO _item;
  UPDATE public.bucket_list SET note = 'Tromsø?' WHERE id = _item;
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_temp.inbox(_alex) WHERE title LIKE 'Ticked off%'
  ), 'editing an item is not an event';

  UPDATE public.bucket_list SET done = true, done_by = _sam WHERE id = _item;
  ASSERT EXISTS (
    SELECT 1 FROM pg_temp.inbox(_alex)
    WHERE title = 'Ticked off the list: See the northern lights'
  ), 'completing an item is an event';

  UPDATE public.bucket_list SET done = true WHERE id = _item;
  ASSERT (SELECT count(*) FROM pg_temp.inbox(_alex) WHERE title LIKE 'Ticked off%') = 1,
    'a no-op update does not announce it again';

  -- A badge belongs to both of them, so both hear about it.
  DELETE FROM public.notifications;
  INSERT INTO public.achievements (space_id, key, earned_by)
    VALUES (_space, 'first_moment', _alex);
  ASSERT pg_temp.count_kind(_alex, 'achievement') = 1, 'the earner is told';
  ASSERT pg_temp.count_kind(_sam, 'achievement') = 1, 'and so is their person';
  ASSERT (SELECT body FROM pg_temp.inbox(_sam) WHERE kind = 'achievement') = 'first_moment',
    'the badge key travels with the notification';

  -- The same badge cannot be earned twice.
  BEGIN
    INSERT INTO public.achievements (space_id, key) VALUES (_space, 'first_moment');
    RAISE EXCEPTION 'expected a duplicate badge to be refused';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Switching a kind off stops it; it does not stop the others.
  DELETE FROM public.notifications;
  UPDATE public.notification_prefs SET reactions = false WHERE user_id = _alex;
  PERFORM pg_temp.as_user(_sam);
  INSERT INTO public.post_reactions (post_id, user_id, emoji) VALUES (_post, _sam, '🔥');
  INSERT INTO public.post_comments (post_id, author_id, body) VALUES (_post, _sam, 'still');
  ASSERT pg_temp.count_kind(_alex, 'reaction') = 0, 'a muted kind is not delivered';
  ASSERT pg_temp.count_kind(_alex, 'comment') = 1, 'other kinds are unaffected';

  -- Chat deliberately produces no notifications: the tab has its own badge.
  DELETE FROM public.notifications;
  INSERT INTO public.messages (space_id, author_id, body) VALUES (_space, _sam, 'hi');
  ASSERT (SELECT count(*) FROM pg_temp.inbox(_alex)) = 0,
    'chat messages do not flood the inbox';

  RAISE NOTICE 'notifications: ok';
END $$;

ROLLBACK;
