"use client";
import { useEffect, useRef, useState } from "react";
import type { ProductPhotoResult } from "@/lib/preparation.mjs";

/** Render a single raster atlas cell without stretching or adjacent-cell bleed. */
export function ProductImage({
  photo,
  alt,
  onError,
  width = 400,
  height = 320,
}: {
  photo: ProductPhotoResult;
  alt: string;
  onError?: () => void;
  width?: number;
  height?: number;
}) {
  const viewport = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const isAtlas = Boolean(photo.tile);
  useEffect(() => {
    if (!isAtlas || !viewport.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [isAtlas]);
  if (!photo.src) return null;
  if (photo.tile) {
    const { column, row, columns, rows } = photo.tile;
    return (
      <svg
        ref={viewport}
        className="catalog-product-image"
        role="img"
        aria-label={alt}
        viewBox="0 0 1 1"
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "hidden" }}
      >
        <svg
          x="0"
          y="0"
          width="1"
          height="1"
          viewBox={`${column} ${row} 1 1`}
          style={{ overflow: "hidden" }}
        >
          {visible && (
            <image
              href={photo.src}
              x="0"
              y="0"
              width={columns}
              height={rows}
              preserveAspectRatio="none"
              onError={onError}
            />
          )}
        </svg>
      </svg>
    );
  }
  return (
    <img
      className="catalog-product-image"
      src={photo.src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      onError={onError}
    />
  );
}
