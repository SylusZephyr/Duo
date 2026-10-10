import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPORT_REASONS } from "@/lib/moderation";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/20261010070000_moderation.sql"),
  "utf8",
);

describe("report reasons", () => {
  it("has no duplicate values", () => {
    const values = REPORT_REASONS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every reason a human label", () => {
    for (const reason of REPORT_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.label).not.toBe(reason.value);
    }
  });

  /**
   * The database constrains `reason` to a fixed set. A value here that the
   * CHECK does not allow fails the insert at runtime, in front of someone
   * trying to report abuse — which is the worst possible time to find out.
   */
  it("matches the CHECK constraint in the migration exactly", () => {
    const match = /reports_reason_check[\s\S]*?CHECK \(reason IN \(([^)]+)\)\)/.exec(MIGRATION);
    expect(match, "the reason CHECK constraint should exist").toBeTruthy();

    const inDatabase = [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const inCode = REPORT_REASONS.map((r) => r.value).sort();
    expect(inCode).toEqual(inDatabase);
  });

  it("covers the categories a moderation queue has to distinguish", () => {
    const values = REPORT_REASONS.map((r) => r.value);
    // Minors and sexual content are the two that carry legal obligations;
    // losing either from the picker would be a silent compliance gap.
    expect(values).toContain("minor");
    expect(values).toContain("sexual");
    expect(values).toContain("other");
  });
});

describe("moderation actions", () => {
  it("only allows the three actions the function implements", () => {
    const match = /_action NOT IN \(([^)]+)\)/.exec(MIGRATION);
    expect(match).toBeTruthy();
    const allowed = [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(allowed).toEqual(["dismiss", "restore", "take_down"]);
  });

  it("keeps a takedown reversible rather than deleting the post", () => {
    // A moderator must never destroy a couple's own memory.
    expect(MIGRATION).not.toMatch(/DELETE\s+FROM\s+public\.posts/i);
    expect(MIGRATION).toMatch(/moderated_at = NULL/);
  });
});
