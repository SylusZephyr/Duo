import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-3xl border border-border bg-card px-6 py-14 text-center", className)}
    >
      {icon ? <div className="mx-auto mb-4 text-muted-foreground">{icon}</div> : null}
      <h2 className="font-display text-2xl">{title}</h2>
      {body ? (
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "That didn't load",
  body = "Something went wrong on our side. Try again in a moment.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden="true" />
      <h2 className="mt-3 font-display text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm transition-colors hover:bg-secondary"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-card", className)} />;
}

export function FeedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4">
            <Shimmer className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-3 w-28 rounded-full" />
              <Shimmer className="h-2.5 w-20 rounded-full" />
            </div>
          </div>
          <Shimmer className="aspect-[4/5] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Shimmer className="h-3 w-3/4 rounded-full" />
            <Shimmer className="h-3 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <Shimmer key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}
