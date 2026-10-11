/**
 * What can be done to the selected keys: size, nudging, and the actions
 * that copy or remove them. A side panel on a wide screen, a sheet above
 * the toolbar on a phone; every control is large enough for a thumb.
 */
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconCopy,
  IconFlipVertical,
  IconMinus,
  IconPlus,
  IconRotate,
  IconSquarePlus,
  IconTrash,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { isIsoEnter, SIZE_PRESETS } from "../lib/edit";
import type { LayoutKey } from "../lib/model";

const TILE =
  "min-h-11 min-w-11 px-2 flex items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors disabled:opacity-40";
const TILE_IDLE =
  "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]";
const TILE_ON =
  "border-[var(--color-electric)] text-[var(--color-text)] bg-[var(--color-electric)]/10";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A size with a button either side, for hands and for exact values. */
function Stepper({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  /** null when the selected keys differ. */
  value: number | null;
  step: number;
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  const base = value ?? 1;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      <button
        type="button"
        className={`${TILE} ${TILE_IDLE}`}
        onClick={() => onChange(base - step)}
        aria-label={t("{{name}}: smaller", { name: label })}
      >
        <IconMinus size={18} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={0.25}
        step={step}
        value={value ?? ""}
        placeholder="–"
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v) && v > 0) onChange(v);
        }}
        className="w-20 min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm text-center tabular-nums focus:outline-none focus:border-[var(--color-electric)]"
      />
      <button
        type="button"
        className={`${TILE} ${TILE_IDLE}`}
        onClick={() => onChange(base + step)}
        aria-label={t("{{name}}: larger", { name: label })}
      >
        <IconPlus size={18} />
      </button>
      <span className="text-xs text-[var(--color-text-muted)]">u</span>
    </div>
  );
}

export interface KeyPanelProps {
  keys: LayoutKey[];
  /** Step for the nudge and size buttons, in u. */
  step: number;
  onResize: (size: { w?: number; h?: number }) => void;
  onNudge: (dx: number, dy: number) => void;
  onIsoEnter: () => void;
  onConvex: (convex: boolean) => void;
  onAddNext: () => void;
  onDuplicate: () => void;
  onMirror: () => void;
  onDelete: () => void;
  rotation: {
    /** Pivot and arm are shown on the canvas. */
    shown: boolean;
    onToggleShown: () => void;
    fine: boolean;
    onToggleFine: () => void;
    onRotateBy: (delta: number) => void;
    /** How many corners the selection shares with a neighbour. */
    touching: number;
    onPivotToTouching: () => void;
    /** The pivot was moved by hand and can go back. */
    pivotMoved: boolean;
    onPivotReset: () => void;
    /** The selection overlaps another key. */
    overlapping: boolean;
    onSeparate: () => void;
  };
  /** Leave out the "n keys selected" line (the phone's sheet has its own). */
  hideCount?: boolean;
}

export function KeyPanel({
  keys,
  step,
  onResize,
  onNudge,
  onIsoEnter,
  onConvex,
  onAddNext,
  onDuplicate,
  onMirror,
  onDelete,
  rotation,
  hideCount = false,
}: KeyPanelProps) {
  const { t } = useLanguage();
  if (keys.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
        {t(
          "Select a key to change its size, move it, or copy it. Drag on empty space to select several.",
        )}
      </p>
    );
  }
  const same = (pick: (k: LayoutKey) => number) =>
    keys.every((k) => pick(k) === pick(keys[0])) ? pick(keys[0]) : null;
  const w = same((k) => k.w);
  const h = same((k) => k.h);
  const allIso = keys.every(isIsoEnter);
  const allConvex = keys.every((k) => k.convex);
  const angle = same((k) => k.angle);

  return (
    <div>
      {!hideCount && (
        <p className="text-sm text-[var(--color-text)] mb-3">
          {keys.length === 1
            ? t("1 key selected")
            : t("{{count}} keys selected", { count: keys.length })}
        </p>
      )}

      <Section title={t("Width")}>
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={!allIso && w === size}
              className={`${TILE} tabular-nums ${!allIso && w === size ? TILE_ON : TILE_IDLE}`}
              onClick={() => onResize({ w: size })}
            >
              {size}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={allIso}
          className={`${TILE} w-full mb-2 ${allIso ? TILE_ON : TILE_IDLE}`}
          onClick={onIsoEnter}
        >
          {t("ISO / JIS Enter")}
        </button>
        <button
          type="button"
          aria-pressed={allConvex}
          className={`${TILE} w-full mb-2 ${allConvex ? TILE_ON : TILE_IDLE}`}
          onClick={() => onConvex(!allConvex)}
        >
          {t("Convex cap")}
        </button>
        <div className="flex flex-col gap-2">
          <Stepper
            label={t("W")}
            value={w}
            step={step}
            onChange={(v) => onResize({ w: v })}
          />
          <Stepper
            label={t("H")}
            value={h}
            step={step}
            onChange={(v) => onResize({ h: v })}
          />
        </div>
      </Section>

      <Section title={t("Move by {{step}}u", { step })}>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={() => onNudge(-step, 0)}
            aria-label={t("Move left")}
          >
            <IconArrowLeft size={18} />
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={() => onNudge(0, -step)}
            aria-label={t("Move up")}
          >
            <IconArrowUp size={18} />
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={() => onNudge(0, step)}
            aria-label={t("Move down")}
          >
            <IconArrowDown size={18} />
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={() => onNudge(step, 0)}
            aria-label={t("Move right")}
          >
            <IconArrowRight size={18} />
          </button>
        </div>
      </Section>

      <Section title={t("Rotation")}>
        <div className="flex items-center gap-1.5 mb-2">
          {[-5, -1].map((d) => (
            <button
              key={d}
              type="button"
              className={`${TILE} tabular-nums ${TILE_IDLE}`}
              onClick={() => rotation.onRotateBy(d)}
            >
              {d}°
            </button>
          ))}
          <input
            type="number"
            inputMode="decimal"
            step={1}
            value={angle ?? ""}
            placeholder="–"
            aria-label={t("Angle")}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (
                e.target.value !== "" &&
                Number.isFinite(v) &&
                angle !== null
              ) {
                rotation.onRotateBy(v - angle);
              }
            }}
            className="w-16 min-h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm text-center tabular-nums focus:outline-none focus:border-[var(--color-electric)]"
          />
          {[1, 5].map((d) => (
            <button
              key={d}
              type="button"
              className={`${TILE} tabular-nums ${TILE_IDLE}`}
              onClick={() => rotation.onRotateBy(d)}
            >
              +{d}°
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={rotation.shown}
            className={`${TILE} ${rotation.shown ? TILE_ON : TILE_IDLE}`}
            onClick={rotation.onToggleShown}
          >
            <IconRotate size={18} />
            {t("Pivot and handle")}
          </button>
          <button
            type="button"
            aria-pressed={rotation.fine}
            className={`${TILE} ${rotation.fine ? TILE_ON : TILE_IDLE}`}
            onClick={rotation.onToggleFine}
          >
            {t("1° steps")}
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={rotation.onPivotToTouching}
            disabled={rotation.touching === 0}
          >
            {t("Pivot to touching corner")}
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={rotation.onPivotReset}
            disabled={!rotation.pivotMoved}
          >
            {t("Pivot back")}
          </button>
        </div>
        {rotation.overlapping && (
          <button
            type="button"
            className={`${TILE} w-full mt-1.5 border-[#e5484d] text-[var(--color-text)]`}
            onClick={rotation.onSeparate}
          >
            {t("Move clear of overlap")}
          </button>
        )}
      </Section>

      <Section title={t("Key actions")}>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={onAddNext}
            disabled={keys.length !== 1}
          >
            <IconSquarePlus size={18} />
            {t("Add beside")}
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={onDuplicate}
          >
            <IconCopy size={18} />
            {t("Duplicate")}
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={onMirror}
          >
            <IconFlipVertical size={18} />
            {t("Mirror")}
          </button>
          <button
            type="button"
            className={`${TILE} ${TILE_IDLE}`}
            onClick={onDelete}
          >
            <IconTrash size={18} />
            {t("Delete")}
          </button>
        </div>
      </Section>
    </div>
  );
}
