import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/legal";

/**
 * The legal pages are plain prose, so there is little logic to test. What can
 * break silently is the link: three footers point at /privacy and /terms, and
 * a missing route file turns those into 404s for a user mid-signup. Typecheck
 * catches it for <Link>, but not for the policy's own claims about the app.
 */

const privacy = readFileSync("src/routes/privacy.tsx", "utf8");
const terms = readFileSync("src/routes/terms.tsx", "utf8");

describe("legal pages", () => {
  it("are registered at the paths the footers link to", () => {
    expect(privacy).toContain('createFileRoute("/privacy")');
    expect(terms).toContain('createFileRoute("/terms")');
  });

  it("state the shared-history deletion rule, which is the surprising part", () => {
    // If deletion behaviour changes in delete_my_account(), this paragraph has
    // to change with it — a policy describing the old rule is worse than none.
    expect(privacy).toMatch(/stay in the space for your partner/);
    expect(privacy).toMatch(/last member/);
  });

  it("tell people how to export and delete without asking us", () => {
    expect(privacy).toMatch(/Export/);
    expect(privacy).toMatch(/Delete account/);
  });

  it("carry a revision date rather than a build date", () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/^\d{1,2} \w+ \d{4}$/);
  });

  it("fall back to an unmistakable placeholder address", () => {
    // A deployment that forgets VITE_SUPPORT_EMAIL should look wrong, not
    // quietly send data requests somewhere real.
    expect(SUPPORT_EMAIL).toMatch(/@/);
    if (!process.env["VITE_SUPPORT_EMAIL"]) {
      expect(SUPPORT_EMAIL).toBe("support@example.com");
    }
  });
});
