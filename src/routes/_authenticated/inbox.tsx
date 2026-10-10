import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  BellOff,
  BookHeart,
  Dices,
  Heart,
  Images,
  MailOpen,
  MessageCircle,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Switch } from "@/components/ui/switch";
import { relativeTime } from "@/lib/format";
import {
  PREF_FIELDS,
  notificationBody,
  notificationTitle,
  useMarkNotificationsRead,
  useNotificationPrefs,
  useNotifications,
  useUpdateNotificationPrefs,
  type Notification,
} from "@/lib/notifications";
import { useMe } from "@/lib/queries";
import { useNotificationsRealtime } from "@/lib/realtime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Duo" },
      { name: "description", content: "Everything your person has been up to." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InboxPage,
});

const ICONS: Record<string, typeof Images> = {
  moment: Images,
  story: Sparkles,
  comment: MessageCircle,
  reaction: Heart,
  journal: BookHeart,
  sealed: MailOpen,
  milestone: Heart,
  achievement: Award,
  game: Dices,
  prompt: Sparkles,
};

function InboxPage() {
  const { data: me } = useMe();
  const { data: notifications, isLoading, isError, refetch } = useNotifications(me?.id);
  const markRead = useMarkNotificationsRead(me?.id);
  const [showSettings, setShowSettings] = useState(false);

  useNotificationsRealtime(me?.id);

  const unread = (notifications ?? []).filter((n) => n.read_at === null);

  // Opening the inbox is reading it. Clear the badge once, for what was
  // unread when we arrived — anything that lands while you are looking at the
  // page stays highlighted so you notice it.
  useEffect(() => {
    if (unread.length === 0 || markRead.isPending) return;
    const ids = unread.map((n) => n.id);
    markRead.mutate(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications === undefined]);

  return (
    <AppShell
      title="Inbox"
      subtitle={unread.length > 0 ? `${unread.length} new` : "All caught up"}
      quickLinks={false}
      action={
        <button
          onClick={() => setShowSettings((open) => !open)}
          aria-expanded={showSettings}
          className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:text-candy"
          aria-label="Notification settings"
        >
          <Settings2 className="size-[18px]" />
        </button>
      }
    >
      {showSettings ? <PrefsPanel userId={me?.id} /> : null}

      {isError ? (
        <ErrorState
          title="Your inbox didn't load"
          body="We couldn't reach it just now."
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <ListSkeleton count={4} />
      ) : (notifications ?? []).length === 0 ? (
        <EmptyState
          icon={<BellOff className="mx-auto size-7" />}
          title="Nothing yet"
          body="When your person posts a moment, replies or seals you a letter, it shows up here."
        />
      ) : (
        <div className="space-y-2">
          {(notifications ?? []).map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const Icon = ICONS[notification.kind] ?? Sparkles;
  const unread = notification.read_at === null;
  const body = notificationBody(notification);

  const content = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full border",
          unread ? "border-candy/40 bg-candy-soft text-candy" : "border-border bg-card",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-snug", unread && "font-semibold")}>
          {notificationTitle(notification)}
        </span>
        {body ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{body}</span>
        ) : null}
        <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {relativeTime(notification.created_at)}
        </span>
      </span>
      {unread ? <span className="bg-gradient-candy mt-1 size-2 shrink-0 rounded-full" /> : null}
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors",
    unread ? "border-candy/30 bg-candy-soft/40" : "border-border bg-card hover:bg-secondary/40",
  );

  // Links are stored as plain paths by the database triggers. Route the ones
  // we recognise; anything else stays a non-interactive row rather than
  // sending the router somewhere it cannot go.
  const momentId = momentIdOf(notification.link);
  if (momentId) {
    return (
      <Link to="/moment/$momentId" params={{ momentId }} className={cn(className, "press")}>
        {content}
      </Link>
    );
  }

  const section = sectionOf(notification.link);
  if (section) {
    return (
      <Link to={section} className={cn(className, "press")}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

const SECTIONS = ["/feed", "/journal", "/us", "/games", "/map", "/chat", "/dates"] as const;

type Section = (typeof SECTIONS)[number];

function sectionOf(link: string | null): Section | null {
  return SECTIONS.find((section) => section === link) ?? null;
}

function momentIdOf(link: string | null): string | null {
  if (!link) return null;
  const match = /^\/moment\/([0-9a-f-]{36})$/.exec(link);
  return match ? match[1]! : null;
}

function PrefsPanel({ userId }: { userId: string | undefined }) {
  const { data: prefs } = useNotificationPrefs(userId);
  const update = useUpdateNotificationPrefs(userId);

  return (
    <section className="mb-5 rounded-3xl border border-border bg-card p-5">
      <h2 className="font-display text-lg">What reaches you</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Turning something off stops it being recorded at all — nothing is hidden from you here.
      </p>
      <div className="mt-4 space-y-3.5">
        {PREF_FIELDS.map((field) => (
          <label key={field.key} className="flex items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm">{field.label}</span>
              <span className="block text-xs text-muted-foreground">{field.hint}</span>
            </span>
            <Switch
              checked={prefs?.[field.key] ?? true}
              disabled={!prefs}
              onCheckedChange={(checked) => {
                update.mutate(
                  { [field.key]: checked },
                  {
                    onError: () => toast.error("Couldn't save that — try again"),
                  },
                );
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
