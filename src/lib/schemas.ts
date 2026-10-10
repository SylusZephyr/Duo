import { z } from "zod";

export const captionSchema = z
  .string()
  .trim()
  .max(2000, { message: "Keep captions under 2000 characters" });

export const momentSchema = z.object({
  caption: captionSchema,
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Pick a valid date" }),
  mood: z.string().trim().max(24).nullable().optional(),
  visibility: z.enum(["private", "public"]),
  placeName: z.string().trim().max(180).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
});

export const journalSchema = z.object({
  title: z.string().trim().max(160),
  body: z.string().trim().min(1, { message: "Write something first" }).max(20000),
  mood: z.string().trim().max(24).nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isSealed: z.boolean(),
  unlockAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, { message: "Give it a name" }).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  happenedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const bucketItemSchema = z.object({
  title: z.string().trim().min(1, { message: "Add something to do" }).max(160),
  note: z.string().trim().max(500).nullable().optional(),
});

export const wishlistSchema = z.object({
  name: z.string().trim().min(1).max(180),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const promptAnswerSchema = z.object({
  body: z.string().trim().min(1, { message: "Write your answer" }).max(2000),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, { message: "Add a name" }).max(60),
  bio: z.string().trim().max(280).nullable().optional(),
});

export const spaceSettingsSchema = z.object({
  name: z.string().trim().min(1, { message: "Name your space" }).max(60),
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{3,30}$/, { message: "3–30 characters: lowercase letters, numbers, hyphens" })
    .nullable()
    .optional(),
  anniversaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isPublic: z.boolean(),
});

export const reportSchema = z.object({
  reason: z.enum(["nudity", "harassment", "spam", "violence", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_PHOTOS_PER_MOMENT = 8;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function describeZodError(error: unknown, fallback = "Please check the form") {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}
