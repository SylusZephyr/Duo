import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { prepareImage } from "@/lib/image";

export type Story = {
  id: string;
  author_id: string;
  storage_path: string;
  blur_data_url: string | null;
  caption: string;
  created_at: string;
  expires_at: string;
  viewed_by: string[];
};

export type Message = {
  id: string;
  author_id: string;
  kind: string;
  body: string;
  storage_path: string | null;
  reply_to: string | null;
  seen_at: string | null;
  created_at: string;
  reactions: { id: string; emoji: string; user_id: string }[];
};

const today = () => new Date().toISOString().slice(0, 10);

/* ---------------- Stories ---------------- */

export function useStories(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["stories", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<Story[]> => {
      const { data, error } = await supabase
        .from("stories")
        .select("id, author_id, storage_path, blur_data_url, caption, created_at, expires_at, story_views(user_id)")
        .eq("space_id", spaceId!)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        author_id: s.author_id,
        storage_path: s.storage_path,
        blur_data_url: s.blur_data_url,
        caption: s.caption,
        created_at: s.created_at,
        expires_at: s.expires_at,
        viewed_by: (s.story_views ?? []).map((v) => v.user_id),
      }));
    },
  });
}

export function useAddStory(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; caption: string; userId: string }) => {
      const prepared = await prepareImage(input.file);
      const path = `spaces/${spaceId}/stories/${crypto.randomUUID()}.${prepared.extension}`;
      const { error: upErr } = await supabase.storage
        .from("moments")
        .upload(path, prepared.blob, { contentType: prepared.mimeType, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("stories").insert({
        space_id: spaceId!,
        author_id: input.userId,
        storage_path: path,
        blur_data_url: prepared.blurDataUrl || null,
        caption: input.caption.slice(0, 200),
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["stories", spaceId] }),
  });
}

export async function markStorySeen(storyId: string, userId: string) {
  await supabase.from("story_views").upsert(
    { story_id: storyId, user_id: userId },
    { onConflict: "story_id,user_id", ignoreDuplicates: true },
  );
}

export async function deleteStory(storyId: string) {
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
}

/* ---------------- Chat ---------------- */

export function useMessages(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["messages", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, author_id, kind, body, storage_path, reply_to, seen_at, created_at, message_reactions(id, emoji, user_id)")
        .eq("space_id", spaceId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? [])
        .map((m) => ({
          id: m.id,
          author_id: m.author_id,
          kind: m.kind,
          body: m.body,
          storage_path: m.storage_path,
          reply_to: m.reply_to,
          seen_at: m.seen_at,
          created_at: m.created_at,
          reactions: m.message_reactions ?? [],
        }))
        .reverse();
    },
  });
}

export function useUnreadMessages(userId: string | undefined) {
  return useQuery({
    queryKey: ["unread", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("author_id", userId!)
        .is("seen_at", null);
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}

export function useSendMessage(spaceId: string | undefined) {
  const qc = useQueryClient();
  const key = ["messages", spaceId];
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      body: string;
      kind?: string;
      file?: File;
      replyTo?: string | null;
    }) => {
      let storage_path: string | null = null;
      if (input.file) {
        const prepared = await prepareImage(input.file);
        storage_path = `spaces/${spaceId}/chat/${crypto.randomUUID()}.${prepared.extension}`;
        const { error: upErr } = await supabase.storage
          .from("moments")
          .upload(storage_path, prepared.blob, { contentType: prepared.mimeType });
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("messages").insert({
        space_id: spaceId!,
        author_id: input.userId,
        body: input.body.slice(0, 4000),
        kind: input.file ? "photo" : (input.kind ?? "text"),
        storage_path,
        reply_to: input.replyTo ?? null,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Message[]>(key);
      if (!input.file) {
        qc.setQueryData<Message[]>(key, [
          ...(previous ?? []),
          {
            id: `optimistic-${Date.now()}`,
            author_id: input.userId,
            kind: input.kind ?? "text",
            body: input.body,
            storage_path: null,
            reply_to: input.replyTo ?? null,
            seen_at: null,
            created_at: new Date().toISOString(),
            reactions: [],
          },
        ]);
      }
      return { previous };
    },
    onError: (_e, _i, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export async function markMessagesSeen(spaceId: string, userId: string) {
  await supabase
    .from("messages")
    .update({ seen_at: new Date().toISOString() })
    .eq("space_id", spaceId)
    .neq("author_id", userId)
    .is("seen_at", null);
}

export async function toggleMessageReaction(messageId: string, userId: string, emoji: string, existingId?: string) {
  if (existingId) {
    await supabase.from("message_reactions").delete().eq("id", existingId);
  } else {
    await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
  }
}

/* ---------------- Games ---------------- */

export function useGameRounds(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["game_rounds", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_rounds")
        .select("id, game, question, options, round_date, created_by, created_at, game_answers(id, user_id, answer, created_at)")
        .eq("space_id", spaceId!)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        options: Array.isArray(r.options) ? (r.options as string[]) : [],
        answers: r.game_answers ?? [],
      }));
    },
  });
}

export function useStartRound(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { game: string; question: string; options: string[]; userId: string }) => {
      const { error } = await supabase.from("game_rounds").insert({
        space_id: spaceId!,
        game: input.game,
        question: input.question,
        options: input.options,
        created_by: input.userId,
        round_date: today(),
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["game_rounds", spaceId] }),
  });
}

export function useAnswerRound(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { roundId: string; answer: string; userId: string }) => {
      const { error } = await supabase.from("game_answers").insert({
        round_id: input.roundId,
        space_id: spaceId!,
        user_id: input.userId,
        answer: input.answer.slice(0, 500),
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["game_rounds", spaceId] }),
  });
}

/* ---------------- Dates: countdowns + gifts ---------------- */

export function useCountdowns(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["countdowns", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countdowns")
        .select("id, title, emoji, happens_at, repeats_yearly, created_by")
        .eq("space_id", spaceId!)
        .order("happens_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGifts(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["gift_ideas", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_ideas")
        .select("id, title, note, url, price, for_user, claimed, created_by, created_at")
        .eq("space_id", spaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Next occurrence of a date, honouring yearly repeats. */
export function nextOccurrence(dateStr: string, yearly: boolean) {
  const base = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (!yearly || base >= now) return base;
  const next = new Date(base);
  next.setFullYear(now.getFullYear());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  return next;
}

export function daysUntil(date: Date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - now.getTime()) / 86_400_000);
}

/* ---------------- Realtime for the new tables ---------------- */

export function useSocialRealtime(spaceId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase.channel(`social:${spaceId}`);
    const spaceTables = ["messages", "stories", "game_rounds", "game_answers", "countdowns"] as const;
    for (const table of spaceTables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `space_id=eq.${spaceId}` },
        () => {
          const key = table === "game_answers" ? "game_rounds" : table;
          qc.invalidateQueries({ queryKey: [key, spaceId] });
          if (table === "messages") qc.invalidateQueries({ queryKey: ["unread", userId] });
        },
      );
    }
    channel.on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () =>
      qc.invalidateQueries({ queryKey: ["messages", spaceId] }),
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, userId, qc]);
}
