import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A manifest that names an icon which is not there installs an app with a
 * blank tile, and nothing in lint, typecheck or build would notice.
 */
const PUBLIC_DIR = join(process.cwd(), "public");
const manifest = JSON.parse(readFileSync(join(PUBLIC_DIR, "manifest.webmanifest"), "utf8")) as {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
  shortcuts?: { name: string; url: string }[];
};

describe("web app manifest", () => {
  it("names the app in both long and short form", () => {
    expect(manifest.name.length).toBeGreaterThan(0);
    // Home screens truncate past roughly twelve characters.
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it("opens standalone, into the app rather than the marketing page", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/feed");
  });

  it("ships every icon it claims to", () => {
    for (const icon of manifest.icons) {
      const path = join(PUBLIC_DIR, icon.src.replace(/^\//, ""));
      expect(existsSync(path), `${icon.src} is missing from public/`).toBe(true);
    }
  });

  it("has the 192 and 512 icons installability depends on", () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("has a maskable icon, so the corners are not cropped off the art", () => {
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("uses colours the app actually uses", () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("only links shortcuts to in-app paths", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.url.startsWith("/")).toBe(true);
    }
  });
});
