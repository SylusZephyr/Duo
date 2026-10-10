import { supabase } from "@/integrations/supabase/client";

type NotifyInput = {
  spaceId: string;
  actorId: string;
  kind: "moment" | "comment" | "reaction" | "journal" | "milestone" | "prompt";
  title: string;
  body?: string;
  link?: string;
};

const PREF_BY_KIND = {
  moment: "partner_posted",
  comment: "comments",
  reaction: "reactions",
  journal: "sealed_unlocked",
  milestone: "anniversaries",
  prompt: "partner_posted",
} as const;

/**
 * Best-effort in-app notification for the other member of the space.
 * Never throws — a failed notification must not fail the action that caused it.
 */
export async function notifyPartner(input: NotifyInput) {
  try {
    const { data: members } = await supabase
      .from("space_members")
      .select("user_id")
      .eq("space_id", input.spaceId);

    const partner = (members ?? []).find((m) => m.user_id !== input.actorId);
    if (!partner) return;

    const { data: prefs } = await supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", partner.user_id)
      .maybeSingle();

    if (prefs && prefs[PREF_BY_KIND[input.kind]] === false) return;

    await supabase.from("notifications").insert({
      user_id: partner.user_id,
      space_id: input.spaceId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
  } catch {
    /* notifications are non-critical */
  }
}
