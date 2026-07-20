"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** An image that opens full-scale in a lightbox modal when clicked. */
export function Zoomable({
  src,
  alt,
  caption,
  className,
  style,
}: {
  src: string;
  alt: string;
  /** Line shown under the enlarged image (defaults to alt). */
  caption?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ cursor: "zoom-in", ...style }}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div className="lightbox" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
          <div className="cap">{caption ?? alt} · esc or click to close</div>
        </div>
      )}
    </>
  );
}
