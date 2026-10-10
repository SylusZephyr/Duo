import { describe, expect, it } from "vitest";

import { previewPath } from "@/lib/image";
import { publicMediaUrl } from "@/lib/public-media.server";

/**
 * The proxy decides what a stranger may download, and it decides it from a
 * string. These are the string rules.
 */

describe("previewPath", () => {
  it("inserts the marker before the extension", () => {
    expect(previewPath("spaces/a/b.webp")).toBe("spaces/a/b.preview.webp");
  });

  it("appends it when there is no extension", () => {
    expect(previewPath("spaces/a/b")).toBe("spaces/a/b.preview");
  });

  it("only looks at the last dot, not one in a directory name", () => {
    expect(previewPath("spaces/v1.0/b.webp")).toBe("spaces/v1.0/b.preview.webp");
  });

  it("is stable, so a path is never derived twice by accident", () => {
    const once = previewPath("spaces/a/b.webp");
    expect(previewPath(once)).toBe("spaces/a/b.preview.preview.webp");
    // Round-tripping is how the proxy recovers the original; a double-derived
    // name must still resolve to exactly one step back.
    expect(previewPath(once.replace(".preview.webp", ".webp"))).toBe(once);
  });
});

describe("publicMediaUrl", () => {
  it("points at the proxy, not at storage", () => {
    expect(publicMediaUrl("spaces/abc/def.webp")).toBe("/i/spaces/abc/def.webp");
  });

  it("keeps the separators but escapes everything else", () => {
    // A space or a '#' in a filename would otherwise truncate the URL.
    expect(publicMediaUrl("spaces/a b/c#d.webp")).toBe("/i/spaces/a%20b/c%23d.webp");
  });

  it("does not sanitise traversal — the handler is what rejects it", () => {
    // encodeURIComponent leaves dots alone, so this writer cannot be the
    // defence. Recorded here so nobody mistakes it for one: handlePublicMedia
    // rejects any path containing ".." before it touches storage.
    expect(publicMediaUrl("spaces/../secret.webp")).toBe("/i/spaces/../secret.webp");
  });
});
