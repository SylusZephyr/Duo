import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Globe2, ImagePlus, Loader2, Lock, MapPin, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PlacePicker } from "@/components/place-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { prepareImage, previewPath, type PreparedImage } from "@/lib/image";
import { reverseGeocode, type PlaceHit } from "@/lib/maps.functions";
import { useMe } from "@/lib/queries";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTOS_PER_MOMENT,
  MAX_UPLOAD_BYTES,
  describeZodError,
  momentSchema,
} from "@/lib/schemas";
import { useRequireSpace } from "@/lib/use-require-space";

const MOODS = ["✨ magic", "😌 calm", "🔥 alive", "🥹 tender", "😂 silly", "🌧 heavy"];

type Draft = { id: string; previewUrl: string; prepared: PreparedImage };

export const Route = createFileRoute("/_authenticated/compose")({
  head: () => ({
    meta: [
      { title: "Add a moment — Duo" },
      {
        name: "description",
        content: "Add photos, a place and a few words to your shared timeline.",
      },
      { property: "og:title", content: "Add a moment — Duo" },
      { property: "og:description", content: "Photos, places and words for two." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComposePage,
});

function ComposePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data } = useRequireSpace();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [processing, setProcessing] = useState(false);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [place, setPlace] = useState<PlaceHit | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = MAX_PHOTOS_PER_MOMENT - drafts.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_PHOTOS_PER_MOMENT} photos per moment`);
      return;
    }

    setProcessing(true);
    try {
      for (const file of Array.from(list).slice(0, room)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`${file.name} is larger than 25 MB`);
          continue;
        }
        if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
          toast.error(`${file.name} is not a supported image`);
          continue;
        }
        try {
          const prepared = await prepareImage(file);
          setDrafts((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              previewUrl: URL.createObjectURL(prepared.blob),
              prepared,
            },
          ]);
          if (prepared.takenAt) setTakenAt(prepared.takenAt);
          if (prepared.gps) void suggestPlaceFromGps(prepared.gps);
        } catch {
          toast.error(`Couldn't read ${file.name}`);
        }
      }
    } finally {
      setProcessing(false);
    }
  }

  async function suggestPlaceFromGps(gps: { lat: number; lng: number }) {
    if (place) return;
    try {
      const hit = await reverseGeocode({ data: gps });
      if (hit) {
        setPlace(hit);
        toast.success(`Place detected: ${hit.name}`);
      }
    } catch {
      /* location suggestion is optional */
    }
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.id !== id);
    });
  }

  function commitTag() {
    const value = tagInput.trim().toLowerCase().replace(/^#/, "").slice(0, 24);
    if (!value) return;
    setTags((prev) => (prev.includes(value) || prev.length >= 10 ? prev : [...prev, value]));
    setTagInput("");
  }

  async function publish() {
    if (!me || !data) return;
    if (drafts.length === 0 && caption.trim().length === 0) {
      toast.error("Add a photo or a few words first");
      return;
    }

    let input;
    try {
      input = momentSchema.parse({
        caption,
        takenAt,
        mood,
        visibility: isPublic ? "public" : "private",
        placeName: place?.name ?? null,
        city: place?.city ?? null,
        country: place?.country ?? null,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        tags,
      });
    } catch (error) {
      toast.error(describeZodError(error));
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const { data: post, error } = await supabase
        .from("posts")
        .insert({
          space_id: data.space.id,
          author_id: me.id,
          caption: input.caption,
          taken_at: input.takenAt,
          mood: input.mood ?? null,
          visibility: input.visibility,
          place_name: input.placeName ?? null,
          city: input.city ?? null,
          country: input.country ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index]!;
        const path = `spaces/${data.space.id}/${post.id}-${index}-${crypto.randomUUID()}.${draft.prepared.extension}`;
        const { error: uploadError } = await supabase.storage
          .from("moments")
          .upload(path, draft.prepared.blob, {
            contentType: draft.prepared.mimeType,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        // The feed, the grid and the map all render the preview; only opening
        // a photo fetches the full one. Deliberately not fatal — a moment
        // without a derivative still works, just costs more bandwidth.
        await supabase.storage
          .from("moments")
          .upload(previewPath(path), draft.prepared.previewBlob, {
            contentType: draft.prepared.mimeType,
          });

        const { error: mediaError } = await supabase.from("post_media").insert({
          post_id: post.id,
          storage_path: path,
          position: index,
          width: draft.prepared.width,
          height: draft.prepared.height,
          blur_data_url: draft.prepared.blurDataUrl || null,
          mime_type: draft.prepared.mimeType,
          byte_size: draft.prepared.blob.size,
        });
        if (mediaError) throw mediaError;
        setProgress(Math.round(((index + 1) / drafts.length) * 100));
      }

      if (input.tags.length > 0) {
        await supabase
          .from("post_tags")
          .insert(input.tags.map((tag) => ({ post_id: post.id, tag })));
      }

      // The partner is notified by a trigger on posts — see
      // supabase/migrations/20261009090000_notifications_achievements_invites.sql.
      // Notifying from here as well would deliver it twice.

      await queryClient.invalidateQueries();
      toast.success(isPublic ? "Shared with the world" : "Saved to your space");
      navigate({ to: "/feed", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that moment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur-xl">
        <button
          onClick={() => navigate({ to: "/feed" })}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <h1 className="font-display text-xl">New moment</h1>
        <Button
          onClick={publish}
          disabled={busy || processing}
          size="sm"
          className="rounded-full bg-ember px-4 text-ember-foreground hover:bg-ember/90"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Share"}
        </Button>
      </header>

      {busy && drafts.length > 0 ? (
        <div className="h-0.5 w-full bg-secondary">
          <div
            className="h-full bg-ember transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      <div className="mx-auto max-w-2xl space-y-6 px-5 py-6">
        <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
          <label className="flex aspect-[4/5] w-32 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-ember/50 hover:text-foreground">
            {processing ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <ImagePlus className="size-6" />
            )}
            <span className="text-xs">{processing ? "Preparing…" : "Add photos"}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="relative aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-2xl"
            >
              <img src={draft.previewUrl} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => removeDraft(draft.id)}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <p className="-mt-4 text-xs text-muted-foreground">
          Photos are resized and stripped of hidden location data before they leave your device.
        </p>

        <Textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={2000}
          placeholder="What happened?"
          className="min-h-28 rounded-2xl border-border bg-secondary/40 text-[15px]"
        />

        <PlacePicker value={place} onChange={setPlace} />

        <div className="space-y-2">
          <Label>How did it feel?</Label>
          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
            {MOODS.map((option) => (
              <button
                key={option}
                onClick={() => setMood(mood === option ? null : option)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                  mood === option
                    ? "border-ember/60 bg-ember/15 text-ember"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commitTag();
              }
            }}
            onBlur={commitTag}
            placeholder="roadtrip, birthday…"
            className="h-12 rounded-2xl bg-secondary/40"
          />
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs"
                >
                  #{tag}
                  <X className="size-3" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="taken">When</Label>
          <Input
            id="taken"
            type="date"
            value={takenAt}
            onChange={(event) => setTakenAt(event.target.value)}
            className="h-12 rounded-2xl bg-secondary/40"
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setIsPublic(false)}
              aria-pressed={!isPublic}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm transition-colors ${
                !isPublic ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              <Lock className="size-4" /> Just us
            </button>
            <button
              onClick={() => setIsPublic(true)}
              aria-pressed={isPublic}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm transition-colors ${
                isPublic ? "bg-ember/15 text-ember" : "text-muted-foreground"
              }`}
            >
              <Globe2 className="size-4" /> Public
            </button>
          </div>
          <p className="flex items-start gap-2 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {isPublic ? <MapPin className="mt-0.5 size-3.5 shrink-0" /> : null}
            {isPublic
              ? "Public moments show on Explore and your public page. The exact coordinates are blurred to roughly a kilometre, and comments stay private."
              : "Private moments never leave your space."}
          </p>
        </div>
      </div>
    </div>
  );
}
