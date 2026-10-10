import { describe, expect, it } from "vitest";

import { MIN_PASSWORD_LENGTH, describePassword } from "@/lib/password";

describe("describePassword", () => {
  it("asks for a password when there is none", () => {
    expect(describePassword("")).toBe("Choose a password");
  });

  it("rejects one character short of the minimum", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(describePassword(short)).toMatch(/at least/);
  });

  it("accepts exactly the minimum", () => {
    expect(describePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("accepts a long passphrase", () => {
    expect(describePassword("correct horse battery staple")).toBeNull();
  });

  it("rejects beyond 72 characters, where bcrypt would silently truncate", () => {
    expect(describePassword("a".repeat(73))).toMatch(/at most/);
  });

  it("accepts exactly 72 characters", () => {
    expect(describePassword("a".repeat(72))).toBeNull();
  });

  it("rejects a password made only of spaces", () => {
    expect(describePassword(" ".repeat(MIN_PASSWORD_LENGTH + 2))).toMatch(/spaces/);
  });

  it("allows spaces inside a real passphrase", () => {
    expect(describePassword("two words")).toBeNull();
  });

  it("imposes no composition rules, so a lowercase passphrase is fine", () => {
    expect(describePassword("alltheletters")).toBeNull();
  });
});
