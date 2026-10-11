/**
 * The caps the layout did not use, laid out under the canvas the way a
 * person sorts them: a pile per row, per length and per shape (convex caps
 * apart from plain ones). With a key selected, the piles that fit it light
 * up and a tap puts a cap on it; on a desktop a cap can also be dragged
 * onto a key.
 */
import { useMemo } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import type { CapArt } from "../lib/capArt";
import { capFitsKey, pileCaps, type CapPile, type PoolCap } from "../lib/fit";
import { kitById } from "../lib/kits";
import type { LayoutKey } from "../lib/model";

/** How big the spare caps are drawn: pixels per u, and their legend size. */
export const TRAY_SIZES = {
  small: { unit: 34, font: 10 },
  medium: { unit: 48, font: 12 },
  large: { unit: 64, font: 14 },
} as const;
export type TraySize = keyof typeof TRAY_SIZES;

export function CapTray({
  spare,
  target,
  size,
  artOf,
  onPick,
}: {
  spare: PoolCap[];
  /** The selected key, if one is. */
  target: LayoutKey | null;
  size: TraySize;
  /** A cap's printed design, when its colourway has one. */
  artOf: (cap: PoolCap) => CapArt | null;
  onPick: (capId: string) => void;
}) {
  const { t } = useLanguage();
  const { unit: UNIT, font } = TRAY_SIZES[size];
  // By set; within a set, a pile per row, length and shape.
  const groups = useMemo(() => {
    const byKit = new Map<string, PoolCap[]>();
    for (const cap of spare) {
      byKit.set(cap.kitId, [...(byKit.get(cap.kitId) ?? []), cap]);
    }
    return [...byKit].map(([kitId, caps]) => ({
      kitId,
      name: kitById(kitId)?.name ?? kitId,
      count: caps.length,
      piles: pileCaps(caps),
    }));
  }, [spare]);

  if (spare.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {t("No caps are left over.")}
      </p>
    );
  }

  const pileName = (pile: CapPile) =>
    [
      pile.row,
      pile.iso
        ? "ISO Enter"
        : pile.h === 1
          ? `${pile.w}u`
          : `${pile.w}u × ${pile.h}u`,
      pile.convex ? t("convex") : "",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div
      className="max-h-[36dvh] overflow-y-auto px-3 py-2"
      aria-label={t("Caps left over")}
    >
      {groups.map((group) => (
        <section key={group.kitId} className="mb-3 last:mb-0">
          <h4 className="text-[11px] text-[var(--color-text-muted)] mb-1.5">
            {group.name} · {group.count}
          </h4>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(target
              ? // The piles that fit the selected key come to the front.
                [
                  ...group.piles.filter((p) =>
                    capFitsKey(p.caps[0].cap, target),
                  ),
                  ...group.piles.filter(
                    (p) => !capFitsKey(p.caps[0].cap, target),
                  ),
                ]
              : group.piles
            ).map((pile) => {
              const fits = target ? capFitsKey(pile.caps[0].cap, target) : true;
              const name = pileName(pile);
              return (
                <div
                  key={name}
                  className={`min-w-0 ${target && !fits ? "opacity-30" : ""}`}
                >
                  <div
                    className={`text-[11px] mb-1 whitespace-nowrap tabular-nums ${
                      target && fits
                        ? "text-[var(--color-electric)] font-medium"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {name}
                    <span className="text-[var(--color-text-muted)] font-normal">
                      {" "}
                      ×{pile.caps.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pile.caps.map((pooled) => {
                      const { id, cap } = pooled;
                      const width = Math.min(pile.w, 3) * UNIT;
                      const height =
                        (pile.iso ? 1.4 : Math.min(pile.h, 1.4)) * UNIT;
                      const art = artOf(pooled);
                      const sx = art ? width / art.w : 1;
                      const sy = art ? height / art.h : 1;
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
                            cap.blank
                              ? t("blank cap")
                              : cap.sub
                                ? `${cap.sub} ${cap.main}`
                                : cap.main,
                            name,
                          ].join(" · ")}
                          style={{
                            width,
                            height,
                            fontSize: font,
                            borderRadius: pile.convex ? 12 : 6,
                            ...(art
                              ? {
                                  backgroundImage: `url(${art.href})`,
                                  backgroundSize: `${art.sheetW * sx}px ${art.sheetH * sy}px`,
                                  backgroundPosition: `${-art.x * sx}px ${-art.y * sy}px`,
                                }
                              : {}),
                          }}
                          className={`flex-shrink-0 border leading-tight px-1 overflow-hidden text-left ${
                            target && fits
                              ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                              : "border-[var(--color-border-hover)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {!art && (
                            <span className="block truncate">
                              {cap.sub ? `${cap.sub} ${cap.main}` : cap.main}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
