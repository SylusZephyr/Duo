import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useSpace } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/start")({
  head: () => ({
    meta: [
      { title: "Create your space — Duo" },
      {
        name: "description",
        content: "Create a shared space or join your partner with an invite code.",
      },
      { property: "og:title", content: "Create your space — Duo" },
      { property: "og:description", content: "Two people, one private space." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StartPage,
});

function inviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function StartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: existing } = useSpace();
  const [name, setName] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function createSpace() {
    if (!me) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("spaces")
        .insert({
          name: name.trim() || "Us",
          created_by: me.id,
          invite_code: inviteCode(),
          ...(anniversary ? { anniversary_date: anniversary } : {}),
        })
        .select("id, invite_code")
        .single();
      if (error) throw error;
      const { error: memberError } = await supabase
        .from("space_members")
        .insert({ space_id: data.id, user_id: me.id });
      if (memberError) throw memberError;
      await queryClient.invalidateQueries();
      toast.success(`Space created. Invite code: ${data.invite_code}`);
      navigate({ to: "/feed", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the space");
    } finally {
      setBusy(false);
    }
  }

  async function joinSpace() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("join_space_by_code", { _code: code.trim() });
      if (error) throw error;
      await queryClient.invalidateQueries();
      toast.success("You're in.");
      navigate({ to: "/feed", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (existing) {
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <h1 className="text-3xl">You already have a space</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Share code{" "}
          <button
            onClick={() => {
              navigator.clipboard.writeText(existing.space.invite_code);
              toast.success("Invite code copied");
            }}
            className="inline-flex items-center gap-1 font-mono text-gold"
          >
            {existing.space.invite_code} <Copy className="size-3" />
          </button>{" "}
          with your person.
        </p>
        <Button
          onClick={() => navigate({ to: "/feed" })}
          className="mt-8 h-12 w-full rounded-2xl bg-ember text-ember-foreground hover:bg-ember/90"
        >
          Go to your moments
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <Heart className="size-7 text-ember" />
      <h1 className="mt-6 text-4xl leading-tight">Two people, one space.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Create your space and send the invite code to your person. Only the two of you can ever see
        inside.
      </p>

      <div className="mt-10 space-y-4 rounded-3xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="space-name">Name your space</Label>
          <Input
            id="space-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="Alex & Sam"
            className="h-12 rounded-2xl bg-secondary/40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="anniversary">Together since (optional)</Label>
          <Input
            id="anniversary"
            type="date"
            value={anniversary}
            onChange={(event) => setAnniversary(event.target.value)}
            className="h-12 rounded-2xl bg-secondary/40"
          />
        </div>
        <Button
          onClick={createSpace}
          disabled={busy}
          className="h-12 w-full rounded-2xl bg-ember text-ember-foreground hover:bg-ember/90"
        >
          Create our space
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or join{" "}
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <Label htmlFor="code">Invite code</Label>
        <Input
          id="code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          maxLength={10}
          placeholder="ABC123"
          className="h-12 rounded-2xl bg-secondary/40 font-mono tracking-[0.3em]"
        />
        <Button
          variant="outline"
          onClick={joinSpace}
          disabled={busy || code.trim().length < 4}
          className="h-12 w-full rounded-2xl border-border bg-transparent"
        >
          Join their space
        </Button>
      </div>
    </div>
  );
}
