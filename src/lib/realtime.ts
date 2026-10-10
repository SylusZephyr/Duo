import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

const SPACE_TABLES = [
  "posts",
  "journal_entries",
  "milestones",
  "prompt_answers",
  "bucket_list",
] as const;
const POST_TABLES = ["post_media", "post_reactions", "post_comments"] as const;

/**
 * One channel per space that keeps both partners' screens in sync.
 * Row-level security still applies, so only rows this member may read arrive.
 */
export function useSpaceRealtime(spaceId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!spaceId) return;

    const channel = supabase.channel(`space:${spaceId}`);

    for (const table of SPACE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `space_id=eq.${spaceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [tableToKey(table), spaceId] });
          // A new or deleted post changes the map pins and the /us counts too,
          // and neither is derived from the feed cache any more.
          if (table === "posts") {
            queryClient.invalidateQueries({ queryKey: ["map-moments", spaceId] });
          }
          queryClient.invalidateQueries({ queryKey: ["space-stats", spaceId] });
        },
      );
    }

    // Filtered by space, like the tables above. Without the filter every
    // client subscribes to every reaction and comment in the database, and
    // the realtime server evaluates row-level security once per subscriber
    // per change — work that grows with users x writes rather than with
    // either alone. These tables carry space_id for exactly this reason.
    for (const table of POST_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `space_id=eq.${spaceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["moments", spaceId] });
          queryClient.invalidateQueries({ queryKey: ["comments"] });
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, queryClient]);
}

export function useNotificationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

function tableToKey(table: string) {
  if (table === "posts") return "moments";
  if (table === "journal_entries") return "journal";
  if (table === "prompt_answers") return "prompt-answers";
  return table;
}
