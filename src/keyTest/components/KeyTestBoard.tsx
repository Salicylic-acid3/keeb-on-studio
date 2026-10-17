/**
 * The keyboard drawn for the key test: every key in its place, lit while
 * held, tinted once it has been pressed, and marked when it bounced.
 *
 * Drawn the way the layout editor draws a key (an outline with an inner
 * fill, so a stepped Enter reads as one shape) and scaled to the width it
 * is given.
 */
import { memo, useMemo } from "react";
import { rotatePoint } from "../../layoutEditor/lib/model";
import { isTestable, type TestBoard, type TestKey } from "../lib/boards";

const U = 54;

interface KeyTestBoardProps {
  board: TestBoard;
  /** Layers some key sends something on, so their layer keys are testable. */
  layers: Set<number>;
  held: Set<string>;
  counts: Record<string, number>;
  chatter: Record<string, number>;
  /** Label of a key that sends nothing a page can see, for its tooltip. */
  untestableTitle: string;
}

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
  testable,
  held,
  count,
  bounced,
  untestableTitle,
}: {
  k: TestKey;
  testable: boolean;
  held: boolean;
  count: number;
  bounced: number;
  untestableTitle: string;
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

  const tone = held
    ? "var(--color-electric)"
    : bounced
      ? "var(--color-warning)"
      : count > 0
        ? "var(--color-neon)"
        : null;
  const fill = held
    ? "color-mix(in srgb, var(--color-electric) 55%, var(--color-surface-elevated))"
    : tone
      ? `color-mix(in srgb, ${tone} 20%, var(--color-surface-elevated))`
      : testable
        ? "var(--color-surface-elevated)"
        : "transparent";
  const stroke =
    tone ?? (testable ? "var(--color-border-hover)" : "var(--color-border)");
  const text = held
    ? "#ffffff"
    : testable
      ? "var(--color-text)"
      : "var(--color-text-muted)";

  const { main, sub } = k.label;
  const longest = Math.max(main.length, 1);
  // Narrow keys with long names ("PgUp", "L Click") get smaller text.
  const fontSize = Math.min(
    U * 0.26,
    (Math.min(W, H * 1.6) - U * 0.2) / Math.max(1, longest * 0.62),
  );

  return (
    <g
      transform={`translate(${k.cx * U} ${k.cy * U}) rotate(${k.angle})`}
      data-key-test-id={k.id}
      data-held={held || undefined}
      data-tested={count > 0 || undefined}
    >
      <title>
        {testable ? `${main}${count ? ` × ${count}` : ""}` : untestableTitle}
      </title>
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
          strokeDasharray={testable ? undefined : "4 3"}
          style={{ transition: "fill 90ms ease-out, stroke 90ms ease-out" }}
        />
      ))}
      {rects.length > 1 &&
        rects.map((r, i) => (
          // Painted after both outlines so a stepped key reads as one shape.
          <rect
            key={`i${i}`}
            x={r.x + gap + 1}
            y={r.y + gap + 1}
            width={Math.max(0, r.w - gap * 2 - 2)}
            height={Math.max(0, r.h - gap * 2 - 2)}
            rx={Math.max(0, radius - 1)}
            fill={fill}
            style={{ transition: "fill 90ms ease-out" }}
          />
        ))}
      {held && (
        <rect
          x={-W / 2 + gap}
          y={-H / 2 + gap}
          width={Math.max(0, W - gap * 2)}
          height={Math.max(0, H - gap * 2)}
          rx={radius}
          fill="none"
          stroke="var(--color-electric)"
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
      <text
        x={0}
        y={sub ? H / 2 - U * 0.2 : fontSize * 0.36}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={500}
        fill={text}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {main}
      </text>
      {count > 0 && testable && (
        <text
          x={W / 2 - U * 0.12}
          y={H / 2 - U * 0.1}
          textAnchor="end"
          fontSize={U * 0.15}
          fill={held ? "#ffffff" : (tone ?? "var(--color-text-muted)")}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {count}
        </text>
      )}
      {bounced > 0 && (
        <g transform={`translate(${-W / 2 + U * 0.2} ${-H / 2 + U * 0.2})`}>
          <circle r={U * 0.11} fill="var(--color-warning)" />
          <text
            y={U * 0.055}
            textAnchor="middle"
            fontSize={U * 0.16}
            fontWeight={700}
            fill="#1c2130"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            !
          </text>
        </g>
      )}
    </g>
  );
});

export function KeyTestBoard({
  board,
  layers,
  held,
  counts,
  chatter,
  untestableTitle,
}: KeyTestBoardProps) {
  const box = useMemo(() => boundsOf(board.keys), [board]);
  const pad = 0.1;
  const vb = [
    (box.minX - pad) * U,
    (box.minY - pad) * U,
    (box.maxX - box.minX + pad * 2) * U,
    (box.maxY - box.minY + pad * 2) * U,
  ];
  return (
    // Drawn at 1u = 54px and only ever shrunk to fit: a tenkey is not
    // blown up to the width of a full-size keyboard.
    <svg
      viewBox={vb.join(" ")}
      className="block w-full h-auto max-h-[62vh] mx-auto"
      role="img"
      aria-label={board.name}
      style={{ fontFamily: "inherit", maxWidth: `${vb[2]}px` }}
    >
      {board.keys.map((k) => (
        <Key
          key={k.id}
          k={k}
          testable={isTestable(k, layers)}
          held={held.has(k.id)}
          count={counts[k.id] ?? 0}
          bounced={chatter[k.id] ?? 0}
          untestableTitle={untestableTitle}
        />
      ))}
    </svg>
  );
}
