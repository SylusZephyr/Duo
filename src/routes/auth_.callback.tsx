import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Signing you in — Duo" }, { name: "robots", content: "noindex" }],
  }),
  component: AuthCallbackPage,
});

/**
 * Where Google sends people back to.
 *
 * Supabase's browser client exchanges the code in the URL for a session on its
 * own, but it does so asynchronously and may finish either side of this
 * component mounting. So we listen for the sign-in and also check for a
 * session that already landed — the same both-paths handling the password
 * reset screen needs, and for the same reason.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    // An OAuth error comes back in the query string or the hash fragment,
    // depending on where it failed.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthError = params.get("error_description") ?? hash.get("error_description");
    if (oauthError) {
      setFailed(oauthError);
      return;
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      navigate({ to: "/feed", replace: true });
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) done();
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        done();
        return;
      }
      // Give the client a moment to finish the exchange before giving up.
      setTimeout(() => {
        if (!settled) setFailed("We couldn't complete that sign-in.");
      }, 5000);
    });

    return () => subscription.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (failed) toast.error(failed);
  }, [failed]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {failed ? (
        <>
          <h1 className="font-display text-2xl">That sign-in didn&apos;t finish.</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{failed}</p>
          <button
            onClick={() => navigate({ to: "/auth", replace: true })}
            className="mt-2 inline-flex h-12 items-center rounded-2xl bg-ember px-6 text-sm font-medium text-ember-foreground"
          >
            Try again
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      )}
    </div>
  );
}
