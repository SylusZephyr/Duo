import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Duo" },
      { name: "description", content: "Sign in to your shared space on Duo — moments, places and journals for two." },
      { property: "og:title", content: "Sign in to Duo" },
      { property: "og:description", content: "Your private space for two." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      navigate({ to: "/feed", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in didn't work. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/feed", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="font-display text-2xl">
          Duo
        </Link>
        <h1 className="mt-8 text-4xl leading-tight">
          {sent ? "Check your email" : mode === "signin" ? "Welcome back." : "Start your space."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {sent
            ? `We sent a confirmation link to ${email}. Open it and you're in.`
            : "One shared home for your photos, your places, your words."}
        </p>

        {!sent ? (
          <>
            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "signup" ? (
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={60}
                    className="h-12 rounded-2xl bg-secondary/40"
                    placeholder="Alex"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-2xl bg-secondary/40"
                  placeholder="you@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-2xl bg-secondary/40"
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-2xl bg-ember text-ember-foreground hover:bg-ember/90"
              >
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="outline"
              onClick={google}
              className="h-12 w-full rounded-2xl border-border bg-transparent"
            >
              Continue with Google
            </Button>

            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-8 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
