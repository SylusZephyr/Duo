import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { MIN_PASSWORD_LENGTH, describePassword } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Duo" },
      { name: "description", content: "Set a new password for your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

type Stage = "checking" | "ready" | "expired" | "saved";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * The link in the email carries a recovery token. supabase-js consumes it
   * from the URL and emits PASSWORD_RECOVERY, but it may already have done so
   * before this component mounted — so check for a session as well as listening.
   */
  useEffect(() => {
    let settled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && !settled)) {
        settled = true;
        setStage("ready");
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      settled = true;
      setStage(data.session ? "ready" : "expired");
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();

    const problem = describePassword(password);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (password !== confirm) {
      toast.error("Those two passwords don't match");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStage("saved");
      toast.success("Password changed");
      // Straight into the app — updateUser leaves them signed in.
      navigate({ to: "/feed", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change your password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="font-display text-2xl">
          Duo
        </Link>

        {stage === "checking" ? (
          <p className="mt-8 text-sm text-muted-foreground">Checking your link…</p>
        ) : stage === "expired" ? (
          <>
            <h1 className="mt-8 text-4xl leading-tight">This link has expired.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Reset links only work once, and not for long. Ask for a new one and it will be in your
              inbox in a moment.
            </p>
            <Link
              to="/auth"
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-ember text-sm font-medium text-ember-foreground"
            >
              Send a new link
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-4xl leading-tight">Choose a new password.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters. Pick something you'll remember.
            </p>

            <form onSubmit={save} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-2xl bg-secondary/40"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Again, to be sure</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="h-12 rounded-2xl bg-secondary/40"
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                disabled={busy || stage === "saved"}
                className="h-12 w-full rounded-2xl bg-ember text-ember-foreground hover:bg-ember/90"
              >
                {busy ? "Saving…" : "Save new password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
