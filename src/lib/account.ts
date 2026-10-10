import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Account export and deletion — the two things a person is legally entitled
 * to do with their own data, and the two this app had no way to do.
 */

/** Fetch the export and hand the browser a file. */
export function useExportMyData() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("export_my_data");
      if (error) throw error;

      const payload = data as { media_paths?: string[] } | null;

      // Storage objects are referenced by path, not inlined — a space's
      // photos can be hundreds of megabytes and do not belong in a JSON
      // blob. Turn them into links that work for the next hour.
      const mediaUrls: Record<string, string> = {};
      const paths = payload?.media_paths ?? [];
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("moments")
          .createSignedUrls(paths, 3600);
        for (const entry of signed ?? []) {
          if (entry.path && entry.signedUrl) mediaUrls[entry.path] = entry.signedUrl;
        }
      }

      const blob = new Blob([JSON.stringify({ ...payload, media_urls: mediaUrls }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `duo-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      return paths.length;
    },
  });
}

/**
 * Erase the account. The shared space survives if the partner is still in it,
 * with this person's authorship removed; the last one out takes it with them.
 * Irreversible — the caller confirms first.
 */
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      // The row behind the session is gone; clear the local one too so the
      // app does not keep trying to use a token for a user that no longer
      // exists.
      await supabase.auth.signOut();
    },
  });
}
