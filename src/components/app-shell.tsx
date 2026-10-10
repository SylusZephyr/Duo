import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookHeart,
  Compass,
  Dices,
  Heart,
  Map,
  MessageCircle,
  Plus,
  Shield,
  Sparkles,
  Images,
} from "lucide-react";
import type { ReactNode } from "react";

import { useIsModerator, useOpenReportCount } from "@/lib/moderation";
import { useUnreadNotifications } from "@/lib/notifications";
import { useMe, useUnreadMessages } from "@/lib/queries";
import { useNotificationsRealtime } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/feed", label: "Home", icon: Images },
  { to: "/map", label: "Places", icon: Map },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/us", label: "Us", icon: Sparkles },
] as const;

const QUICK = [
  { to: "/games", label: "Games", icon: Dices },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/dates", label: "Dates", icon: Heart },
] as const;

export function AppShell({
  title,
  subtitle,
  action,
  children,
  quickLinks = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  quickLinks?: boolean;
}) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: unread } = useUnreadMessages(me?.id);
  const { data: unreadNotifications } = useUnreadNotifications(me?.id);
  // Only moderators see the queue link, and only they get a count back.
  const { data: isModerator } = useIsModerator(me?.id);
  const { data: openReports } = useOpenReportCount(Boolean(isModerator));

  // The bell lives in every header, so the subscription that keeps it honest
  // belongs here rather than on one screen.
  useNotificationsRealtime(me?.id);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-2xl">
        <div className="aurora pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 pb-3.5 pt-5">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-extrabold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {action}
            {isModerator ? (
              <Link
                to="/moderation"
                className="press relative grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:text-candy"
                activeProps={{ className: "border-candy/50 bg-candy-soft text-candy" }}
                aria-label={
                  (openReports ?? 0) > 0
                    ? `Moderation queue, ${openReports} waiting`
                    : "Moderation queue"
                }
              >
                <Shield className="size-[18px]" />
                {(openReports ?? 0) > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {openReports! > 9 ? "9+" : openReports}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <Link
              to="/inbox"
              className="press relative grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:text-candy"
              activeProps={{ className: "border-candy/50 bg-candy-soft text-candy" }}
              aria-label={
                (unreadNotifications ?? 0) > 0 ? `Inbox, ${unreadNotifications} unread` : "Inbox"
              }
            >
              <Bell className="size-[18px]" />
              {(unreadNotifications ?? 0) > 0 ? (
                <span className="bg-gradient-candy absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white">
                  {unreadNotifications! > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <Link
              to="/explore"
              className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:text-candy"
              aria-label="Explore public moments"
            >
              <Compass className="size-[18px]" />
            </Link>
          </div>
        </div>

        {quickLinks ? (
          <div className="hide-scrollbar relative flex gap-2 overflow-x-auto px-5 pb-3">
            {QUICK.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="press flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-soft transition-colors hover:border-candy/40 hover:text-candy"
                activeProps={{ className: "border-candy/50 bg-candy-soft text-candy" }}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-2xl px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between rounded-[28px] border border-border bg-card/90 px-3 py-2 shadow-lift backdrop-blur-2xl">
            {TABS.slice(0, 2).map((tab) => (
              <TabLink key={tab.to} {...tab} />
            ))}
            <button
              onClick={() => navigate({ to: "/compose" })}
              className="press bg-gradient-candy -mt-7 grid size-14 place-items-center rounded-full text-white shadow-glow"
              aria-label="Add a moment"
            >
              <Plus className="size-6" strokeWidth={2.5} />
            </button>
            {TABS.slice(2).map((tab) => (
              <TabLink key={tab.to} {...tab} badge={tab.to === "/chat" ? (unread ?? 0) : 0} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  badge = 0,
}: {
  to: string;
  label: string;
  icon: typeof Map;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex w-16 flex-col items-center gap-1 rounded-2xl py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors",
      )}
      activeProps={{ className: "text-candy" }}
    >
      <span className="relative">
        <Icon className="size-[21px]" />
        {badge > 0 ? (
          <span className="bg-gradient-candy absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      {label}
    </Link>
  );
}
