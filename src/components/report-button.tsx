import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { REPORT_REASONS, useReportPost, type ReportReason } from "@/lib/moderation";
import { cn } from "@/lib/utils";

/**
 * Lets a signed-in person flag a public moment.
 *
 * Anything shown to strangers needs one of these. Signed-out visitors are
 * sent to sign in rather than shown a form that cannot submit — reports are
 * attributable on purpose, since an anonymous report queue is a brigading
 * tool.
 */
export function ReportButton({ postId, className }: { postId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const report = useReportPost();

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, [open]);

  function submit() {
    if (!reason) return;
    report.mutate(
      { postId, reason, details: details.trim() || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          setReason(null);
          setDetails("");
          // Deliberately does not say whether this was the first report or a
          // repeat — the reporter does not need to know, and it keeps the
          // queue's shape private.
          toast.success("Thanks — a moderator will take a look.");
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Couldn't send that report"),
      },
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report this moment"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive",
          className,
        )}
      >
        <Flag className="size-3.5" />
        Report
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Report this moment</DialogTitle>
            <DialogDescription>
              {signedIn === false
                ? "You need an account to report something."
                : "Tell us what's wrong and a moderator will review it."}
            </DialogDescription>
          </DialogHeader>

          {signedIn === false ? (
            <a
              href="/auth"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-ember text-sm font-medium text-ember-foreground"
            >
              Sign in
            </a>
          ) : (
            <>
              <div className="space-y-2">
                {REPORT_REASONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setReason(option.value)}
                    className={cn(
                      "flex w-full items-center rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                      reason === option.value
                        ? "border-candy/50 bg-candy-soft text-candy"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <Textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Anything else we should know? (optional)"
                className="rounded-2xl bg-secondary/40"
              />

              <Button
                onClick={submit}
                disabled={!reason || report.isPending}
                className="h-12 w-full rounded-2xl bg-ember text-ember-foreground hover:bg-ember/90"
              >
                {report.isPending ? "Sending…" : "Send report"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
