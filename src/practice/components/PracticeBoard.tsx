/**
 * The keymap drawn behind the guide and the practice: the same drawing as
 * the key test, with marks instead of press counts. A mark tints a key and
 * may replace its legend, which is how a guide step shows "this key would
 * become a hyphen" before anything is applied.
 */
import { memo, useMemo } from "react";
import { rotatePoint } from "../../layoutEditor/lib/model";
import type { TestBoard, TestKey } from "../../keyTest/lib/boards";

const U = 54;

export type MarkTone =
  /** A key the guide proposes to change. */
  | "set"
  /** The key to press now. */
  | "hint"
  /** A layer or Shift key to hold with it. */
  | "hold"
  /** The key just pressed by mistake. */
  | "wrong";

export interface Mark {
  tone: MarkTone;
  /** A legend to show instead of the key's own. */
  label?: string;
}

const TONE_COLOR: Record<MarkTone, string> = {
  set: "var(--color-neon)",
  hint: "var(--color-electric)",
  hold: "var(--color-cyber)",
  wrong: "var(--color-warning)",
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
  mark,
  dim,
}: {
  k: TestKey;
  mark?: Mark;
  /** Fade the keys that are not marked, so the marked ones stand out. */
  dim: boolean;
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
  const sends = k.trigger.kind === "key" || k.trigger.kind === "mouse";
  const tone = mark ? TONE_COLOR[mark.tone] : null;
  const strong = mark?.tone === "hint";
  const fill = strong
    ? `color-mix(in srgb, ${tone} 55%, var(--color-surface-elevated))`
    : tone
      ? `color-mix(in srgb, ${tone} 22%, var(--color-surface-elevated))`
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

  const main = mark?.label ?? k.label.main;
  const sub = mark?.label ? undefined : k.label.sub;
  const old = mark?.label && mark.label !== k.label.main ? k.label.main : null;
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
      style={{ transition: "opacity 160ms ease-out" }}
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
    </g>
  );
});

export function PracticeBoard({
  board,
  marks,
  dimOthers = false,
}: {
  board: TestBoard;
  marks: Map<string, Mark>;
  dimOthers?: boolean;
}) {
  const box = useMemo(() => boundsOf(board.keys), [board]);
  const pad = 0.1;
  const vb = [
    (box.minX - pad) * U,
    (box.minY - pad) * U,
    (box.maxX - box.minX + pad * 2) * U,
    (box.maxY - box.minY + pad * 2) * U,
  ];
  return (
    <svg
      viewBox={vb.join(" ")}
      className="block w-full h-auto mx-auto"
      role="img"
      aria-label={board.name}
      style={{ fontFamily: "inherit", maxWidth: `${vb[2]}px` }}
    >
      {board.keys.map((k) => (
        <Key key={k.id} k={k} mark={marks.get(k.id)} dim={dimOthers} />
      ))}
    </svg>
  );
}
