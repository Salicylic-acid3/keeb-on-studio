/**
 * The keymap drawn behind the guide and the practice: the same drawing as
 * the key test, with marks instead of press counts. A mark tints a key and
 * may replace its legend, which is how a guide step shows "this key would
 * become a hyphen" before anything is applied.
 */
import { memo, useMemo } from "react";
import { rotatePoint } from "../../layoutEditor/lib/model";
import type { TestBoard, TestKey } from "../../keyTest/lib/boards";
import type { KeyLabel, LabelLayout } from "../../layoutEditor/lib/keyLabels";
import { labelOnLayer } from "../lib/keyLookup";

const U = 54;

export type MarkTone =
  /** A key the guide proposes to change. */
  | "set"
  /** The key to press now. */
  | "hint"
  /** A layer or Shift key to hold with it. */
  | "hold"
  /** The key just pressed by mistake. */
  | "wrong"
  /** Misses on this key, tinted by `level` (0-1) in the result's heatmap. */
  | "heat";

export interface Mark {
  tone: MarkTone;
  /** A legend to show instead of the key's own. */
  label?: string;
  /** For "heat": how strong the tint is, 0-1, and the count shown. */
  level?: number;
  count?: number;
}

const TONE_COLOR: Record<MarkTone, string> = {
  set: "var(--color-neon)",
  hint: "var(--color-electric)",
  hold: "var(--color-cyber)",
  wrong: "var(--color-warning)",
  heat: "var(--color-electric)",
};

function rectsOf(k: TestKey) {
  const rects = [{ x: -k.w / 2, y: -k.h / 2, w: k.w, h: k.h }];
  if (k.second)
    rects.push({
      x: -k.w / 2 + k.second.x,
      y: -k.h / 2 + k.second.y,
      w: k.second.w,
      h: k.second.h,
    });
  return rects;
}

function boundsOf(keys: TestKey[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const k of keys) {
    for (const r of rectsOf(k)) {
      for (const [px, py] of [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x, r.y + r.h],
        [r.x + r.w, r.y + r.h],
      ]) {
        const p = rotatePoint(
          { x: k.cx + px, y: k.cy + py },
          { x: k.cx, y: k.cy },
          k.angle,
        );
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

const Key = memo(function Key({
  k,
  label,
  mark,
  dim,
  onClick,
}: {
  k: TestKey;
  /** What the key shows on the layer drawn; null when the layer leaves it as is. */
  label: KeyLabel | null;
  mark?: Mark;
  /** Fade the keys that are not marked, so the marked ones stand out. */
  dim: boolean;
  onClick?: () => void;
}) {
  const gap = 0.05 * U;
  const radius = 0.1 * U;
  const rects = rectsOf(k).map((r) => ({
    x: r.x * U,
    y: r.y * U,
    w: r.w * U,
    h: r.h * U,
  }));
  const W = k.w * U;
  const H = k.h * U;
  const sends =
    (k.trigger.kind === "key" || k.trigger.kind === "mouse") && label !== null;
  const tone = mark ? TONE_COLOR[mark.tone] : null;
  const heat =
    mark?.tone === "heat" ? Math.round(18 + 62 * (mark.level ?? 0)) : null;
  const strong = mark?.tone === "hint" || (heat !== null && heat > 55);
  const fill = strong
    ? `color-mix(in srgb, ${tone} ${heat ?? 55}%, var(--color-surface-elevated))`
    : tone
      ? `color-mix(in srgb, ${tone} ${heat ?? 22}%, var(--color-surface-elevated))`
      : sends
        ? "var(--color-surface-elevated)"
        : "transparent";
  const stroke =
    tone ?? (sends ? "var(--color-border-hover)" : "var(--color-border)");
  const text = strong
    ? "#ffffff"
    : sends
      ? "var(--color-text)"
      : "var(--color-text-muted)";

  // On a layer that leaves a key as it is, the base legend shows faintly,
  // so the drawing still reads as the keyboard.
  const own = label ?? k.label;
  const main = mark?.label ?? own.main;
  const sub = mark?.label ? undefined : own.sub;
  const old = mark?.label && mark.label !== own.main ? own.main : null;
  const longest = Math.max(main.length, 1);
  const fontSize = Math.min(
    U * 0.26,
    (Math.min(W, H * 1.6) - U * 0.2) / Math.max(1, longest * 0.62),
  );

  return (
    <g
      transform={`translate(${k.cx * U} ${k.cy * U}) rotate(${k.angle})`}
      data-practice-key={k.id}
      data-mark={mark?.tone}
      opacity={dim && !mark ? 0.45 : 1}
      style={{
        transition: "opacity 160ms ease-out",
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
    >
      {rects.map((r, i) => (
        <rect
          key={`o${i}`}
          x={r.x + gap}
          y={r.y + gap}
          width={Math.max(0, r.w - gap * 2)}
          height={Math.max(0, r.h - gap * 2)}
          rx={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={tone ? 2 : 1}
          strokeDasharray={sends ? undefined : "4 3"}
          style={{ transition: "fill 120ms ease-out, stroke 120ms ease-out" }}
        />
      ))}
      {rects.length > 1 &&
        rects.map((r, i) => (
          <rect
            key={`i${i}`}
            x={r.x + gap + 1}
            y={r.y + gap + 1}
            width={Math.max(0, r.w - gap * 2 - 2)}
            height={Math.max(0, r.h - gap * 2 - 2)}
            rx={Math.max(0, radius - 1)}
            fill={fill}
          />
        ))}
      {strong && (
        <rect
          x={-W / 2 + gap}
          y={-H / 2 + gap}
          width={Math.max(0, W - gap * 2)}
          height={Math.max(0, H - gap * 2)}
          rx={radius}
          fill="none"
          stroke={tone ?? undefined}
          strokeWidth={6}
          opacity={0.35}
          style={{ filter: "blur(3px)" }}
        />
      )}
      {sub && (
        <text
          x={0}
          y={-H / 2 + U * 0.34}
          textAnchor="middle"
          fontSize={fontSize * 0.75}
          fill={text}
          opacity={0.7}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {sub}
        </text>
      )}
      {old && (
        // The legend being replaced, small and struck through.
        <text
          x={0}
          y={-H / 2 + U * 0.3}
          textAnchor="middle"
          fontSize={U * 0.16}
          fill={text}
          opacity={0.55}
          textDecoration="line-through"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {old}
        </text>
      )}
      <text
        x={0}
        y={sub || old ? H / 2 - U * 0.2 : fontSize * 0.36}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={mark?.label ? 700 : 500}
        fill={text}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {main}
      </text>
      {mark?.tone === "heat" && mark.count !== undefined && (
        <text
          x={W / 2 - U * 0.12}
          y={H / 2 - U * 0.1}
          textAnchor="end"
          fontSize={U * 0.15}
          fontWeight={600}
          fill={text}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {mark.count}
        </text>
      )}
    </g>
  );
});

export function PracticeBoard({
  board,
  marks,
  dimOthers = false,
  layer = 0,
  layout = "us",
  onKeyClick,
  scroll = false,
}: {
  board: TestBoard;
  marks: Map<string, Mark>;
  dimOthers?: boolean;
  /** The layer drawn: 0 for the base, else what the keys send on it. */
  layer?: number;
  layout?: LabelLayout;
  /** Makes the keys clickable, by their index in the keyboard's key list. */
  onKeyClick?: (pos: number) => void;
  /**
   * Draw at full size (1u = 54px) and scroll sideways when the keyboard
   * is wider than the space, instead of shrinking the legends.
   */
  scroll?: boolean;
}) {
  const box = useMemo(() => boundsOf(board.keys), [board]);
  const pad = 0.1;
  const vb = [
    (box.minX - pad) * U,
    (box.minY - pad) * U,
    (box.maxX - box.minX + pad * 2) * U,
    (box.maxY - box.minY + pad * 2) * U,
  ];
  const svg = (
    <svg
      viewBox={vb.join(" ")}
      className={scroll ? "block h-auto" : "block w-full h-auto mx-auto"}
      role="img"
      aria-label={board.name}
      style={
        scroll
          ? {
              fontFamily: "inherit",
              width: `${vb[2]}px`,
              minWidth: `${vb[2]}px`,
            }
          : { fontFamily: "inherit", maxWidth: `${vb[2]}px` }
      }
    >
      {board.keys.map((k, i) => (
        <Key
          key={k.id}
          k={k}
          label={labelOnLayer(k, layer, layout)}
          mark={marks.get(k.id)}
          dim={dimOthers}
          onClick={onKeyClick ? () => onKeyClick(i) : undefined}
        />
      ))}
    </svg>
  );
  return scroll ? <div className="overflow-x-auto pb-2">{svg}</div> : svg;
}
