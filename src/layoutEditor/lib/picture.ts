/**
 * The layout as a picture (PNG) to save or post: the keys as on screen,
 * with the layout's name above and where it was made below. With the
 * keycap check on, the caps carry their printed design.
 */
import type { CapArt } from "./capArt";
import type { FitMark } from "./fitMark";
import {
  projectBounds,
  type LayoutKey,
  type LayoutLayer,
  type LayoutProject,
} from "./model";

export interface PictureOptions {
  layer: LayoutLayer;
  /** The keycap check's verdicts, when it is on. */
  marks: ReadonlyMap<string, FitMark> | null;
  /** Line under the picture (the editor's address). */
  credit: string;
}

const PAPER = "#fbf7ec";
const CAP = "#f1ead6";
const EDGE = "#c9bd9d";
const INK = "#2b2620";
const FAINT = "#8a8171";
const BARE = "#e9dcc6";

/** Longest side of the picture, in pixels. */
const MAX_SIDE = 2400;
const UNIT = 84;
const PAD = 0.6;

export interface PictureFrame {
  /** Pixels per u. */
  unit: number;
  width: number;
  height: number;
  /** Where the layout's (0, 0) goes. */
  originX: number;
  originY: number;
  titleY: number | null;
  creditY: number;
}

/** Sizes of the picture for a layout (pure, so it can be checked). */
export function pictureFrame(project: LayoutProject): PictureFrame | null {
  const b = projectBounds(project);
  if (!b) return null;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const title = project.name.trim() ? 0.9 : 0;
  const credit = 0.55;
  const unitsW = Math.max(w + PAD * 2, 6);
  const unitsH = h + PAD * 2 + title + credit;
  const unit = Math.min(UNIT, MAX_SIDE / Math.max(unitsW, unitsH));
  return {
    unit,
    width: Math.round(unitsW * unit),
    height: Math.round(unitsH * unit),
    originX: ((unitsW - w) / 2 - b.minX) * unit,
    originY: (PAD + title - b.minY) * unit,
    titleY: title ? (PAD * 0.55 + 0.45) * unit : null,
    creditY: (unitsH - 0.3) * unit,
  };
}

function loadImage(href: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${href}`));
    img.src = href;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Legend positions 0-8 on the key top: [column, row] (as the canvas has them).
const SLOTS: Array<[number, number]> = [
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
const ALIGN = ["left", "center", "right"] as const;

function drawKey(
  ctx: CanvasRenderingContext2D,
  k: LayoutKey,
  unit: number,
  layer: LayoutLayer,
  mark: FitMark | undefined,
  sheets: Map<string, HTMLImageElement>,
) {
  const W = k.w * unit;
  const H = k.h * unit;
  const gap = Math.max(1, unit * 0.03);
  const radius = unit * 0.09;
  const decal = Boolean(k.kle?.decal);
  const rects = [{ x: -W / 2, y: -H / 2, w: W, h: H }];
  if (k.kle?.w2 !== undefined && k.kle.h2 !== undefined) {
    rects.push({
      x: -W / 2 + (k.kle.x2 ?? 0) * unit,
      y: -H / 2 + (k.kle.y2 ?? 0) * unit,
      w: k.kle.w2 * unit,
      h: k.kle.h2 * unit,
    });
  }
  const art: CapArt | undefined = mark?.art;
  const sheet = art && sheets.get(art.href);

  ctx.save();
  ctx.translate(k.cx * unit, k.cy * unit);
  ctx.rotate((k.angle * Math.PI) / 180);
  if (k.kle?.ghost) ctx.globalAlpha = 0.4;

  if (!decal) {
    if (art && sheet) {
      const x0 = Math.min(...rects.map((r) => r.x)) + gap;
      const y0 = Math.min(...rects.map((r) => r.y)) + gap;
      const x1 = Math.max(...rects.map((r) => r.x + r.w)) - gap;
      const y1 = Math.max(...rects.map((r) => r.y + r.h)) - gap;
      ctx.drawImage(
        sheet,
        art.x,
        art.y,
        art.w,
        art.h,
        x0,
        y0,
        x1 - x0,
        y1 - y0,
      );
    } else {
      const bare = mark?.status === "missing";
      // Outlines first, fills after, so a stepped key reads as one shape.
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = Math.max(1, unit * 0.02);
      for (const r of rects) {
        roundRect(
          ctx,
          r.x + gap,
          r.y + gap,
          r.w - gap * 2,
          r.h - gap * 2,
          radius,
        );
        ctx.stroke();
      }
      ctx.fillStyle = bare ? BARE : CAP;
      for (const r of rects) {
        roundRect(
          ctx,
          r.x + gap + 0.5,
          r.y + gap + 0.5,
          r.w - gap * 2 - 1,
          r.h - gap * 2 - 1,
          radius,
        );
        ctx.fill();
      }
    }
  }

  const legends =
    art && sheet
      ? []
      : mark
        ? mark.status === "missing"
          ? []
          : mark.sub
            ? [mark.sub, "", "", "", "", "", mark.main]
            : [mark.main]
        : k.legends;
  const fontSize = unit * 0.21;
  const padX = unit * 0.14;
  const colX = [-W / 2 + padX, 0, W / 2 - padX];
  const rowY = [
    -H / 2 + unit * 0.14 + fontSize * 0.8,
    fontSize * 0.36,
    H / 2 - unit * 0.16,
  ];
  const matrix = !decal && k.matrix ? `${k.matrix.row},${k.matrix.col}` : null;
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  if (layer !== "matrix" || decal || mark) {
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    SLOTS.forEach(([col, row], slot) => {
      const text = legends[slot];
      if (!text) return;
      ctx.textAlign = ALIGN[col];
      ctx.fillText(text, colX[col], rowY[row]);
    });
  }
  if (layer === "matrix" && !mark && matrix) {
    ctx.font = `${fontSize * 1.15}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(matrix, 0, fontSize * 0.42);
  }
  if (layer === "both" && !mark && matrix) {
    ctx.font = `${fontSize * 0.78}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = FAINT;
    ctx.fillText(matrix, W / 2 - padX * 0.7, H / 2 - unit * 0.12);
  }
  ctx.restore();
}

/** The picture as a PNG, or null for an empty layout. */
export async function layoutPng(
  project: LayoutProject,
  options: PictureOptions,
): Promise<Blob | null> {
  const frame = pictureFrame(project);
  if (!frame) return null;
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // The design sheets the caps on the keys come from.
  const sheets = new Map<string, HTMLImageElement>();
  const hrefs = new Set<string>();
  for (const mark of options.marks?.values() ?? []) {
    if (mark.art) hrefs.add(mark.art.href);
  }
  await Promise.all(
    [...hrefs].map(async (href) => {
      try {
        sheets.set(href, await loadImage(href));
      } catch {
        // Without its sheet a cap is drawn plainly.
      }
    }),
  );

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, frame.width, frame.height);
  ctx.save();
  ctx.translate(frame.originX, frame.originY);
  for (const key of project.keys) {
    drawKey(
      ctx,
      key,
      frame.unit,
      options.layer,
      options.marks?.get(key.id),
      sheets,
    );
  }
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  if (frame.titleY !== null) {
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `600 ${frame.unit * 0.36}px system-ui, sans-serif`;
    ctx.fillText(
      project.name.trim(),
      PAD * frame.unit,
      frame.titleY,
      frame.width - PAD * 2 * frame.unit,
    );
  }
  ctx.fillStyle = FAINT;
  ctx.textAlign = "right";
  ctx.font = `${frame.unit * 0.2}px system-ui, sans-serif`;
  ctx.fillText(options.credit, frame.width - PAD * frame.unit, frame.creditY);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
