import { createFileRoute } from "@tanstack/react-router";
import { Heart, ImagePlus, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SignedImage } from "@/components/signed-image";
import { EmptyState, ListSkeleton } from "@/components/states";
import { useMe } from "@/lib/queries";
import {
  markMessagesSeen,
  toggleMessageReaction,
  useMessages,
  useSendMessage,
  useSocialRealtime,
} from "@/lib/social";
import { useRequireSpace } from "@/lib/use-require-space";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Duo" },
      { name: "description", content: "Private chat and love notes for the two of you." },
      { property: "og:title", content: "Chat — Duo" },
      { property: "og:description", content: "A private chat for two." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});

const LOVE_NOTES = [
  "Thinking of you 💭",
  "I miss you 🥺",
  "You make me so happy ☀️",
  "Can't wait to see you 💞",
  "Good morning, love ☕",
  "Sweet dreams 🌙",
];

function ChatPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data } = useRequireSpace();
  const spaceId = data?.space.id;
  const { data: messages, isLoading } = useMessages(spaceId);
  const send = useSendMessage(spaceId);
  const [text, setText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useSocialRealtime(spaceId, me?.id);

  const partner = data?.members.find((m) => m.user_id !== me?.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (spaceId && me?.id && messages?.some((m) => m.author_id !== me.id && !m.seen_at)) {
      void markMessagesSeen(spaceId, me.id).then(() =>
        qc.invalidateQueries({ queryKey: ["unread", me.id] }),
      );
    }
  }, [messages, spaceId, me?.id, qc]);

  function submit(body: string, kind = "text") {
    const trimmed = body.trim();
    if (!trimmed || !me) return;
    setText("");
    send.mutate(
      { userId: me.id, body: trimmed, kind },
      { onError: () => toast.error("Message didn't send") },
    );
  }

  const last = messages?.[messages.length - 1];

  return (
    <AppShell title={partner?.display_name ?? "Chat"} subtitle="Just you two" quickLinks={false}>
      <div className="pb-40">
        {isLoading ? (
          <ListSkeleton />
        ) : (messages ?? []).length === 0 ? (
          <EmptyState
            icon={<Heart className="mx-auto size-7 text-candy" />}
            title="Say something sweet"
            body={
              partner
                ? `Your first message to ${partner.display_name} starts here.`
                : "Invite your person to start chatting."
            }
          />
        ) : (
          <div className="space-y-1.5">
            {messages!.map((m, i) => {
              const mine = m.author_id === me?.id;
              const prev = messages![i - 1];
              const gap =
                !prev ||
                new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() >
                  30 * 60_000;
              const heart = m.reactions.find((r) => r.user_id === me?.id && r.emoji === "❤️");
              return (
                <div key={m.id}>
                  {gap ? (
                    <p className="py-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString(undefined, {
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                  <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      onDoubleClick={() =>
                        me &&
                        !m.id.startsWith("optimistic") &&
                        toggleMessageReaction(m.id, me.id, "❤️", heart?.id).then(() =>
                          qc.invalidateQueries({ queryKey: ["messages", spaceId] }),
                        )
                      }
                      className={cn(
                        "relative max-w-[78%] select-none rounded-3xl text-[15px] leading-snug",
                        m.kind === "love" && "duo-rise",
                        m.storage_path ? "overflow-hidden p-1" : "px-4 py-2.5",
                        mine
                          ? m.kind === "love"
                            ? "bg-gradient-candy text-white shadow-glow"
                            : "bg-gradient-candy rounded-br-lg text-white"
                          : "rounded-bl-lg border border-border bg-card shadow-soft",
                      )}
                    >
                      {m.storage_path ? (
                        <SignedImage
                          path={m.storage_path}
                          alt="Shared photo"
                          className="aspect-square w-60 rounded-[20px]"
                        />
                      ) : null}
                      {m.body ? (
                        <p
                          className={cn(
                            m.storage_path && "px-3 py-2",
                            m.kind === "love" && "font-display font-bold",
                          )}
                        >
                          {m.body}
                        </p>
                      ) : null}
                      {m.reactions.length ? (
                        <span className="absolute -bottom-2.5 right-2 rounded-full border border-border bg-card px-1.5 text-xs shadow-soft">
                          {m.reactions.map((r) => r.emoji).join("")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {last && last.author_id === me?.id && last.seen_at ? (
              <p className="pr-2 pt-1 text-right text-[11px] text-muted-foreground">Seen</p>
            ) : null}
            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Double-tap a message to ❤️ it
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed inset-x-0 bottom-24 z-30">
        <div className="mx-auto max-w-2xl px-4">
          {showNotes ? (
            <div className="hide-scrollbar mb-2 flex gap-2 overflow-x-auto">
              {LOVE_NOTES.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    submit(n, "love");
                    setShowNotes(false);
                  }}
                  className="press shrink-0 rounded-full border border-candy/30 bg-candy-soft px-3.5 py-2 text-xs font-semibold text-candy"
                >
                  {n}
                </button>
              ))}
            </div>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
            className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-lift"
          >
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              aria-label="Love notes"
              className="press grid size-10 place-items-center rounded-full text-candy"
            >
              <Sparkles className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Send a photo"
              className="press grid size-10 place-items-center rounded-full text-muted-foreground"
            >
              <ImagePlus className="size-5" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message…"
              maxLength={4000}
              className="h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Send"
              className="press bg-gradient-candy grid size-10 place-items-center rounded-full text-white disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || !me) return;
              toast.promise(send.mutateAsync({ userId: me.id, body: "", file }), {
                loading: "Sending photo…",
                success: "Photo sent",
                error: "Photo didn't send",
              });
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
