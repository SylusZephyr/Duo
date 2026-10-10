import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SignedImage } from "@/components/signed-image";
import type { Member } from "@/lib/queries";
import { relativeTime } from "@/lib/format";
import { deleteStory, markStorySeen, useAddStory, useStories, type Story } from "@/lib/social";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const STORY_MS = 5000;

export function StoriesRow({
  spaceId,
  userId,
  members,
}: {
  spaceId: string | undefined;
  userId: string | undefined;
  members: Member[];
}) {
  const { data: stories } = useStories(spaceId);
  const addStory = useAddStory(spaceId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [openAuthor, setOpenAuthor] = useState<string | null>(null);

  const byAuthor = useMemo(() => {
    const map = new Map<string, Story[]>();
    for (const s of stories ?? []) {
      const list = map.get(s.author_id) ?? [];
      list.push(s);
      map.set(s.author_id, list);
    }
    return map;
  }, [stories]);

  const ordered = [...members].sort((a) => (a.user_id === userId ? -1 : 1));

  async function onPick(file: File | undefined) {
    if (!file || !userId) return;
    const caption = window.prompt("Add a caption (optional)") ?? "";
    toast.promise(addStory.mutateAsync({ file, caption, userId }), {
      loading: "Posting your story…",
      success: "Story shared for 24 hours",
      error: "Couldn't post that story",
    });
  }

  return (
    <>
      <div className="hide-scrollbar -mx-5 mb-5 flex gap-4 overflow-x-auto px-5 pb-1">
        {ordered.map((m) => {
          const list = byAuthor.get(m.user_id) ?? [];
          const mine = m.user_id === userId;
          const unseen = list.some((s) => !s.viewed_by.includes(userId ?? ""));
          return (
            <div key={m.user_id} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
              <button
                onClick={() =>
                  list.length ? setOpenAuthor(m.user_id) : mine && fileRef.current?.click()
                }
                className={cn(
                  "press relative grid size-[68px] place-items-center rounded-full p-[3px]",
                  list.length && (unseen || mine) ? "story-ring" : "bg-border",
                )}
                aria-label={list.length ? `Watch ${m.display_name}'s story` : "Add a story"}
              >
                <span className="grid size-full place-items-center overflow-hidden rounded-full border-[3px] border-background bg-candy-soft font-display text-xl font-bold text-candy">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    m.display_name.slice(0, 1).toUpperCase()
                  )}
                </span>
                {mine ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      fileRef.current?.click();
                    }}
                    className="bg-gradient-candy absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-background text-white"
                  >
                    <Plus className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
              <span className="w-full truncate text-center text-[11px] font-semibold">
                {mine ? "Your story" : m.display_name}
              </span>
            </div>
          );
        })}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {openAuthor ? (
        <StoryViewer
          stories={byAuthor.get(openAuthor) ?? []}
          member={members.find((m) => m.user_id === openAuthor)}
          userId={userId}
          spaceId={spaceId}
          onClose={() => setOpenAuthor(null)}
        />
      ) : null}
    </>
  );
}

function StoryViewer({
  stories,
  member,
  userId,
  spaceId,
  onClose,
}: {
  stories: Story[];
  member: Member | undefined;
  userId: string | undefined;
  spaceId: string | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const story = stories[index];

  useEffect(() => {
    if (story && userId && story.author_id !== userId) void markStorySeen(story.id, userId);
    setProgress(0);
  }, [story, userId]);

  useEffect(() => {
    if (paused || !story) return;
    const started = Date.now() - progress * STORY_MS;
    const t = setInterval(() => {
      const p = (Date.now() - started) / STORY_MS;
      if (p >= 1) {
        clearInterval(t);
        if (index < stories.length - 1) setIndex((i) => i + 1);
        else onClose();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, index, story]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-foreground">
      <div className="relative mx-auto h-full max-w-md">
        <SignedImage
          path={story.storage_path}
          blurDataUrl={story.blur_data_url}
          alt={story.caption || "Story"}
          className="absolute inset-0 h-full w-full"
          priority
        />
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-foreground/70 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex gap-1">
            {stories.map((s, i) => (
              <div
                key={s.id}
                className="h-[3px] flex-1 overflow-hidden rounded-full bg-background/30"
              >
                <div
                  className="h-full bg-background"
                  style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-background">
            <p className="text-sm font-bold">
              {member?.display_name}{" "}
              <span className="font-normal opacity-70">{relativeTime(story.created_at)}</span>
            </p>
            <div className="flex items-center gap-2">
              {story.author_id === userId ? (
                <button
                  aria-label="Delete story"
                  onClick={async () => {
                    await deleteStory(story.id);
                    await qc.invalidateQueries({ queryKey: ["stories", spaceId] });
                    toast.success("Story deleted");
                    onClose();
                  }}
                  className="grid size-9 place-items-center rounded-full bg-background/15"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
              <button
                aria-label="Close"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full bg-background/15"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        </div>
        <div
          className="absolute inset-0 top-24 flex"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        >
          <button
            aria-label="Previous"
            className="h-full w-1/3"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          />
          <button
            aria-label="Next"
            className="h-full flex-1"
            onClick={() => (index < stories.length - 1 ? setIndex(index + 1) : onClose())}
          />
        </div>
        {story.caption ? (
          <p className="absolute inset-x-6 bottom-[max(2rem,env(safe-area-inset-bottom))] rounded-2xl bg-foreground/50 px-4 py-3 text-center text-[15px] font-semibold text-background backdrop-blur">
            {story.caption}
          </p>
        ) : null}
        {story.author_id === userId ? (
          <p className="absolute right-4 top-24 rounded-full bg-foreground/50 px-3 py-1 text-xs text-background">
            {story.viewed_by.length ? "Seen" : "Not seen yet"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
