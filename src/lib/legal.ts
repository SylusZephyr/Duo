/**
 * Facts the privacy policy and terms both need, in one place so the two
 * documents can never disagree with each other.
 *
 * The contact address is an env var because it differs per deployment — a fork
 * must not route its users' data requests to someone else's inbox. The
 * fallback is deliberately obviously-a-placeholder rather than a real address.
 */
export const SUPPORT_EMAIL = import.meta.env["VITE_SUPPORT_EMAIL"] ?? "support@example.com";

/**
 * Bumped by hand when either document changes in substance. Not derived from
 * the build date: a redeploy that touches nothing legal must not claim the
 * policy was revised.
 */
export const LEGAL_LAST_UPDATED = "10 October 2026";

/** How long a soft-deleted-by-nobody space lingers. Referenced by both docs. */
export const STORY_RETENTION_HOURS = 24;
