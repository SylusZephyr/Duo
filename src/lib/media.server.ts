export async function signPaths(paths: string[], expiresIn = 3600) {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {} as Record<string, string>;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("moments")
    .createSignedUrls(unique, expiresIn);
  if (error || !data) return {} as Record<string, string>;
  const map: Record<string, string> = {};
  for (const entry of data) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}
