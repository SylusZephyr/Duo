import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SignedImage } from "@/components/signed-image";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDay, placeLabel, relativeTime } from "@/lib/format";
import { useMe, useSpace } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/moment/$momentId")({
  head: () => ({
    meta: [
      { title: "A moment — Duo" },
      {
        name: "description",
        content: "A single moment from your shared timeline, with your notes to each other.",
      },
      { property: "og:title", content: "A moment — Duo" },
      { property: "og:description", content: "One moment, and what you said about it." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MomentPage,
});

function MomentPage() {
  const { momentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: space } = useSpace();
  const [body, setBody] = useState("");

  const { data: moment } = useQuery({
    queryKey: ["moment", momentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, author_id, caption, taken_at, place_name, city, country, post_media(id, storage_path, position)",
        )
        .eq("id", momentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", momentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("id, author_id, body, created_at")
        .eq("post_id", momentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function send() {
    if (!me || body.trim().length === 0) return;
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: momentId, author_id: me.id, body: body.trim().slice(0, 1000) });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    await queryClient.invalidateQueries({ queryKey: ["comments", momentId] });
    await queryClient.invalidateQueries({ queryKey: ["moments", space?.space.id] });
  }

  async function remove() {
    const { error } = await supabase.from("posts").delete().eq("id", momentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries();
    navigate({ to: "/feed", replace: true });
  }

  const place = moment ? placeLabel(moment) : "";

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur-xl">
        <button onClick={() => navigate({ to: "/feed" })} aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="font-display text-xl">Moment</h1>
        {moment?.author_id === me?.id ? (
          <button onClick={remove} aria-label="Delete moment">
            <Trash2 className="size-4 text-muted-foreground" />
          </button>
        ) : (
          <span className="size-4" />
        )}
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {(moment?.post_media ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((media) => (
            <SignedImage
              key={media.id}
              path={media.storage_path}
              alt={moment?.caption || "Moment"}
              className="mb-3 aspect-[4/5] w-full rounded-3xl"
              variant="full"
            />
          ))}

        {place ? <p className="text-xs text-gold">{place}</p> : null}
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {formatDay(moment?.taken_at)}
        </p>
        {moment?.caption ? (
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/90">{moment.caption}</p>
        ) : null}

        <section className="mt-8 space-y-4">
          {(comments ?? []).map((comment) => {
            const author = space?.members.find((m) => m.user_id === comment.author_id);
            return (
              <div key={comment.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {author?.display_name ?? "Someone"} · {relativeTime(comment.created_at)}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed">{comment.body}</p>
              </div>
            );
          })}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border/60 bg-background/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && send()}
            maxLength={1000}
            placeholder="Say something…"
            className="h-12 rounded-2xl bg-secondary/40"
          />
          <button
            onClick={send}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ember text-ember-foreground"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
