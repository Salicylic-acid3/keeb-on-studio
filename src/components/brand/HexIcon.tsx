/**
 * The hexagon an icon sits in at the head of a page or a section.
 *
 * Replaces the rounded square this app inherited from upstream, so the shape
 * that identifies a section is the same one the connect buttons and the
 * background lattice use (see KikkoField for where the hexagon comes from).
 *
 * Built from two clipped layers rather than an SVG stroke: an outline layer
 * and a slightly inset fill, which keeps the edge crisp at any size without
 * a path that has to be scaled with it.
 */
import type { ReactNode } from "react";

interface HexIconProps {
  children: ReactNode;
  /**
   * CSS variable holding the accent colour. Defaults to the primary accent,
   * which is what every page header used before this existed.
   */
  accent?: string;
  /** Width in pixels; height follows the hexagon's ratio. */
  size?: number;
  className?: string;
}

export function HexIcon({
  children,
  accent = "--color-electric",
  size = 44,
  className = "",
}: HexIconProps) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size * 1.115 }}
    >
      <span
        className="hex-clip absolute inset-0 opacity-30"
        style={{ background: `var(${accent})` }}
      />
      <span className="hex-clip absolute inset-[1.5px] bg-[var(--color-surface)]" />
      <span
        className="hex-clip absolute inset-[1.5px] opacity-10"
        style={{ background: `var(${accent})` }}
      />
      <span
        className="relative flex items-center justify-center"
        style={{ color: `var(${accent})` }}
      >
        {children}
      </span>
    </span>
  );
}
