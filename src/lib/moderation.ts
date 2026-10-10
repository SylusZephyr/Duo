import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Why someone is reporting. The database constrains `reason` to exactly this
 * set, so adding one here without a migration fails the insert rather than
 * silently storing something the queue cannot group by.
 */
export const REPORT_REASONS = [
  { value: "sexual", label: "Sexual content" },
  { value: "violence", label: "Violence or gore" },
  { value: "hate", label: "Hate speech" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "minor", label: "Involves a minor" },
  { value: "spam", label: "Spam or a scam" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export type QueueItem = {
  post_id: string;
  caption: string;
  taken_at: string;
  place: string | null;
  space_handle: string | null;
  media_paths: string[];
  report_count: number;
  reasons: string[];
  first_reported_at: string;
  is_taken_down: boolean;
};

export function useIsModerator(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-moderator", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_moderator", { _user_id: userId! });
      if (error) return false;
      return Boolean(data);
    },
  });
}

export function useOpenReportCount(enabled: boolean) {
  return useQuery({
    queryKey: ["open-report-count"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("open_report_count");
      if (error) return 0;
      return (data as number) ?? 0;
    },
  });
}

export function useModerationQueue(enabled: boolean) {
  return useQuery({
    queryKey: ["moderation-queue"],
    enabled,
    queryFn: async (): Promise<QueueItem[]> => {
      const { data, error } = await supabase.rpc("moderation_queue");
      if (error) throw error;
      return (data as QueueItem[]) ?? [];
    },
  });
}

export function useReportPost() {
  return useMutation({
    mutationFn: async (input: {
      postId: string;
      reason: ReportReason;
      details?: string | undefined;
    }) => {
      const { error } = await supabase.rpc("report_post", {
        _post_id: input.postId,
        _reason: input.reason,
        _details: input.details ?? null,
      });
      if (error) throw error;
    },
  });
}

export function useModeratePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      postId: string;
      action: "take_down" | "restore" | "dismiss";
      reason?: string | undefined;
    }) => {
      const { error } = await supabase.rpc("moderate_post", {
        _post_id: input.postId,
        _action: input.action,
        _reason: input.reason ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["open-report-count"] });
      queryClient.invalidateQueries({ queryKey: ["public-moments"] });
    },
  });
}
