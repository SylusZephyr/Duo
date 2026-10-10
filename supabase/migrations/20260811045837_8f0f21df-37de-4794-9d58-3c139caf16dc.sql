-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  handle TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- spaces
CREATE TABLE public.spaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  handle TEXT UNIQUE,
  anniversary_date DATE,
  invite_code TEXT NOT NULL UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  cover_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.spaces TO authenticated;
GRANT SELECT ON public.spaces TO anon;
GRANT ALL ON public.spaces TO service_role;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.space_members (
  space_id UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.space_members TO authenticated;
GRANT SELECT ON public.space_members TO anon;
GRANT ALL ON public.space_members TO service_role;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

-- membership helper (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_space_member(_space_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = _space_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.space_member_count(_space_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.space_members WHERE space_id = _space_id
$$;

CREATE POLICY "Members can view their space" ON public.spaces FOR SELECT TO authenticated
  USING (public.is_space_member(id, auth.uid()));
CREATE POLICY "Public spaces are viewable by anyone" ON public.spaces FOR SELECT USING (is_public = true);
CREATE POLICY "Users can create a space" ON public.spaces FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members can update their space" ON public.spaces FOR UPDATE TO authenticated
  USING (public.is_space_member(id, auth.uid())) WITH CHECK (public.is_space_member(id, auth.uid()));

CREATE POLICY "Members can view space membership" ON public.space_members FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Membership of public spaces is viewable" ON public.space_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.is_public));
CREATE POLICY "Users can add themselves to a space" ON public.space_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.space_member_count(space_id) < 2);
CREATE POLICY "Users can leave a space" ON public.space_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- posts
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  taken_at DATE NOT NULL DEFAULT (now()::date),
  place_name TEXT,
  city TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  mood TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_space_created_idx ON public.posts (space_id, created_at DESC);
CREATE INDEX posts_public_idx ON public.posts (created_at DESC) WHERE visibility = 'public';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view space posts" ON public.posts FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Public posts are viewable by anyone" ON public.posts FOR SELECT
  USING (visibility = 'public' AND EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.is_public));
CREATE POLICY "Members can create posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can update space posts" ON public.posts FOR UPDATE TO authenticated
  USING (public.is_space_member(space_id, auth.uid())) WITH CHECK (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Authors can delete their posts" ON public.posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.can_read_post(_post_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id AND public.is_space_member(p.space_id, _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_post_public(_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.spaces s ON s.id = p.space_id
    WHERE p.id = _post_id AND p.visibility = 'public' AND s.is_public
  )
$$;

-- post media
CREATE TABLE public.post_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_path TEXT,
  width INTEGER,
  height INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX post_media_post_idx ON public.post_media (post_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO authenticated;
GRANT SELECT ON public.post_media TO anon;
GRANT ALL ON public.post_media TO service_role;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view post media" ON public.post_media FOR SELECT TO authenticated
  USING (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Public post media is viewable" ON public.post_media FOR SELECT
  USING (public.is_post_public(post_id));
CREATE POLICY "Members can add post media" ON public.post_media FOR INSERT TO authenticated
  WITH CHECK (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can update post media" ON public.post_media FOR UPDATE TO authenticated
  USING (public.can_read_post(post_id, auth.uid())) WITH CHECK (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can delete post media" ON public.post_media FOR DELETE TO authenticated
  USING (public.can_read_post(post_id, auth.uid()));

-- reactions
CREATE TABLE public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view reactions" ON public.post_reactions FOR SELECT TO authenticated
  USING (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can react" ON public.post_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Users can remove their reaction" ON public.post_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- comments
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX post_comments_post_idx ON public.post_comments (post_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view comments" ON public.post_comments FOR SELECT TO authenticated
  USING (public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Members can comment" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.can_read_post(post_id, auth.uid()));
CREATE POLICY "Authors can delete their comment" ON public.post_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- journal
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  mood TEXT,
  entry_date DATE NOT NULL DEFAULT (now()::date),
  is_sealed BOOLEAN NOT NULL DEFAULT false,
  unlock_at DATE,
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX journal_space_date_idx ON public.journal_entries (space_id, entry_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read unsealed entries" ON public.journal_entries FOR SELECT TO authenticated
  USING (
    public.is_space_member(space_id, auth.uid())
    AND (
      auth.uid() = author_id
      OR is_sealed = false
      OR (unlock_at IS NOT NULL AND unlock_at <= now()::date)
    )
  );
CREATE POLICY "Members can write entries" ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Authors can update their entries" ON public.journal_entries FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete their entries" ON public.journal_entries FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- milestones
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  happened_at DATE NOT NULL DEFAULT (now()::date),
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX milestones_space_date_idx ON public.milestones (space_id, happened_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view milestones" ON public.milestones FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can add milestones" ON public.milestones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can update milestones" ON public.milestones FOR UPDATE TO authenticated
  USING (public.is_space_member(space_id, auth.uid())) WITH CHECK (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can delete milestones" ON public.milestones FOR DELETE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

-- achievements
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  key TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (space_id, key)
);
GRANT SELECT, INSERT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view achievements" ON public.achievements FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can record achievements" ON public.achievements FOR INSERT TO authenticated
  WITH CHECK (public.is_space_member(space_id, auth.uid()));

-- timestamps + profile bootstrap
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER spaces_touch BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER journal_touch BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();