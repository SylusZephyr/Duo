import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Space = {
  id: string;
  name: string;
  handle: string | null;
  invite_code: string;
  is_public: boolean;
  anniversary_date: string | null;
  cover_path: string | null;
};

export type Member = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio?: string | null;
};

export type MomentMedia = {
  id: string;
  storage_path: string;
  position: number;
  blur_data_url: string | null;
  width: number | null;
  height: number | null;
};

export type Moment = {
  id: string;
  author_id: string;
  caption: string;
  mood: string | null;
  taken_at: string;
  created_at: string;
  visibility: string;
  place_name: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  media: MomentMedia[];
  reactions: { id: string; emoji: string; user_id: string }[];
  tags: string[];
  comment_count: number;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
}

export function useSpace() {
  return useQuery({
    queryKey: ["space"],
    queryFn: async () => {
      const { data: membership } = await supabase
        .from("space_members")
        .select("space_id")
        .limit(1)
        .maybeSingle();
      if (!membership) return null;

      const [{ data: space }, { data: members }] = await Promise.all([
        supabase
          .from("spaces")
          .select("id, name, handle, invite_code, is_public, anniversary_date, cover_path")
          .eq("id", membership.space_id)
          .maybeSingle(),
        supabase.from("space_members").select("user_id").eq("space_id", membership.space_id),
      ]);
      if (!space) return null;

      const ids = (members ?? []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

      return {
        space: space as Space,
        members: (profiles ?? []).map((p) => ({
          user_id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
        })) as Member[],
      };
    },
  });
}

export function useMoments(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["moments", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<Moment[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, author_id, caption, mood, taken_at, created_at, visibility, place_name, city, country, lat, lng, post_media(id, storage_path, position, blur_data_url, width, height), post_reactions(id, emoji, user_id), post_comments(id), post_tags(tag)",
        )
        .eq("space_id", spaceId!)
        .order("taken_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        author_id: row.author_id,
        caption: row.caption,
        mood: row.mood,
        taken_at: row.taken_at,
        created_at: row.created_at,
        visibility: row.visibility,
        place_name: row.place_name,
        city: row.city,
        country: row.country,
        lat: row.lat,
        lng: row.lng,
        media: (row.post_media ?? []).slice().sort((a, b) => a.position - b.position),
        reactions: row.post_reactions ?? [],
        tags: (row.post_tags ?? []).map((t) => t.tag),
        comment_count: (row.post_comments ?? []).length,
      }));
    },
  });
}

export function useSignedUrls(paths: string[]) {
  const key = paths.filter(Boolean).sort().join("|");
  return useQuery({
    queryKey: ["signed", key],
    enabled: key.length > 0,
    staleTime: 45 * 60_000,
    queryFn: async () => {
      const unique = Array.from(new Set(paths.filter(Boolean)));
      const { data } = await supabase.storage.from("moments").createSignedUrls(unique, 3600);
      const map: Record<string, string> = {};
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
  });
}

export function useJournal(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["journal", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select(
          "id, author_id, title, body, mood, entry_date, is_sealed, unlock_at, photo_path, created_at",
        )
        .eq("space_id", spaceId!)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMilestones(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["milestones", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, title, description, happened_at, photo_path, created_by")
        .eq("space_id", spaceId!)
        .order("happened_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBucketList(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["bucket_list", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bucket_list")
        .select("id, title, note, done, done_at, done_by, created_by, created_at")
        .eq("space_id", spaceId!)
        .order("done", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWishlist(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["wishlist_places", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_places")
        .select("id, name, city, country, lat, lng, note, visited, created_at")
        .eq("space_id", spaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The prompt rotates daily and deterministically, so both partners see the same one. */
export function useDailyPrompt(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["daily-prompt", spaceId, new Date().toISOString().slice(0, 10)],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data: prompts, error } = await supabase
        .from("prompts")
        .select("id, body, day_index")
        .order("day_index", { ascending: true });
      if (error) throw error;
      if (!prompts || prompts.length === 0) return null;
      const dayNumber = Math.floor(Date.now() / 86_400_000);
      return prompts[dayNumber % prompts.length] ?? null;
    },
    staleTime: 60 * 60_000,
  });
}

export function usePromptAnswers(spaceId: string | undefined, promptId: string | undefined) {
  return useQuery({
    queryKey: ["prompt-answers", spaceId, promptId],
    enabled: Boolean(spaceId && promptId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_answers")
        .select("id, author_id, body, answer_date, created_at")
        .eq("space_id", spaceId!)
        .eq("prompt_id", promptId!)
        .eq("answer_date", new Date().toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotificationPrefs(userId: string | undefined) {
  return useQuery({
    queryKey: ["notification_prefs", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_prefs")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: ["comments", postId],
    enabled: Boolean(postId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("id, author_id, body, created_at")
        .eq("post_id", postId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Reactions feel instant: we patch the cached moment first and roll the change
 * back if the write fails.
 */
export function useToggleReaction(spaceId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ["moments", spaceId];

  return useMutation({
    mutationFn: async (input: {
      postId: string;
      emoji: string;
      userId: string;
      existingId?: string;
    }) => {
      if (input.existingId) {
        const { error } = await supabase.from("post_reactions").delete().eq("id", input.existingId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("post_reactions")
        .insert({ post_id: input.postId, emoji: input.emoji, user_id: input.userId });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Moment[]>(key);
      queryClient.setQueryData<Moment[]>(key, (moments) =>
        (moments ?? []).map((moment) => {
          if (moment.id !== input.postId) return moment;
          const reactions = input.existingId
            ? moment.reactions.filter((r) => r.id !== input.existingId)
            : [
                ...moment.reactions,
                { id: `optimistic-${input.emoji}`, emoji: input.emoji, user_id: input.userId },
              ];
          return { ...moment, reactions };
        }),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useAddComment(postId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ["comments", postId];

  return useMutation({
    mutationFn: async (input: { body: string; userId: string }) => {
      const { error } = await supabase
        .from("post_comments")
        .insert({ post_id: postId!, author_id: input.userId, body: input.body });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<
          { id: string; author_id: string; body: string; created_at: string }[]
        >(key);
      queryClient.setQueryData(key, [
        ...(previous ?? []),
        {
          id: `optimistic-${Date.now()}`,
          author_id: input.userId,
          body: input.body,
          created_at: new Date().toISOString(),
        },
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
export { useUnreadMessages } from "@/lib/social";
