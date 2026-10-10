import { createFileRoute } from "@tanstack/react-router";
import { EyeOff, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SignedImage } from "@/components/signed-image";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { formatDay, relativeTime } from "@/lib/format";
import {
  REPORT_REASONS,
  useIsModerator,
  useModeratePost,
  useModerationQueue,
  type QueueItem,
} from "@/lib/moderation";
import { useMe } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/moderation")({
  head: () => ({
    meta: [{ title: "Moderation — Duo" }, { name: "robots", content: "noindex" }],
  }),
  component: ModerationPage,
});

// Keyed loosely: the queue returns reasons as plain strings from SQL, and a
// reason added in a migration but not yet here should still render.
const REASON_LABELS = new Map<string, string>(REPORT_REASONS.map((r) => [r.value, r.label]));

function ModerationPage() {
  const { data: me } = useMe();
  const { data: isModerator, isLoading: checkingRole } = useIsModerator(me?.id);
  const { data: queue, isLoading, isError, refetch } = useModerationQueue(Boolean(isModerator));

  // The queue function returns nothing to a non-moderator regardless, so this
  // is a courtesy rather than the access control.
  if (!checkingRole && !isModerator) {
    return (
      <AppShell title="Moderation" quickLinks={false}>
        <EmptyState
          icon={<ShieldX className="mx-auto size-7" />}
          title="Not your queue"
          body="You need a moderator role to review reports."
        />
      </AppShell>
    );
  }

  const open = queue ?? [];

  return (
    <AppShell
      title="Moderation"
      subtitle={open.length > 0 ? `${open.length} waiting` : "Nothing waiting"}
      quickLinks={false}
    >
      {isError ? (
        <ErrorState title="The queue didn't load" onRetry={() => void refetch()} />
      ) : checkingRole || isLoading ? (
        <ListSkeleton count={3} />
      ) : open.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="mx-auto size-7" />}
          title="All clear"
          body="Nothing has been reported. Reports from /explore land here."
        />
      ) : (
        <div className="space-y-4">
          {open.map((item) => (
            <QueueCard key={item.post_id} item={item} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const moderate = useModeratePost();
  const [note, setNote] = useState("");

  function act(action: "take_down" | "restore" | "dismiss", label: string) {
    moderate.mutate(
      { postId: item.post_id, action, reason: note.trim() || undefined },
      {
        onSuccess: () => toast.success(label),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "That didn't work"),
      },
    );
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {item.report_count} {item.report_count === 1 ? "report" : "reports"} ·{" "}
            {relativeTime(item.first_reported_at)}
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {item.reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] text-destructive"
              >
                {REASON_LABELS.get(reason) ?? reason}
              </span>
            ))}
          </p>
        </div>
        {item.is_taken_down ? (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
            Taken down
          </span>
        ) : null}
      </header>

      {item.media_paths.length > 0 ? (
        <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          {item.media_paths.map((path) => (
            <SignedImage
              key={path}
              path={path}
              blurDataUrl={null}
              alt="Reported media"
              className="h-40 w-40 shrink-0 rounded-2xl object-cover"
            />
          ))}
        </div>
      ) : null}

      <div className="px-4 py-3">
        {item.caption ? <p className="text-[15px] leading-relaxed">{item.caption}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDay(item.taken_at)}
          {item.place ? ` · ${item.place}` : ""}
          {item.space_handle ? ` · @${item.space_handle}` : ""}
        </p>
      </div>

      <div className="space-y-2 border-t border-border/60 px-4 py-3">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          placeholder="Note for the record (optional)"
          className="h-10 w-full rounded-xl bg-secondary/40 px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap gap-2">
          {item.is_taken_down ? (
            <button
              onClick={() => act("restore", "Restored")}
              disabled={moderate.isPending}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm"
            >
              <RotateCcw className="size-3.5" /> Restore
            </button>
          ) : (
            <button
              onClick={() => act("take_down", "Taken down")}
              disabled={moderate.isPending}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-destructive px-4 text-sm font-medium text-destructive-foreground"
            >
              <EyeOff className="size-3.5" /> Take down
            </button>
          )}
          <button
            onClick={() => act("dismiss", "Dismissed")}
            disabled={moderate.isPending}
            className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm"
          >
            <ShieldCheck className="size-3.5" /> Dismiss
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Taking down removes it from Explore and public pages. The couple keeps the moment in their
          own space.
        </p>
      </div>
    </article>
  );
}
