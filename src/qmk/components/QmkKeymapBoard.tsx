/**
 * The keyboard picture for the QMK side: PhysicalKey per matrix position,
 * labelled from the QMK keycode. Same keycap component as the ZMK side, so
 * the two halves of the app look like one.
 */
import { useMemo } from "react";
import { PhysicalKey } from "../../components/PhysicalKey";
import type { VialKey } from "../lib/vial/kle";
import { qmkKeycodeLabel } from "../lib/keycodes/qmkLabels";
import type { KeyboardLayoutType } from "../../lib/keyboardLayouts";

const BASE_UNIT_SIZE = 54;

interface QmkKeymapBoardProps {
  keys: VialKey[];
  /** keycodes[row][col] of the layer being shown */
  layer: number[][];
  originalLayer?: number[][];
  selected: { row: number; col: number } | null;
  onKeyClick(key: VialKey): void;
  onKeyReset(key: VialKey): void;
  keyboardLayout?: KeyboardLayoutType;
  scale?: number;
  ariaLabel?: string;
}

function corners(k: VialKey) {
  const pts = [
    { x: k.x, y: k.y },
    { x: k.x + k.width, y: k.y },
    { x: k.x + k.width, y: k.y + k.height },
    { x: k.x, y: k.y + k.height },
  ];
  if (!k.r) return pts;
  const rad = (k.r / 100) * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return pts.map((p) => {
    const dx = p.x - k.rx;
    const dy = p.y - k.ry;
    return { x: k.rx + dx * cos - dy * sin, y: k.ry + dx * sin + dy * cos };
  });
}

export function QmkKeymapBoard({
  keys,
  layer,
  originalLayer,
  selected,
  onKeyClick,
  onKeyReset,
  keyboardLayout,
  scale = 1,
  ariaLabel,
}: QmkKeymapBoardProps) {
  const { shifted, width, height } = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const k of keys) {
      for (const p of corners(k)) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (!keys.length) return { shifted: [], width: 0, height: 0 };
    const unit = BASE_UNIT_SIZE * scale;
    return {
      shifted: keys.map((k) => ({
        ...k,
        x: k.x - minX,
        y: k.y - minY,
        rx: k.rx - minX,
        ry: k.ry - minY,
      })),
      width: ((maxX - minX) / 100) * unit,
      height: ((maxY - minY) / 100) * unit,
    };
  }, [keys, scale]);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="relative mx-auto"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {shifted.map((k, i) => {
        const code = layer[k.row]?.[k.col] ?? 0;
        const original = originalLayer?.[k.row]?.[k.col];
        const label = qmkKeycodeLabel(code, keyboardLayout);
        const isModified = original !== undefined && original !== code;
        return (
          <PhysicalKey
            key={`${k.row}-${k.col}-${i}`}
            attrs={{
              width: k.width,
              height: k.height,
              x: k.x,
              y: k.y,
              r: k.r,
              rx: k.rx,
              ry: k.ry,
            }}
            keyPosition={i}
            displayName={label.short}
            longDisplayName={label.long}
            originalDisplayName={
              original !== undefined
                ? qmkKeycodeLabel(original, keyboardLayout).long
                : undefined
            }
            isModified={isModified}
            isOriginalKnown={original !== undefined}
            isSelected={selected?.row === k.row && selected?.col === k.col}
            onClick={() => onKeyClick(k)}
            onReset={() => onKeyReset(k)}
            scale={scale}
          />
        );
      })}
    </div>
  );
}
