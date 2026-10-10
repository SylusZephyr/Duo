-- STORIES
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  blur_data_url text,
  caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX stories_space_idx ON public.stories(space_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read stories" ON public.stories FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members add stories" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (public.is_space_member(space_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "Authors delete stories" ON public.stories FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read story views" ON public.story_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND public.is_space_member(s.space_id, auth.uid())));
CREATE POLICY "Members mark story seen" ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND public.is_space_member(s.space_id, auth.uid())));

-- CHAT
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text',
  body text NOT NULL DEFAULT '',
  storage_path text,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_space_idx ON public.messages(space_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_space_member(space_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "Members update messages" ON public.messages FOR UPDATE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Authors delete messages" ON public.messages FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read message reactions" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_space_member(m.space_id, auth.uid())));
CREATE POLICY "Members react to messages" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_space_member(m.space_id, auth.uid())));
CREATE POLICY "Own message reactions removable" ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- GAMES
CREATE TABLE public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  game text NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  round_date date NOT NULL DEFAULT current_date,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_rounds_space_idx ON public.game_rounds(space_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.game_rounds TO authenticated;
GRANT ALL ON public.game_rounds TO service_role;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read rounds" ON public.game_rounds FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members create rounds" ON public.game_rounds FOR INSERT TO authenticated
  WITH CHECK (public.is_space_member(space_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members delete rounds" ON public.game_rounds FOR DELETE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

CREATE TABLE public.game_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer text NOT NULL,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_answers TO authenticated;
GRANT ALL ON public.game_answers TO service_role;
ALTER TABLE public.game_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read answers" ON public.game_answers FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members answer" ON public.game_answers FOR INSERT TO authenticated
  WITH CHECK (public.is_space_member(space_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Own answers editable" ON public.game_answers FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Own answers removable" ON public.game_answers FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- COUNTDOWNS
CREATE TABLE public.countdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  emoji text NOT NULL DEFAULT '✨',
  happens_at date NOT NULL,
  repeats_yearly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX countdowns_space_idx ON public.countdowns(space_id, happens_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.countdowns TO authenticated;
GRANT ALL ON public.countdowns TO service_role;
ALTER TABLE public.countdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read countdowns" ON public.countdowns FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members add countdowns" ON public.countdowns FOR INSERT TO authenticated
  WITH CHECK (public.is_space_member(space_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update countdowns" ON public.countdowns FOR UPDATE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members delete countdowns" ON public.countdowns FOR DELETE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

-- GIFTS
CREATE TABLE public.gift_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  url text,
  price text,
  for_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gift_ideas_space_idx ON public.gift_ideas(space_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_ideas TO authenticated;
GRANT ALL ON public.gift_ideas TO service_role;
ALTER TABLE public.gift_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read gifts" ON public.gift_ideas FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members add gifts" ON public.gift_ideas FOR INSERT TO authenticated
  WITH CHECK (public.is_space_member(space_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update gifts" ON public.gift_ideas FOR UPDATE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members delete gifts" ON public.gift_ideas FOR DELETE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.countdowns;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.stories REPLICA IDENTITY FULL;