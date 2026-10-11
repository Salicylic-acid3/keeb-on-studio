/**
 * The keycap check: choose sets, see how much of the layout they cover,
 * what is short, what buying more would fix, and put caps right by hand.
 */
import { IconMinus, IconPlus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import {
  missingBySize,
  type FitResult,
  type KitChoice,
  type Placement,
} from "../lib/fit";
import { FIT_COLORS } from "../lib/fitMark";
import { kitById, SWITCH_TYPES, type Kit, type SwitchType } from "../lib/kits";
import type { LayoutKey } from "../lib/model";

const TILE =
  "min-h-11 min-w-11 px-2 flex items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors disabled:opacity-40";
const TILE_IDLE =
  "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]";

const ROWS = ["R4", "R3", "R2", "R1"];

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

function Dot({ status }: { status: keyof typeof FIT_COLORS }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
      style={{ background: FIT_COLORS[status] }}
    />
  );
}

export interface FitPanelProps {
  totalKeys: number;
  /** The switches the keyboard uses; nothing else is offered until chosen. */
  switchType: SwitchType | null;
  onSwitch: (switchType: SwitchType) => void;
  /** The sets that go on those switches. */
  kits: Kit[];
  choices: KitChoice[];
  onCount: (kitId: string, count: number) => void;
  fit: FitResult;
  onApply: (choices: KitChoice[]) => void;
  comparison: Array<{ kit: Kit; counts: FitResult["counts"] }>;
  /** The layout's rows, top to bottom: a few legends to tell them by, and their sculpt row. */
  rows: Array<{ hint: string; row: string }>;
  onRow: (index: number, row: string) => void;
  /** Any chosen set has rows of different shapes. */
  sculpted: boolean;
  target: LayoutKey | null;
  targetPlacement: Placement | null;
  onBare: () => void;
  /** Mark the selected key as taking a convex cap, or a plain one. */
  onConvex: (convex: boolean) => void;
  onAuto: () => void;
  pinned: number;
  onAutoAll: () => void;
}

export function FitPanel({
  totalKeys,
  switchType,
  onSwitch,
  kits,
  choices,
  onCount,
  fit,
  onApply,
  comparison,
  rows,
  onRow,
  sculpted,
  target,
  targetPlacement,
  onBare,
  onConvex,
  onAuto,
  pinned,
  onAutoAll,
}: FitPanelProps) {
  const { t } = useLanguage();
  const countOf = (kitId: string) =>
    choices.find((c) => c.kitId === kitId)?.count ?? 0;
  const chosen = choices.some((c) => c.count > 0);
  const short = missingBySize(fit.missing);
  const covered = totalKeys - fit.counts.missing;

  const switchNames: Record<SwitchType, { name: string; note: string }> = {
    mx: { name: t("Cherry MX compatible"), note: "" },
    lowprofile: {
      name: t("Low profile"),
      note: "Kailh Choc v2, Gateron LP",
    },
    click: {
      name: t("Mouse micro switch"),
      note: t("ClickBoard compatible"),
    },
  };
  const switchPicker = (
    <Section title={t("Switches")}>
      <div className="flex flex-col gap-1.5">
        {SWITCH_TYPES.map((type) => {
          const on = type === switchType;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => onSwitch(type)}
              className={`${TILE} !justify-start text-left flex-col !items-start !gap-0 py-2 ${
                on
                  ? "border-[var(--color-electric)] text-[var(--color-text)] bg-[var(--color-electric)]/10"
                  : TILE_IDLE
              }`}
            >
              <span>{switchNames[type].name}</span>
              {switchNames[type].note && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {switchNames[type].note}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Section>
  );
  if (!switchType) {
    return (
      <div>
        {switchPicker}
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {t(
            "Choose the switches your keyboard uses first. The keycap sets that go on them are offered next.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      {switchPicker}
      <Section title={t("Keycap sets")}>
        <div className="flex flex-col gap-1.5">
          {kits.map((kit) => {
            const count = countOf(kit.id);
            return (
              <div key={kit.id} className="flex items-center gap-1.5">
                <span
                  className={`flex-1 min-w-0 text-sm truncate ${
                    count > 0
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {kit.name}
                </span>
                <button
                  type="button"
                  className={`${TILE} ${TILE_IDLE}`}
                  onClick={() => onCount(kit.id, Math.max(0, count - 1))}
                  disabled={count === 0}
                  aria-label={t("{{name}}: one fewer", { name: kit.name })}
                >
                  <IconMinus size={16} />
                </button>
                <span
                  className="w-6 text-center text-sm tabular-nums text-[var(--color-text)]"
                  aria-label={t("{{name}}: {{count}} sets", {
                    name: kit.name,
                    count,
                  })}
                >
                  {count}
                </span>
                <button
                  type="button"
                  className={`${TILE} ${TILE_IDLE}`}
                  onClick={() => onCount(kit.id, Math.min(9, count + 1))}
                  aria-label={t("{{name}}: one more", { name: kit.name })}
                >
                  <IconPlus size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {chosen && (
        <Section title={t("Result")}>
          <p className="text-sm text-[var(--color-text)] mb-2">
            {t("{{covered}} of {{total}} keys covered", {
              covered,
              total: totalKeys,
            })}
          </p>
          <ul className="text-sm text-[var(--color-text-secondary)] space-y-1 tabular-nums">
            <li>
              <Dot status="ok" />
              {t("Right legend: {{count}}", { count: fit.counts.ok })}
            </li>
            <li>
              <Dot status="blank" />
              {t("Blank cap: {{count}}", { count: fit.counts.blank })}
            </li>
            <li>
              <Dot status="sub" />
              {t("Another legend: {{count}}", { count: fit.counts.sub })}
            </li>
            <li>
              <Dot status="missing" />
              {t("No cap: {{count}}", { count: fit.counts.missing })}
              {short.length > 0 &&
                ` (${short
                  .map(
                    (s) =>
                      `${
                        s.iso
                          ? "ISO Enter"
                          : s.h === 1
                            ? `${s.w}u`
                            : `${s.w}u × ${s.h}u`
                      }${s.convex ? ` ${t("convex")}` : ""} ×${s.count}`,
                  )
                  .join(", ")})`}
            </li>
          </ul>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {t("{{count}} caps left over, shown under the layout.", {
              count: fit.spare.length,
            })}
          </p>
        </Section>
      )}

      {chosen && target && (
        <Section title={t("Selected key")}>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2 leading-relaxed">
            {targetPlacement
              ? `${kitById(targetPlacement.cap.kitId)?.name ?? ""}: ${
                  targetPlacement.cap.cap.blank
                    ? t("blank cap")
                    : [
                        targetPlacement.cap.cap.sub,
                        targetPlacement.cap.cap.main,
                      ]
                        .filter(Boolean)
                        .join(" ")
                }${
                  targetPlacement.cap.cap.row
                    ? ` · ${targetPlacement.cap.cap.row}`
                    : ""
                }${targetPlacement.offRow ? ` · ${t("made for another row")}` : ""}`
              : t("No cap on this key.")}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mb-2 leading-relaxed">
            {t(
              "Tap a lit cap under the layout to put it here, or drag this key onto another to trade caps.",
            )}
          </p>
          <button
            type="button"
            aria-pressed={Boolean(target.convex)}
            className={`${TILE} w-full mb-1.5 ${
              target.convex
                ? "border-[var(--color-electric)] text-[var(--color-text)] bg-[var(--color-electric)]/10"
                : TILE_IDLE
            }`}
            onClick={() => onConvex(!target.convex)}
          >
            {t("This key takes a convex cap")}
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={`${TILE} ${TILE_IDLE}`}
              onClick={onBare}
              disabled={!targetPlacement}
            >
              {t("Take the cap off")}
            </button>
            <button
              type="button"
              className={`${TILE} ${TILE_IDLE}`}
              onClick={onAuto}
            >
              {t("Back to automatic")}
            </button>
          </div>
        </Section>
      )}

      {chosen && pinned > 0 && (
        <Section title={t("Placed by hand")}>
          <button
            type="button"
            className={`${TILE} w-full ${TILE_IDLE}`}
            onClick={onAutoAll}
          >
            {t("All {{count}} keys back to automatic", { count: pinned })}
          </button>
        </Section>
      )}

      {chosen && sculpted && rows.length > 0 && (
        <Section title={t("Which row each line is")}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2 leading-relaxed">
            {t(
              "These sets have a different shape per row. Rows are counted up from the bottom; change one if your layout differs.",
            )}
          </p>
          <div className="flex flex-col gap-1">
            {rows.map((row, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate text-[var(--color-text-secondary)]">
                  {row.hint || t("Row {{n}}", { n: i + 1 })}
                </span>
                <select
                  value={row.row}
                  onChange={(e) => onRow(i, e.target.value)}
                  className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-2"
                >
                  {ROWS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("One of each set against this layout")}>
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-[var(--color-text-muted)]">
              <th className="text-left font-normal pb-1">{t("Keycap set")}</th>
              <th className="font-normal pb-1" title={t("Right legend")}>
                <Dot status="ok" />
              </th>
              <th className="font-normal pb-1" title={t("Blank cap")}>
                <Dot status="blank" />
              </th>
              <th className="font-normal pb-1" title={t("Another legend")}>
                <Dot status="sub" />
              </th>
              <th className="font-normal pb-1" title={t("No cap")}>
                <Dot status="missing" />
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.map(({ kit, counts }) => (
              <tr key={kit.id} className="text-[var(--color-text-secondary)]">
                <td className="py-1 pr-2">
                  <button
                    type="button"
                    className="text-left text-[var(--color-cyber)] hover:underline"
                    onClick={() => onApply([{ kitId: kit.id, count: 1 }])}
                  >
                    {kit.name}
                  </button>
                </td>
                <td className="text-center">{counts.ok}</td>
                <td className="text-center">{counts.blank}</td>
                <td className="text-center">{counts.sub}</td>
                <td
                  className="text-center"
                  style={
                    counts.missing > 0
                      ? { color: FIT_COLORS.missing }
                      : undefined
                  }
                >
                  {counts.missing}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!chosen && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-relaxed">
            {t(
              "Pick a set above, or tap a name here, to see it on the layout.",
            )}
          </p>
        )}
      </Section>
    </div>
  );
}
