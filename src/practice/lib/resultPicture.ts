/**
 * A finished run as a picture to save or post: the numbers, the keymap
 * with the misses tinted on it (one drawing per layer that had any), the
 * most missed keys and the characters the keymap cannot type. The same
 * paper and ink as the layout editor's picture, so the two look like one
 * family. Saved as PNG, or as a one-page PDF around the same picture.
 */
import type { TestBoard, TestKey } from "../../keyTest/lib/boards";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import { rotatePoint } from "../../layoutEditor/lib/model";
import { labelOnLayer } from "./keyLookup";
import type { Summary } from "./results";

const PAPER = "#fbf7ec";
const CAP = "#f1ead6";
const EDGE = "#c9bd9d";
const INK = "#2b2620";
const FAINT = "#8a8171";
const HEAT = [173, 0, 45]; // vermillion, the brand's primary

export interface PictureText {
  title: string;
  boardName: string;
  text: string;
  date: string;
  accuracy: string;
  speed: string;
  misses: string;
  mostMissed: string;
  unavailable: string;
  none: string;
  layerName: (layer: number) => string;
  credit: string;
}

const UNIT = 64;
const MARGIN = 48;
const MAX_WIDTH = 1800;

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
  for (const k of keys)
    for (const r of rectsOf(k))
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
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

function heatFill(count: number, max: number): string {
  const level = max > 0 ? Math.min(1, count / max) : 0;
  const alpha = 0.18 + 0.62 * level;
  return `rgba(${HEAT[0]}, ${HEAT[1]}, ${HEAT[2]}, ${alpha})`;
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  board: TestBoard,
  layer: number,
  layout: LabelLayout,
  heat: Map<string, number>,
  unit: number,
  originX: number,
  originY: number,
) {
  const max = Math.max(0, ...heat.values());
  const gap = Math.max(1, unit * 0.04);
  const radius = unit * 0.1;
  for (const k of board.keys) {
    const label = labelOnLayer(k, layer, layout);
    const count = heat.get(k.id) ?? 0;
    const sends = k.trigger.kind === "key" || k.trigger.kind === "mouse";
    ctx.save();
    ctx.translate(originX + k.cx * unit, originY + k.cy * unit);
    ctx.rotate((k.angle * Math.PI) / 180);
    for (const r of rectsOf(k)) {
      roundRect(
        ctx,
        r.x * unit + gap,
        r.y * unit + gap,
        r.w * unit - gap * 2,
        r.h * unit - gap * 2,
        radius,
      );
      ctx.fillStyle = count ? heatFill(count, max) : label ? CAP : PAPER;
      ctx.fill();
      ctx.strokeStyle = count ? `rgb(${HEAT.join(",")})` : EDGE;
      ctx.lineWidth = count ? 2 : 1;
      if (!sends || !label) ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const W = k.w * unit;
    const H = k.h * unit;
    const main = label?.main ?? "";
    const sub = label?.sub;
    const fontSize = Math.min(
      unit * 0.26,
      (Math.min(W, H * 1.6) - unit * 0.2) / Math.max(1, main.length * 0.62),
    );
    ctx.fillStyle =
      count > 0 && count / max > 0.6 ? "#ffffff" : label ? INK : FAINT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (sub) {
      ctx.font = `${fontSize * 0.75}px system-ui, sans-serif`;
      ctx.globalAlpha = 0.7;
      ctx.fillText(sub, 0, -H / 2 + unit * 0.3);
      ctx.globalAlpha = 1;
    }
    ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
    ctx.fillText(main, 0, sub ? H / 2 - unit * 0.28 : 0);
    if (count) {
      ctx.font = `600 ${unit * 0.17}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(String(count), W / 2 - unit * 0.12, H / 2 - unit * 0.16);
    }
    ctx.restore();
  }
}

export interface ResultPictureInput {
  board: TestBoard;
  layout: LabelLayout;
  summary: Summary;
  text: PictureText;
}

/** The result drawn onto a new canvas. */
export function resultCanvas({
  board,
  layout,
  summary,
  text,
}: ResultPictureInput): HTMLCanvasElement {
  const box = boundsOf(board.keys);
  const boardW = box.maxX - box.minX;
  const boardH = box.maxY - box.minY;
  const unit = Math.min(UNIT, (MAX_WIDTH - MARGIN * 2) / Math.max(boardW, 8));
  const width = Math.max(
    Math.round(boardW * unit + MARGIN * 2),
    Math.round(Math.max(boardW, 14) * unit + MARGIN * 2),
  );

  // Layers drawn: the base always, then any layer with misses on it.
  const layers = [
    0,
    ...[...summary.heatByLayer.keys()].filter((l) => l !== 0).sort(),
  ];
  const lineH = 30;
  const headH = 36 + 30 + 44 + 24; // title, board/date, stat tiles, gap
  const perBoard = boardH * unit + 36 + 16;
  const listLines = Math.min(8, summary.pairs.length) || 1;
  const listH = 30 + listLines * lineH + 16;
  const unavailableH = 30 + lineH + 16;
  const height = Math.round(
    MARGIN + headH + layers.length * perBoard + listH + unavailableH + 40,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "alphabetic";

  let y = MARGIN;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(text.title, MARGIN, y + 24);
  y += 36;
  ctx.fillStyle = FAINT;
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(`${text.boardName}  ·  ${text.date}`, MARGIN, y + 18);
  ctx.textAlign = "right";
  ctx.fillText(text.text, width - MARGIN, y + 18, width * 0.55);
  y += 30;

  // Stat tiles.
  const tiles: Array<[string, string]> = [
    [text.accuracy, `${summary.accuracy}%`],
    [text.speed, summary.cpm ? String(summary.cpm) : "—"],
    [text.misses, String(summary.wrongPresses)],
  ];
  const tileW = Math.min(220, (width - MARGIN * 2 - 24) / 3);
  tiles.forEach(([label, value], i) => {
    const x = MARGIN + i * (tileW + 12);
    roundRect(ctx, x, y, tileW, 44, 8);
    ctx.fillStyle = CAP;
    ctx.fill();
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = FAINT;
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(label, x + 12, y + 18);
    ctx.fillStyle = INK;
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(value, x + 12, y + 38);
  });
  y += 44 + 24;

  for (const layer of layers) {
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = "500 16px system-ui, sans-serif";
    ctx.fillText(text.layerName(layer), MARGIN, y + 16);
    y += 36;
    const originX =
      MARGIN + (width - MARGIN * 2 - boardW * unit) / 2 - box.minX * unit;
    drawBoard(
      ctx,
      board,
      layer,
      layout,
      summary.heatByLayer.get(layer) ?? new Map(),
      unit,
      originX,
      y - box.minY * unit,
    );
    y += boardH * unit + 16;
  }

  // Most missed.
  ctx.fillStyle = INK;
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText(text.mostMissed, MARGIN, y + 16);
  y += 30;
  ctx.font = "16px ui-monospace, SFMono-Regular, Menlo, monospace";
  if (summary.pairs.length === 0) {
    ctx.fillStyle = FAINT;
    ctx.fillText(text.none, MARGIN, y + 20);
    y += lineH;
  } else {
    for (const p of summary.pairs.slice(0, 8)) {
      ctx.fillStyle = INK;
      ctx.fillText(`${show(p.expected)} → ${show(p.got)}`, MARGIN, y + 20);
      ctx.fillStyle = FAINT;
      ctx.fillText(`×${p.count}`, MARGIN + 180, y + 20);
      y += lineH;
    }
  }
  y += 16;

  ctx.fillStyle = INK;
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText(text.unavailable, MARGIN, y + 16);
  y += 30;
  ctx.font = "16px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = summary.unavailable.length ? INK : FAINT;
  ctx.fillText(
    summary.unavailable.length
      ? summary.unavailable.map((u) => `${show(u.ch)} ×${u.count}`).join("   ")
      : text.none,
    MARGIN,
    y + 20,
  );

  ctx.fillStyle = FAINT;
  ctx.textAlign = "right";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(text.credit, width - MARGIN, height - 20);
  return canvas;
}

function show(ch: string): string {
  return ch === " " ? "␣" : ch;
}

export function resultPng(input: ResultPictureInput): Promise<Blob | null> {
  const canvas = resultCanvas(input);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * A one-page PDF holding the picture as a JPEG, written by hand: the file
 * is a handful of objects and needs no library.
 */
export function resultPdf(input: ResultPictureInput): Blob {
  const canvas = resultCanvas(input);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const jpeg = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) =>
    c.charCodeAt(0),
  );
  // A4 landscape or portrait, whichever fits the picture better, in points.
  const landscape = canvas.width > canvas.height;
  const pageW = landscape ? 841.89 : 595.28;
  const pageH = landscape ? 595.28 : 841.89;
  const margin = 28;
  const scale = Math.min(
    (pageW - margin * 2) / canvas.width,
    (pageH - margin * 2) / canvas.height,
  );
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const x = (pageW - w) / 2;
  const y = pageH - margin - h;

  const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const put = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  put("%PDF-1.4\n%âãÏÓ\n");
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = length;
    put(`${n} 0 obj\n${body}\n`);
    if (stream) {
      put("stream\n");
      put(stream);
      put("\nendstream\n");
    }
    put("endobj\n");
  };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`,
  );
  obj(4, `<< /Length ${enc.encode(content).length} >>`, enc.encode(content));
  obj(
    5,
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg,
  );
  const xref = length;
  put(`xref\n0 6\n0000000000 65535 f \n`);
  for (let n = 1; n <= 5; n++)
    put(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
