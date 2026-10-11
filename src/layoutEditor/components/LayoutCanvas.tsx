/**
 * The layout drawn on a canvas that pans and zooms.
 *
 * Mouse: drag to pan, wheel to zoom. Touch: one finger pans, two fingers pan
 * and pinch. A tap or click without moving selects the key under it.
 *
 * Everything is laid out in pixels (u x zoom) rather than under an SVG
 * scale(): browsers with a minimum font size (Chrome in Japanese has one by
 * default) clamp a sub-pixel font size before scaling it, which would blow
 * the legends up.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { IconFocusCentered, IconMinus, IconPlus } from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import {
  projectBounds,
  type LayoutKey,
  type LayoutLayer,
  type LayoutProject,
} from "../lib/model";

const MIN_ZOOM = 10;
const MAX_ZOOM = 220;
/** Largest zoom "fit" picks, so a few keys do not fill the whole screen. */
const FIT_MAX_ZOOM = 72;
const FIT_PADDING = 28;
/** Pointer travel, in px, below which a press is a tap rather than a drag. */
const TAP_SLOP = 6;

interface View {
  tx: number;
  ty: number;
  /** Pixels per u. */
  zoom: number;
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Zoom by `factor`, keeping the point at (px, py) of the canvas still. */
function zoomAt(view: View, factor: number, px: number, py: number): View {
  const zoom = clampZoom(view.zoom * factor);
  const k = zoom / view.zoom;
  return {
    zoom,
    tx: px - (px - view.tx) * k,
    ty: py - (py - view.ty) * k,
  };
}

// Legend positions 0-8 on the key top: [column, row].
const TOP_SLOTS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];
const ANCHORS = ["start", "middle", "end"] as const;

const KeyShape = memo(function KeyShape({
  keyData: k,
  zoom,
  layer,
  selected,
}: {
  keyData: LayoutKey;
  zoom: number;
  layer: LayoutLayer;
  selected: boolean;
}) {
  const W = k.w * zoom;
  const H = k.h * zoom;
  const gap = Math.max(1, zoom * 0.03);
  const radius = zoom * 0.09;
  const decal = Boolean(k.kle?.decal);
  const second =
    k.kle?.w2 !== undefined && k.kle.h2 !== undefined
      ? {
          x: -W / 2 + (k.kle.x2 ?? 0) * zoom,
          y: -H / 2 + (k.kle.y2 ?? 0) * zoom,
          w: k.kle.w2 * zoom,
          h: k.kle.h2 * zoom,
        }
      : null;
  const rects = [{ x: -W / 2, y: -H / 2, w: W, h: H }];
  if (second) rects.push(second);

  const stroke = selected
    ? "var(--color-electric)"
    : "var(--color-border-hover)";
  const fontSize = zoom * 0.21;
  const showText = fontSize >= 5;
  const padX = zoom * 0.14;
  const colX = [-W / 2 + padX, 0, W / 2 - padX];
  const rowY = [
    -H / 2 + zoom * 0.14 + fontSize * 0.8,
    fontSize * 0.36,
    H / 2 - zoom * 0.16,
  ];

  const matrixText =
    layer === "matrix" && !decal && k.matrix
      ? `${k.matrix.row},${k.matrix.col}`
      : null;

  return (
    <g
      data-key-id={k.id}
      transform={`translate(${k.cx * zoom} ${k.cy * zoom}) rotate(${k.angle})`}
      opacity={k.kle?.ghost ? 0.4 : 1}
      style={{ cursor: "pointer" }}
    >
      {!decal &&
        rects.map((r, i) => (
          <rect
            key={`o${i}`}
            x={r.x + gap}
            y={r.y + gap}
            width={Math.max(0, r.w - gap * 2)}
            height={Math.max(0, r.h - gap * 2)}
            rx={radius}
            fill="var(--color-surface-elevated)"
            stroke={stroke}
            strokeWidth={selected ? 2 : 1}
          />
        ))}
      {!decal &&
        rects.map((r, i) => (
          // Painted after both outlines so a stepped key reads as one shape.
          <rect
            key={`i${i}`}
            x={r.x + gap + 1}
            y={r.y + gap + 1}
            width={Math.max(0, r.w - gap * 2 - 2)}
            height={Math.max(0, r.h - gap * 2 - 2)}
            rx={Math.max(0, radius - 1)}
            fill="var(--color-surface-elevated)"
          />
        ))}
      {decal && (
        // Something to hit and to outline when selected; a decal has no cap.
        <rect
          x={-W / 2 + gap}
          y={-H / 2 + gap}
          width={Math.max(0, W - gap * 2)}
          height={Math.max(0, H - gap * 2)}
          rx={radius}
          fill="transparent"
          stroke={selected ? stroke : "none"}
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      )}
      {showText &&
        (layer === "legend" || decal) &&
        TOP_SLOTS.map(([col, row], slot) => {
          const text = k.legends[slot];
          if (!text) return null;
          return (
            <text
              key={slot}
              x={colX[col]}
              y={rowY[row]}
              textAnchor={ANCHORS[col]}
              fontSize={fontSize}
              fill="var(--color-text)"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {text}
            </text>
          );
        })}
      {showText && matrixText && (
        <text
          x={0}
          y={fontSize * 0.42}
          textAnchor="middle"
          fontSize={fontSize * 1.15}
          fill="var(--color-text)"
          style={{
            pointerEvents: "none",
            userSelect: "none",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {matrixText}
        </text>
      )}
      {layer === "matrix" && !decal && !k.matrix && (
        <circle
          r={Math.max(2, zoom * 0.06)}
          fill="var(--color-text-muted)"
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
});

export interface LayoutCanvasProps {
  project: LayoutProject;
  layer: LayoutLayer;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Change this to bring the whole layout back into view. */
  fitToken: number;
}

export function LayoutCanvas({
  project,
  layer,
  selectedId,
  onSelect,
  fitToken,
}: LayoutCanvasProps) {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ tx: 24, ty: 24, zoom: 54 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    moved: false,
    multi: false,
    downKey: null as string | null,
    startX: 0,
    startY: 0,
  });
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const fit = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const bounds = projectBounds(projectRef.current);
    if (!bounds || rect.width === 0 || rect.height === 0) return;
    const spanX = Math.max(bounds.maxX - bounds.minX, 1);
    const spanY = Math.max(bounds.maxY - bounds.minY, 1);
    const zoom = clampZoom(
      Math.min(
        (rect.width - FIT_PADDING * 2) / spanX,
        (rect.height - FIT_PADDING * 2) / spanY,
        FIT_MAX_ZOOM,
      ),
    );
    setView({
      zoom,
      tx: rect.width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom,
      ty: rect.height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom,
    });
  }, []);

  // Fit on first paint and whenever the page asks (a new layout was loaded).
  useEffect(() => {
    const id = window.requestAnimationFrame(fit);
    return () => window.cancelAnimationFrame(id);
  }, [fit, fitToken]);

  // React's onWheel is passive; zooming has to stop the page from scrolling.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // A trackpad pinch arrives as ctrl + wheel with small deltas.
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setView((v) =>
        zoomAt(v, factor, e.clientX - rect.left, e.clientY - rect.top),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      const keyEl = (e.target as Element).closest?.("[data-key-id]");
      gesture.current = {
        moved: false,
        multi: false,
        downKey: keyEl?.getAttribute("data-key-id") ?? null,
        startX: e.clientX,
        startY: e.clientY,
      };
    } else {
      gesture.current.multi = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    const g = gesture.current;

    if (pointers.current.size === 1) {
      if (
        !g.moved &&
        Math.hypot(next.x - g.startX, next.y - g.startY) < TAP_SLOP
      ) {
        return;
      }
      g.moved = true;
      pointers.current.set(e.pointerId, next);
      setView((v) => ({
        ...v,
        tx: v.tx + next.x - prev.x,
        ty: v.ty + next.y - prev.y,
      }));
      return;
    }

    if (pointers.current.size === 2) {
      let other = next;
      for (const [id, p] of pointers.current) {
        if (id !== e.pointerId) other = p;
      }
      pointers.current.set(e.pointerId, next);
      g.moved = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
      const nextDist = Math.hypot(next.x - other.x, next.y - other.y);
      const prevMid = {
        x: (prev.x + other.x) / 2 - rect.left,
        y: (prev.y + other.y) / 2 - rect.top,
      };
      const nextMid = {
        x: (next.x + other.x) / 2 - rect.left,
        y: (next.y + other.y) / 2 - rect.top,
      };
      const factor = prevDist > 0 ? nextDist / prevDist : 1;
      setView((v) => {
        const z = zoomAt(v, factor, prevMid.x, prevMid.y);
        return {
          zoom: z.zoom,
          tx: z.tx + nextMid.x - prevMid.x,
          ty: z.ty + nextMid.y - prevMid.y,
        };
      });
    }
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size > 0) return;
    const g = gesture.current;
    if (e.type === "pointerup" && !g.moved && !g.multi) {
      onSelect(g.downKey);
    }
  };

  const zoomByButton = (factor: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView((v) => zoomAt(v, factor, rect.width / 2, rect.height / 2));
  };

  const gridId = "layout-canvas-grid";
  const buttonClass =
    "w-11 h-11 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/90 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] backdrop-blur-sm";

  return (
    <div className="relative w-full h-full overflow-hidden">
      <svg
        ref={svgRef}
        role="img"
        aria-label={t("Keyboard layout")}
        className="w-full h-full block select-none"
        style={{ touchAction: "none", cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <defs>
          <pattern
            id={gridId}
            width={view.zoom}
            height={view.zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${view.tx} ${view.ty})`}
          >
            <path
              d={`M ${view.zoom} 0 L 0 0 0 ${view.zoom}`}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${gridId})`} />
        <g transform={`translate(${view.tx} ${view.ty})`}>
          {project.keys.map((k) => (
            <KeyShape
              key={k.id}
              keyData={k}
              zoom={view.zoom}
              layer={layer}
              selected={k.id === selectedId}
            />
          ))}
        </g>
      </svg>

      <div className="absolute right-3 bottom-3 flex flex-col gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => zoomByButton(1.25)}
          aria-label={t("Zoom in")}
          title={t("Zoom in")}
        >
          <IconPlus size={20} />
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => zoomByButton(0.8)}
          aria-label={t("Zoom out")}
          title={t("Zoom out")}
        >
          <IconMinus size={20} />
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={fit}
          aria-label={t("Show the whole layout")}
          title={t("Show the whole layout")}
        >
          <IconFocusCentered size={20} />
        </button>
      </div>
    </div>
  );
}
