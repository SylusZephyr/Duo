export type Mood = { key: string; emoji: string; label: string };

export const MOODS: Mood[] = [
  { key: "warm", emoji: "🫶", label: "Warm" },
  { key: "joy", emoji: "😄", label: "Joyful" },
  { key: "calm", emoji: "🌙", label: "Calm" },
  { key: "missing", emoji: "🥹", label: "Missing you" },
  { key: "silly", emoji: "😂", label: "Silly" },
  { key: "tender", emoji: "🕯️", label: "Tender" },
];

export function moodOf(key: string | null | undefined) {
  if (!key) return null;
  return MOODS.find((mood) => mood.key === key) ?? null;
}
