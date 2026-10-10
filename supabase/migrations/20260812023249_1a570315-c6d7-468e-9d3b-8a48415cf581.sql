-- ============ Realtime ============
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;
ALTER TABLE public.post_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.post_media REPLICA IDENTITY FULL;
ALTER TABLE public.journal_entries REPLICA IDENTITY FULL;
ALTER TABLE public.milestones REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_media;
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;

-- ============ Media metadata ============
ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS blur_data_url text;
ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS byte_size integer;

-- ============ Roles ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ Albums (trips) ============
CREATE TABLE public.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_path text,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums TO authenticated;
GRANT ALL ON public.albums TO service_role;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view albums" ON public.albums
  FOR SELECT TO authenticated USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can create albums" ON public.albums
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can update albums" ON public.albums
  FOR UPDATE TO authenticated USING (public.is_space_member(space_id, auth.uid()))
  WITH CHECK (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can delete albums" ON public.albums
  FOR DELETE TO authenticated USING (public.is_space_member(space_id, auth.uid()));
CREATE TRIGGER albums_touch BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.album_posts (
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.album_posts TO authenticated;
GRANT ALL ON public.album_posts TO service_role;
ALTER TABLE public.album_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view album posts" ON public.album_posts
  FOR SELECT TO authenticated USING (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can add album posts" ON public.album_posts
  FOR INSERT TO authenticated WITH CHECK (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can update album posts" ON public.album_posts
  FOR UPDATE TO authenticated USING (public.can_read_post(post_id, auth.uid()))
  WITH CHECK (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can remove album posts" ON public.album_posts
  FOR DELETE TO authenticated USING (public.can_read_post(post_id, auth.uid()));

-- ============ Tags ============
CREATE TABLE public.post_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, tag)
);
GRANT SELECT, INSERT, DELETE ON public.post_tags TO authenticated;
GRANT ALL ON public.post_tags TO service_role;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view tags" ON public.post_tags
  FOR SELECT TO authenticated USING (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can add tags" ON public.post_tags
  FOR INSERT TO authenticated WITH CHECK (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can remove tags" ON public.post_tags
  FOR DELETE TO authenticated USING (public.can_read_post(post_id, auth.uid()));

-- ============ Wishlist places ============
CREATE TABLE public.wishlist_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  country text,
  lat double precision,
  lng double precision,
  note text,
  visited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_places TO authenticated;
GRANT ALL ON public.wishlist_places TO service_role;
ALTER TABLE public.wishlist_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view wishlist" ON public.wishlist_places
  FOR SELECT TO authenticated USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can add wishlist places" ON public.wishlist_places
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can update wishlist" ON public.wishlist_places
  FOR UPDATE TO authenticated USING (public.is_space_member(space_id, auth.uid()))
  WITH CHECK (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can delete wishlist" ON public.wishlist_places
  FOR DELETE TO authenticated USING (public.is_space_member(space_id, auth.uid()));

-- ============ Bucket list ============
CREATE TABLE public.bucket_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bucket_list TO authenticated;
GRANT ALL ON public.bucket_list TO service_role;
ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view bucket list" ON public.bucket_list
  FOR SELECT TO authenticated USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can add bucket items" ON public.bucket_list
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can update bucket items" ON public.bucket_list
  FOR UPDATE TO authenticated USING (public.is_space_member(space_id, auth.uid()))
  WITH CHECK (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can delete bucket items" ON public.bucket_list
  FOR DELETE TO authenticated USING (public.is_space_member(space_id, auth.uid()));

-- ============ Prompts ============
CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  category text NOT NULL DEFAULT 'daily',
  day_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day_index)
);
GRANT SELECT ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read prompts" ON public.prompts
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.prompts (day_index, body) VALUES
  (0, 'What is something small I did this week that you loved?'),
  (1, 'Where do you want to wake up together a year from now?'),
  (2, 'What is a moment from us you replay in your head?'),
  (3, 'What made you laugh today?'),
  (4, 'What do you need more of from me right now?'),
  (5, 'Describe the perfect slow Sunday with me.'),
  (6, 'What is one thing you are proud of us for?'),
  (7, 'What song has become ours?'),
  (8, 'What is a fear you have not said out loud yet?'),
  (9, 'What is the next place we should put a pin in?'),
  (10, 'What did you notice about me lately?'),
  (11, 'What tradition should we start?'),
  (12, 'What is the bravest thing you have seen me do?'),
  (13, 'What smell reminds you of me?');

CREATE TABLE public.prompt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_date date NOT NULL DEFAULT (now())::date,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, prompt_id, author_id, answer_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_answers TO authenticated;
GRANT ALL ON public.prompt_answers TO service_role;
ALTER TABLE public.prompt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view answers" ON public.prompt_answers
  FOR SELECT TO authenticated USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can answer" ON public.prompt_answers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Authors can edit their answer" ON public.prompt_answers
  FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete their answer" ON public.prompt_answers
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

ALTER TABLE public.prompt_answers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prompt_answers;

-- ============ Notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Members can notify their space" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (space_id IS NOT NULL AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_posted boolean NOT NULL DEFAULT true,
  comments boolean NOT NULL DEFAULT true,
  reactions boolean NOT NULL DEFAULT true,
  sealed_unlocked boolean NOT NULL DEFAULT true,
  anniversaries boolean NOT NULL DEFAULT true,
  streaks boolean NOT NULL DEFAULT true,
  quiet_from smallint NOT NULL DEFAULT 22,
  quiet_to smallint NOT NULL DEFAULT 8,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their notification prefs" ON public.notification_prefs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notification_prefs_touch BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Reports ============
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can report public posts" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND public.is_post_public(post_id));
CREATE POLICY "Reporters can see their reports" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can see all reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can resolve reports" ON public.reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Helpful indexes ============
CREATE INDEX IF NOT EXISTS posts_space_taken_idx ON public.posts (space_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS post_media_post_idx ON public.post_media (post_id, position);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS journal_space_date_idx ON public.journal_entries (space_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);