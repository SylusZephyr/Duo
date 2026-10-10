import { useState } from "react";

import { useSignedUrls } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Private storage images are served through short-lived signed URLs.
 * A tiny blurred placeholder (stored with the photo) renders immediately,
 * then the full image cross-fades in once decoded.
 */
export function SignedImage({
  path,
  alt,
  className,
  blurDataUrl,
  sizes,
  priority = false,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  blurDataUrl?: string | null;
  sizes?: string;
  priority?: boolean;
}) {
  const { data } = useSignedUrls(path ? [path] : []);
  const [loaded, setLoaded] = useState(false);
  const url = path ? data?.[path] : undefined;

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
          className={cn(
            "relative h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
