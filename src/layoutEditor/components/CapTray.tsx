/**
 * The caps the layout did not use, laid out under the canvas. With a key
 * selected, the caps that are its size light up and a tap puts one on it;
 * on a desktop a cap can also be dragged onto a key.
 */
import { useMemo } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { capFitsKey, type PoolCap } from "../lib/fit";
import { kitById } from "../lib/kits";
import type { LayoutKey } from "../lib/model";

const UNIT = 34;

export function CapTray({
  spare,
  target,
  onPick,
}: {
  spare: PoolCap[];
  /** The selected key, if one is. */
  target: LayoutKey | null;
  onPick: (capId: string) => void;
}) {
  const { t } = useLanguage();
  // By set, then widest last, then by legend, so a size is easy to find.
  const groups = useMemo(() => {
    const byKit = new Map<string, PoolCap[]>();
    for (const cap of spare) {
      byKit.set(cap.kitId, [...(byKit.get(cap.kitId) ?? []), cap]);
    }
    return [...byKit].map(([kitId, caps]) => ({
      kitId,
      name: kitById(kitId)?.name ?? kitId,
      caps: caps
        .slice()
        .sort(
          (a, b) =>
            a.cap.w * a.cap.h - b.cap.w * b.cap.h ||
            (a.cap.row ?? "").localeCompare(b.cap.row ?? "") ||
            a.cap.main.localeCompare(b.cap.main),
        ),
    }));
  }, [spare]);

  if (spare.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {t("No caps are left over.")}
      </p>
    );
  }

  return (
    <div
      className="flex gap-4 overflow-x-auto px-3 py-2"
      aria-label={t("Caps left over")}
    >
      {groups.map((group) => (
        <div key={group.kitId} className="flex-shrink-0">
          <div className="text-[11px] text-[var(--color-text-muted)] mb-1 whitespace-nowrap">
            {group.name} · {group.caps.length}
          </div>
          <div className="flex gap-1 items-end">
            {group.caps.map(({ id, cap }) => {
              const fits = target ? capFitsKey(cap, target) : true;
              return (
                <button
                  key={id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-keebon-cap", id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onPick(id)}
                  disabled={!target || !fits}
                  title={[
                    cap.sub ? `${cap.sub} ${cap.main}` : cap.main,
                    `${cap.w}u${cap.h !== 1 ? ` x ${cap.h}u` : ""}`,
                    cap.row,
                    cap.convex ? t("convex") : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  style={{
                    width: Math.min(cap.w, 3) * UNIT,
                    height: Math.min(cap.h, 1.4) * UNIT,
                  }}
                  className={`relative flex-shrink-0 rounded-md border text-[10px] leading-tight px-1 overflow-hidden text-left transition-opacity ${
                    target && fits
                      ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                      : "border-[var(--color-border-hover)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]"
                  } ${target && !fits ? "opacity-30" : ""}`}
                >
                  <span className="block truncate">
                    {cap.sub ? `${cap.sub} ${cap.main}` : cap.main}
                  </span>
                  <span className="absolute right-1 bottom-0.5 text-[9px] text-[var(--color-text-muted)] tabular-nums">
                    {cap.w !== 1 ? cap.w : ""}
                    {cap.row ? ` ${cap.row}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
