/**
 * The layout drawn on a canvas that pans and zooms, where keys are picked,
 * dragged and stretched directly.
 *
 * Mouse: click a key to select it (Shift / Ctrl / Cmd adds), drag a key to
 * move the selection, drag empty space for a selection box, wheel to zoom,
 * Space + drag or the middle / right button to pan. Alt while dragging
 * leaves the grid.
 *
 * Touch: tap to select, drag a selected key to move the selection, drag
 * anywhere else to pan, two fingers to pan and pinch. A long press on a key
 * asks the page for multi-select, where taps add and remove keys.
 *
 * With rotation shown, the pivot is a marker that can be dragged (it snaps
 * to corners, centres and edge midpoints) and an arm from it ends in a
 * handle that turns the selection: 5 degrees at a time, 1 with Shift or the
 * fine switch. Keys that overlap are drawn in red while it happens.
 *
 * Everything is laid out in pixels (u x zoom) rather than under an SVG
 * scale(): browsers with a minimum font size (Chrome in Japanese has one by
 * default) clamp a sub-pixel font size before scaling it, which would blow
 * the legends up.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { IconFocusCentered, IconMinus, IconPlus } from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import { keysInRect, resizedKey, snapValue } from "../lib/edit";
import {
  findOverlaps,
  limitMove,
  limitRotation,
  nearestPoint,
  normalizeAngle,
  pivotTargets,
  rotatedKey,
  snapMoveToCorners,
} from "../lib/geometry";
import {
  keyCorners,
  projectBounds,
  rotatePoint,
  type LayoutKey,
  type LayoutLayer,
  type LayoutProject,
  type Point,
} from "../lib/model";

const MIN_ZOOM = 10;
const MAX_ZOOM = 220;
/** Largest zoom "fit" picks, so a few keys do not fill the whole screen. */
const FIT_MAX_ZOOM = 72;
const FIT_PADDING = 28;
/** Pointer travel, in px, below which a press is a tap rather than a drag. */
const TAP_SLOP = 6;
const LONG_PRESS_MS = 500;
/** Smallest touch target for a handle, in px, whatever the zoom. */
const HANDLE_HIT = 44;
/** How close, in px, a dragged corner or pivot has to be to snap. */
const SNAP_PX = 10;
/** Turning snaps to a neighbour's angle within this many degrees. */
const ANGLE_SNAP = 2.5;
const CLASH = "#e5484d";

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
  clash,
}: {
  keyData: LayoutKey;
  zoom: number;
  layer: LayoutLayer;
  selected: boolean;
  /** Overlaps another key. */
  clash: boolean;
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

  const stroke = clash
    ? CLASH
    : selected
      ? "var(--color-electric)"
      : "var(--color-border-hover)";
  const fill = clash
    ? `color-mix(in srgb, ${CLASH} 22%, var(--color-surface-elevated))`
    : "var(--color-surface-elevated)";
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
      style={{ cursor: selected ? "move" : "pointer" }}
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
            fill={fill}
            stroke={stroke}
            strokeWidth={selected || clash ? 2 : 1}
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
            fill={fill}
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
  selection: ReadonlySet<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** A drag ended: move these keys by (dx, dy) u. */
  onMoveKeys: (ids: string[], dx: number, dy: number) => void;
  /** The width handle was let go at this width, in u. */
  onResizeKey: (id: string, w: number) => void;
  /** Grid step in u, or null when snapping is off. */
  snapStep: number | null;
  /** Taps add and remove keys instead of replacing the selection. */
  multiSelect: boolean;
  onLongPressKey: (id: string) => void;
  /** Show the pivot and the turning arm for the selection. */
  rotateMode: boolean;
  /** Where the selection turns around, in u; null with nothing selected. */
  pivot: Point | null;
  onPivotChange: (pivot: Point) => void;
  /** The arm was let go: turn these keys by `delta` degrees. */
  onRotateKeys: (ids: string[], pivot: Point, delta: number) => void;
  /** Turn 1 degree at a time instead of 5. */
  fineRotate: boolean;
  /** Dragging and turning stop when the keys meet another key. */
  stopAtKeys: boolean;
  /** Change this to bring the whole layout back into view. */
  fitToken: number;
}

type Mode =
  | "idle"
  | "pan"
  | "move"
  | "marquee"
  | "resize"
  | "pivot"
  | "rotate"
  | "spent";

interface Gesture {
  mode: Mode;
  /** The drag has gone past the tap slop. */
  moved: boolean;
  mouse: boolean;
  additive: boolean;
  downKey: string | null;
  startX: number;
  startY: number;
  moveIds: string[];
  resizeId: string | null;
  resizeStartW: number;
  /** Pointer angle around the pivot when the arm was grabbed, in degrees. */
  rotateStart: number;
}

const IDLE: Gesture = {
  mode: "idle",
  moved: false,
  mouse: true,
  additive: false,
  downKey: null,
  startX: 0,
  startY: 0,
  moveIds: [],
  resizeId: null,
  resizeStartW: 1,
  rotateStart: 0,
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function LayoutCanvas({
  project,
  layer,
  selection,
  onSelectionChange,
  onMoveKeys,
  onResizeKey,
  snapStep,
  multiSelect,
  onLongPressKey,
  rotateMode,
  pivot,
  onPivotChange,
  onRotateKeys,
  fineRotate,
  stopAtKeys,
  fitToken,
}: LayoutCanvasProps) {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ tx: 24, ty: 24, zoom: 54 });
  const [drag, setDrag] = useState<{
    ids: string[];
    dx: number;
    dy: number;
  } | null>(null);
  const [resize, setResize] = useState<{ id: string; w: number } | null>(null);
  const [marquee, setMarquee] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [turn, setTurn] = useState<{ ids: string[]; delta: number } | null>(
    null,
  );
  const [pivotDrag, setPivotDrag] = useState<Point | null>(null);
  const [panning, setPanning] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ ...IDLE });
  const longPress = useRef<number | null>(null);
  const spaceHeld = useRef(false);
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const fit = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const bounds = projectBounds(projectRef.current);
    if (rect.width === 0 || rect.height === 0) return;
    if (!bounds) {
      setView({ zoom: 54, tx: rect.width / 2 - 27, ty: rect.height / 2 - 27 });
      return;
    }
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

  // When the canvas changes size (the phone's sheet opening under it, a
  // window resize), keep the layout where it was relative to the middle,
  // so a key just tapped does not slide under the sheet.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last: { w: number; h: number } | null = null;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      if (last && box.width > 0 && box.height > 0) {
        const dw = box.width - last.w;
        const dh = box.height - last.h;
        if (dw !== 0 || dh !== 0) {
          setView((v) => ({ ...v, tx: v.tx + dw / 2, ty: v.ty + dh / 2 }));
        }
      }
      if (box.width > 0 && box.height > 0) {
        last = { w: box.width, h: box.height };
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  // Space held turns the next mouse drag into a pan.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "BUTTON" || tag === "A") return;
      spaceHeld.current = true;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeld.current = false;
    };
    const blur = () => {
      spaceHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const clearLongPress = () => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };
  useEffect(() => clearLongPress, []);

  const cancelPreviews = () => {
    setDrag(null);
    setResize(null);
    setMarquee(null);
    setTurn(null);
    setPivotDrag(null);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size > 1) {
      // A second finger: whatever the first was doing becomes pan and pinch.
      clearLongPress();
      cancelPreviews();
      gesture.current = { ...gesture.current, mode: "pan", moved: true };
      return;
    }

    const target = e.target as Element;
    const mouse = e.pointerType === "mouse";
    const downKey =
      target.closest?.("[data-key-id]")?.getAttribute("data-key-id") ?? null;
    const handle = target
      .closest?.("[data-resize-handle]")
      ?.getAttribute("data-resize-handle");
    const onPivot = Boolean(target.closest?.("[data-pivot]"));
    const onArm = Boolean(target.closest?.("[data-rotate-handle]"));
    const svgRect = e.currentTarget.getBoundingClientRect();
    const g: Gesture = {
      ...IDLE,
      mouse,
      additive: e.shiftKey || e.metaKey || e.ctrlKey,
      downKey,
      startX: e.clientX,
      startY: e.clientY,
    };

    if (onArm && pivot) {
      g.mode = "rotate";
      g.moveIds = [...selection];
      g.rotateStart =
        (Math.atan2(
          e.clientY - svgRect.top - (view.ty + pivot.y * view.zoom),
          e.clientX - svgRect.left - (view.tx + pivot.x * view.zoom),
        ) *
          180) /
        Math.PI;
    } else if (onPivot && pivot) {
      g.mode = "pivot";
    } else if (handle) {
      const key = project.keys.find((k) => k.id === handle);
      if (key) {
        g.mode = "resize";
        g.resizeId = key.id;
        g.resizeStartW = key.w;
      }
    } else if (mouse) {
      if (e.button === 1 || e.button === 2 || spaceHeld.current) g.mode = "pan";
      else if (downKey) g.mode = "move";
      else g.mode = "marquee";
    } else if (downKey && selection.has(downKey) && !multiSelect) {
      g.mode = "move";
    } else {
      g.mode = "pan";
    }
    gesture.current = g;

    if (!mouse && downKey && g.mode !== "resize" && !onPivot && !onArm) {
      clearLongPress();
      longPress.current = window.setTimeout(() => {
        longPress.current = null;
        if (gesture.current.moved) return;
        gesture.current = { ...gesture.current, mode: "spent" };
        onLongPressKey(downKey);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    const g = gesture.current;

    if (pointers.current.size === 2) {
      let other = next;
      for (const [id, p] of pointers.current) {
        if (id !== e.pointerId) other = p;
      }
      pointers.current.set(e.pointerId, next);
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
      return;
    }
    if (pointers.current.size !== 1 || g.mode === "spent") return;

    if (
      !g.moved &&
      Math.hypot(next.x - g.startX, next.y - g.startY) < TAP_SLOP
    ) {
      return;
    }
    if (!g.moved) {
      g.moved = true;
      clearLongPress();
      if (g.mode === "pan") setPanning(true);
      if (g.mode === "move" && g.downKey) {
        // Dragging a key that is not selected picks it up first.
        if (selection.has(g.downKey)) {
          g.moveIds = [...selection];
        } else {
          const ids = g.additive
            ? new Set([...selection, g.downKey])
            : new Set([g.downKey]);
          g.moveIds = [...ids];
          onSelectionChange(ids);
        }
      }
    }
    pointers.current.set(e.pointerId, next);

    const step = e.altKey ? null : snapStep;
    // Zoomed far out, ten pixels is a third of a key: cap the reach in u
    // so snapping to corners does not swallow the grid.
    const snapReach = Math.min(SNAP_PX / view.zoom, 0.2);
    const rawX = (next.x - g.startX) / view.zoom;
    const rawY = (next.y - g.startY) / view.zoom;

    if (g.mode === "pan") {
      setView((v) => ({
        ...v,
        tx: v.tx + next.x - prev.x,
        ty: v.ty + next.y - prev.y,
      }));
    } else if (g.mode === "move") {
      const anchor = project.keys.find((k) => k.id === g.downKey);
      let dx = snapValue(rawX, step);
      let dy = snapValue(rawY, step);
      if (anchor && anchor.angle === 0) {
        // Land the grabbed key's corner on the grid, wherever it started.
        const left = anchor.cx - anchor.w / 2;
        const top = anchor.cy - anchor.h / 2;
        dx = snapValue(left + rawX, step) - left;
        dy = snapValue(top + rawY, step) - top;
      }
      if (!e.altKey) {
        // A corner about to meet a neighbour's corner goes all the way.
        const near = snapMoveToCorners(
          project,
          g.moveIds,
          rawX,
          rawY,
          snapReach,
        );
        if (near.x !== rawX || near.y !== rawY) {
          dx = near.x;
          dy = near.y;
        }
      }
      if (stopAtKeys) {
        const allowed = limitMove(project, g.moveIds, dx, dy);
        dx = allowed.x;
        dy = allowed.y;
      }
      setDrag({ ids: g.moveIds, dx, dy });
    } else if (g.mode === "resize" && g.resizeId) {
      const key = project.keys.find((k) => k.id === g.resizeId);
      if (key) {
        // Only the part of the drag along the key's own width counts.
        const along = rotatePoint(
          { x: rawX, y: rawY },
          { x: 0, y: 0 },
          -key.angle,
        ).x;
        const w = Math.max(0.25, snapValue(g.resizeStartW + along, step));
        setResize({ id: key.id, w });
      }
    } else if (g.mode === "pivot") {
      const rect = e.currentTarget.getBoundingClientRect();
      const at = {
        x: (next.x - rect.left - view.tx) / view.zoom,
        y: (next.y - rect.top - view.ty) / view.zoom,
      };
      const near = e.altKey
        ? null
        : nearestPoint(at, pivotTargets(project, selection), snapReach);
      setPivotDrag(
        near ?? { x: snapValue(at.x, step), y: snapValue(at.y, step) },
      );
    } else if (g.mode === "rotate" && pivot) {
      const rect = e.currentTarget.getBoundingClientRect();
      const now =
        (Math.atan2(
          next.y - rect.top - (view.ty + pivot.y * view.zoom),
          next.x - rect.left - (view.tx + pivot.x * view.zoom),
        ) *
          180) /
        Math.PI;
      const raw = normalizeAngle(now - g.rotateStart);
      const unit = e.shiftKey || fineRotate ? 1 : 5;
      let delta = e.altKey ? raw : Math.round(raw / unit) * unit;
      const lead = project.keys.find((k) => k.id === g.moveIds[0]);
      if (lead && !e.altKey && unit !== 1) {
        // Line up with a neighbour that is nearly at the same angle.
        const moving = new Set(g.moveIds);
        for (const k of project.keys) {
          if (moving.has(k.id)) continue;
          const off = normalizeAngle(k.angle - (lead.angle + raw));
          if (Math.abs(off) <= ANGLE_SNAP) {
            delta = normalizeAngle(k.angle - lead.angle);
            break;
          }
        }
      }
      if (stopAtKeys) {
        delta = limitRotation(project, g.moveIds, pivot, delta);
      }
      setTurn({ ids: g.moveIds, delta });
    } else if (g.mode === "marquee") {
      const rect = e.currentTarget.getBoundingClientRect();
      setMarquee({
        x0: g.startX - rect.left,
        y0: g.startY - rect.top,
        x1: next.x - rect.left,
        y1: next.y - rect.top,
      });
    }
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size > 0) return;
    clearLongPress();
    setPanning(false);
    const g = gesture.current;
    gesture.current = { ...IDLE };
    const finished = e.type === "pointerup";

    if (!g.moved) {
      cancelPreviews();
      if (
        !finished ||
        g.mode === "spent" ||
        g.mode === "resize" ||
        g.mode === "pivot" ||
        g.mode === "rotate"
      ) {
        return;
      }
      if (g.mode === "pan" && g.mouse) return;
      if (g.downKey) {
        if (g.additive || (multiSelect && !g.mouse)) {
          const ids = new Set(selection);
          if (ids.has(g.downKey)) ids.delete(g.downKey);
          else ids.add(g.downKey);
          onSelectionChange(ids);
        } else {
          onSelectionChange(new Set([g.downKey]));
        }
      } else if (!g.additive && !(multiSelect && !g.mouse)) {
        if (selection.size > 0) onSelectionChange(new Set());
      }
      return;
    }

    if (g.mode === "move" && drag && finished) {
      if (drag.dx !== 0 || drag.dy !== 0) {
        onMoveKeys(drag.ids, drag.dx, drag.dy);
      }
    } else if (g.mode === "resize" && resize && finished) {
      onResizeKey(resize.id, resize.w);
    } else if (g.mode === "pivot" && pivotDrag && finished) {
      onPivotChange(pivotDrag);
    } else if (g.mode === "rotate" && turn && pivot && finished) {
      if (turn.delta !== 0) onRotateKeys(turn.ids, pivot, turn.delta);
    } else if (g.mode === "marquee" && marquee && finished) {
      const toU = (px: number, offset: number) => (px - offset) / view.zoom;
      const hit = keysInRect(project, {
        minX: toU(Math.min(marquee.x0, marquee.x1), view.tx),
        maxX: toU(Math.max(marquee.x0, marquee.x1), view.tx),
        minY: toU(Math.min(marquee.y0, marquee.y1), view.ty),
        maxY: toU(Math.max(marquee.y0, marquee.y1), view.ty),
      });
      onSelectionChange(
        g.additive ? new Set([...selection, ...hit]) : new Set(hit),
      );
    }
    cancelPreviews();
  };

  const zoomByButton = (factor: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView((v) => zoomAt(v, factor, rect.width / 2, rect.height / 2));
  };

  const moving = drag ? new Set(drag.ids) : null;
  const turning = turn ? new Set(turn.ids) : null;
  const shownPivot = pivotDrag ?? pivot;
  const shown = project.keys.map((k) => {
    if (resize && resize.id === k.id) return resizedKey(k, resize.w);
    if (turn && pivot && turning?.has(k.id)) {
      return rotatedKey(k, pivot, turn.delta);
    }
    if (drag && moving?.has(k.id)) {
      return { ...k, cx: k.cx + drag.dx, cy: k.cy + drag.dy };
    }
    return k;
  });
  // The width handle belongs to a lone selected key.
  const only =
    selection.size === 1 ? shown.find((k) => selection.has(k.id)) : undefined;
  const handleKey = only && !only.kle?.decal ? only : undefined;

  // Selected keys are painted last, so one dragged over others stays in
  // sight instead of sliding underneath.
  const drawOrder = [
    ...shown.filter((k) => !selection.has(k.id)),
    ...shown.filter((k) => selection.has(k.id)),
  ];
  // Recomputed while dragging, so the red follows the keys.
  const clashes = findOverlaps(shown);

  // The turning arm: from the pivot, a little past the furthest selected
  // corner, pointing up until it is dragged round.
  let arm: { px: number; py: number; hx: number; hy: number } | null = null;
  if (rotateMode && shownPivot && selection.size > 0) {
    let reach = 0;
    for (const k of project.keys) {
      if (!selection.has(k.id)) continue;
      for (const c of keyCorners(k)) {
        reach = Math.max(
          reach,
          Math.hypot(c.x - shownPivot.x, c.y - shownPivot.y),
        );
      }
    }
    const length = Math.min(260, Math.max(72, reach * view.zoom + 34));
    const dir = ((-90 + (turn?.delta ?? 0)) * Math.PI) / 180;
    const px = shownPivot.x * view.zoom;
    const py = shownPivot.y * view.zoom;
    arm = {
      px,
      py,
      hx: px + Math.cos(dir) * length,
      hy: py + Math.sin(dir) * length,
    };
  }

  const handleInset = handleKey
    ? Math.min(22, (handleKey.w * view.zoom) / 4)
    : 0;

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
        style={{
          touchAction: "none",
          WebkitTouchCallout: "none",
          cursor: panning ? "grabbing" : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onContextMenu={(e) => e.preventDefault()}
        // A touch is fully handled by the pointer events above. Without
        // this the browser follows up with a click at the same spot, which
        // lands on whatever the tap just made appear there.
        onTouchEnd={(e) => {
          if (e.cancelable) e.preventDefault();
        }}
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
          {drawOrder.map((k) => (
            <KeyShape
              key={k.id}
              keyData={k}
              zoom={view.zoom}
              layer={layer}
              selected={selection.has(k.id)}
              clash={clashes.has(k.id)}
            />
          ))}
          {handleKey && (
            <g
              transform={`translate(${handleKey.cx * view.zoom} ${
                handleKey.cy * view.zoom
              }) rotate(${handleKey.angle})`}
            >
              <rect
                x={(handleKey.w * view.zoom) / 2 - 4}
                y={-Math.min(14, (handleKey.h * view.zoom) / 4)}
                width={8}
                height={Math.min(28, (handleKey.h * view.zoom) / 2)}
                rx={4}
                fill="var(--color-electric)"
                stroke="var(--color-surface)"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
              <rect
                data-resize-handle={handleKey.id}
                // Reaches into the key (a quarter of it at most, so the rest
                // still drags the key) more than out of it, so the next
                // key's left edge stays its own.
                x={(handleKey.w * view.zoom) / 2 - handleInset}
                y={-HANDLE_HIT / 2}
                width={handleInset + Math.min(18, view.zoom * 0.3)}
                height={HANDLE_HIT}
                fill="transparent"
                style={{ cursor: "ew-resize" }}
              />
            </g>
          )}
          {arm && (
            <g>
              <line
                x1={arm.px}
                y1={arm.py}
                x2={arm.hx}
                y2={arm.hy}
                stroke="var(--color-cyber)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                style={{ pointerEvents: "none" }}
              />
              <g data-rotate-handle="" style={{ cursor: "grab" }}>
                <circle
                  cx={arm.hx}
                  cy={arm.hy}
                  r={HANDLE_HIT / 2}
                  fill="transparent"
                />
                <circle
                  cx={arm.hx}
                  cy={arm.hy}
                  r={9}
                  fill="var(--color-cyber)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              </g>
              <g data-pivot="" style={{ cursor: "move" }}>
                <circle
                  cx={arm.px}
                  cy={arm.py}
                  r={HANDLE_HIT / 2 - 6}
                  fill="transparent"
                />
                <circle
                  cx={arm.px}
                  cy={arm.py}
                  r={7}
                  fill="var(--color-surface)"
                  stroke="var(--color-cyber)"
                  strokeWidth={2}
                />
                <path
                  d={`M ${arm.px - 12} ${arm.py} H ${arm.px + 12} M ${arm.px} ${
                    arm.py - 12
                  } V ${arm.py + 12}`}
                  stroke="var(--color-cyber)"
                  strokeWidth={1.5}
                />
              </g>
            </g>
          )}
        </g>
        {marquee && (
          <rect
            x={Math.min(marquee.x0, marquee.x1)}
            y={Math.min(marquee.y0, marquee.y1)}
            width={Math.abs(marquee.x1 - marquee.x0)}
            height={Math.abs(marquee.y1 - marquee.y0)}
            fill="color-mix(in srgb, var(--color-cyber) 15%, transparent)"
            stroke="var(--color-cyber)"
            strokeWidth={1}
            style={{ pointerEvents: "none" }}
          />
        )}
      </svg>

      {(resize || turn) && (
        <div className="absolute left-3 top-3 px-2 py-1 rounded-md bg-[var(--color-surface)]/90 border border-[var(--color-border)] text-xs text-[var(--color-text)] tabular-nums pointer-events-none">
          {resize
            ? `${resize.w}u`
            : `${turn!.delta > 0 ? "+" : ""}${turn!.delta}°`}
        </div>
      )}

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
