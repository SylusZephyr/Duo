import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { BADGES, type BadgeKey } from "@/lib/achievements";

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPrefs = {
  partner_posted: boolean;
  comments: boolean;
  reactions: boolean;
  sealed_unlocked: boolean;
  anniversaries: boolean;
  streaks: boolean;
  quiet_from: number;
  quiet_to: number;
};

export const PREF_FIELDS = [
  {
    key: "partner_posted",
    label: "Moments, stories and journal",
    hint: "When your person adds something",
  },
  { key: "comments", label: "Replies", hint: "When they reply to a moment" },
  { key: "reactions", label: "Reactions", hint: "When they react to something of yours" },
  { key: "sealed_unlocked", label: "Sealed letters", hint: "When a letter's date arrives" },
  { key: "anniversaries", label: "Milestones", hint: "Milestones and things ticked off the list" },
  { key: "streaks", label: "Badges", hint: "When the two of you unlock one" },
] as const satisfies readonly { key: keyof NotificationPrefs; label: string; hint: string }[];

const BADGE_TITLES = new Map<string, string>(BADGES.map((badge) => [badge.key, badge.title]));

/**
 * An achievement notification carries only the badge key, because the database
 * has no business knowing what we call them. Resolve it for display.
 */
export function notificationTitle(notification: Notification) {
  if (notification.kind !== "achievement") return notification.title;
  const badge = notification.body ? BADGE_TITLES.get(notification.body) : null;
  return badge ? `Badge unlocked: ${badge}` : notification.title;
}

export function notificationBody(notification: Notification) {
  // For a badge the body is the key, which we have already folded into the title.
  if (notification.kind === "achievement") return null;
  return notification.body;
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUnreadNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications-unread", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .is("read_at", null);
      if (error) return 0;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids?: string[]) => {
      let update = supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId!)
        .is("read_at", null);
      if (ids && ids.length > 0) update = update.in("id", ids);
      const { error } = await update;
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
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
        .select(
          "partner_posted, comments, reactions, sealed_unlocked, anniversaries, streaks, quiet_from, quiet_to",
        )
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      // Everyone gets a row at signup, but an account created before that
      // migration may not have one. Absent means "everything on".
      return (
        data ?? {
          partner_posted: true,
          comments: true,
          reactions: true,
          sealed_unlocked: true,
          anniversaries: true,
          streaks: true,
          quiet_from: 22,
          quiet_to: 8,
        }
      );
    },
  });
}

export function useUpdateNotificationPrefs(userId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ["notification_prefs", userId];

  return useMutation({
    mutationFn: async (patch: Partial<NotificationPrefs>) => {
      const { error } = await supabase
        .from("notification_prefs")
        .upsert({ user_id: userId!, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationPrefs>(key);
      if (previous) queryClient.setQueryData(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/* ---------------- Achievements ---------------- */

export function useEarnedBadges(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["achievements", spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("key, earned_at, earned_by")
        .eq("space_id", spaceId!)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Record badges the couple has reached but not yet banked.
 *
 * The row is the unlock: inserting it is what dates the badge and what tells
 * both partners, via a trigger. UNIQUE (space_id, key) makes a repeat insert a
 * no-op, so this is safe to call on every visit, from either device, racing.
 */
export function useRecordBadges(spaceId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keys: BadgeKey[]) => {
      if (!spaceId || keys.length === 0) return [];
      const { data, error } = await supabase
        .from("achievements")
        .upsert(
          keys.map((key) => ({ space_id: spaceId, key, earned_by: userId ?? null })),
          { onConflict: "space_id,key", ignoreDuplicates: true },
        )
        .select("key");
      if (error) throw error;
      return (data ?? []).map((row) => row.key as BadgeKey);
    },
    onSuccess: (recorded) => {
      if (recorded.length === 0) return;
      queryClient.invalidateQueries({ queryKey: ["achievements", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
    },
  });
}

export function badgeTitle(key: string) {
  return BADGE_TITLES.get(key) ?? key;
}
