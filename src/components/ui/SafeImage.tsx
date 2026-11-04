"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

/** <img> con imagen de respaldo si la URL está vacía o falla. */
export default function SafeImage({ src, alt, className = "" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt ? `${alt} (imagen no disponible)` : undefined}
        aria-hidden={alt ? undefined : true}
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}
      >
        <ImageOff aria-hidden className="size-1/4 max-h-12 max-w-12" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={`object-cover ${className}`}
    />
  );
}
