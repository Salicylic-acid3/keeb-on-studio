/**
 * 亀甲 (kikko): a tiled hexagon lattice used as the app's background field.
 *
 * The hexagon is the product's shape. It comes from the benzene ring the
 * author signs his work with (サリチル酸 / salicylic acid), and tiled it is
 * also a traditional Japanese pattern, which is why it sits with the rest of
 * the onsen-town palette instead of reading as a tech motif. It replaced the
 * concentric circles this app inherited from upstream: circles were the one
 * thing that still made the two products look alike at a glance.
 */
import { useId } from "react";

/** Hexagon side length, in the SVG's user units. */
const SIDE = 40;
/** Flat-to-flat height of a flat-top hexagon with that side. */
const HEIGHT = SIDE * Math.sqrt(3);
const TILE_W = SIDE * 3;
const TILE_H = HEIGHT;

function hexPoints(cx: number, cy: number): string {
  return (
    [
      [cx + SIDE, cy],
      [cx + SIDE / 2, cy + HEIGHT / 2],
      [cx - SIDE / 2, cy + HEIGHT / 2],
      [cx - SIDE, cy],
      [cx - SIDE / 2, cy - HEIGHT / 2],
      [cx + SIDE / 2, cy - HEIGHT / 2],
    ] as const
  )
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

/**
 * Hexagon centres for one tile.
 *
 * Columns sit 1.5 sides apart and every other column drops by half a hexagon
 * -- get that offset wrong and the lattice reads as diamonds rather than a
 * honeycomb. The centres outside the tile are the wrap: without them the
 * shapes are cut at the tile edge instead of joining up with the next tile.
 */
const CENTERS: readonly (readonly [number, number])[] = [
  [TILE_W * 0.75, 0],
  [TILE_W * 0.75, TILE_H],
  [TILE_W * 0.25, TILE_H / 2],
  [TILE_W * 0.25, -TILE_H / 2],
  [TILE_W * 0.25, TILE_H * 1.5],
  [-TILE_W * 0.25, 0],
  [-TILE_W * 0.25, TILE_H],
];

interface KikkoFieldProps {
  /**
   * Fade the lattice out towards the middle, so content sitting there is not
   * competing with it. Off for narrow strips (a header band), where there is
   * no middle to clear.
   */
  fadeCenter?: boolean;
  className?: string;
}

export function KikkoField({
  fadeCenter = true,
  className = "",
}: KikkoFieldProps) {
  // Two of these can be on screen at once (a page behind a header band), and
  // duplicate pattern ids would make one of them reference the other's fill.
  const patternId = `kikko-${useId()}`;

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      <svg className="h-full w-full" aria-hidden="true">
        <defs>
          <pattern
            id={patternId}
            width={TILE_W}
            height={TILE_H}
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="none"
              stroke="var(--color-kikko)"
              strokeWidth="1.2"
              opacity="var(--color-kikko-opacity)"
            >
              {CENTERS.map(([cx, cy]) => (
                <polygon key={`${cx},${cy}`} points={hexPoints(cx, cy)} />
              ))}
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      {fadeCenter && (
        <div
          className="absolute inset-0"
          style={{
            // Clear the middle for the content that sits there, and the very
            // bottom for the credit line, which otherwise reads through the
            // lattice.
            background: [
              "radial-gradient(ellipse 46% 52% at 50% 50%, var(--color-bg) 30%, transparent 78%)",
              "linear-gradient(to top, var(--color-bg) 4%, transparent 22%)",
            ].join(", "),
          }}
        />
      )}
    </div>
  );
}
