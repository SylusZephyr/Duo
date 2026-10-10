import { useState } from "react";

import { previewPath } from "@/lib/image";
import { useSignedUrls } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Private storage images are served through short-lived signed URLs.
 * A tiny blurred placeholder (stored with the photo) renders immediately,
 * then the image cross-fades in once decoded.
 *
 * Which file it fetches matters more than it looks. Every upload writes an
 * ~800px derivative alongside the 2560px original, and this fetches the
 * derivative unless told otherwise — a feed of ten cards costs around a tenth
 * of the egress it used to, and egress is what exhausts the free tier first.
 *
 * Uploads from before the derivative existed have no preview, so the signed
 * URL 404s. That is handled rather than avoided: the error falls back to the
 * full image, which keeps old moments working without a backfill.
 */
export function SignedImage({
  path,
  alt,
  className,
  blurDataUrl,
  sizes,
  priority = false,
  variant = "preview",
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  blurDataUrl?: string | null;
  sizes?: string;
  priority?: boolean;
  /**
   * "preview" for anything card-sized or smaller — feed, grid, pins, avatars,
   * thumbnails. "full" only where someone is looking at the photo itself.
   */
  variant?: "preview" | "full";
}) {
  const [loaded, setLoaded] = useState(false);
  const [noPreview, setNoPreview] = useState(false);

  const wanted =
    path && variant === "preview" && !noPreview ? previewPath(path) : (path ?? undefined);
  const { data } = useSignedUrls(wanted ? [wanted] : []);
  const url = wanted ? data?.[wanted] : undefined;

  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      {blurDataUrl ? (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full scale-110 object-cover blur-xl transition-opacity duration-500",
            loaded ? "opacity-0" : "opacity-100",
          )}
        />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-secondary to-muted transition-opacity duration-500",
            loaded ? "opacity-0" : "animate-pulse opacity-100",
          )}
        />
      )}
      {url ? (
        <img
          src={url}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            // Only ever happens for a pre-derivative upload; retrying the
            // full path is the whole recovery.
            if (wanted !== path) setNoPreview(true);
          }}
          className={cn(
            "relative h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
