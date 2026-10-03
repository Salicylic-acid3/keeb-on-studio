import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  IconArrowRight,
  IconCopy,
  IconPlayerPlay,
  IconPlayerStop,
} from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import { KeyboardLayoutContext } from "../../contexts/KeyboardLayoutContext";
import { QmkKeymapBoard } from "../components/QmkKeymapBoard";
import { QmkKeycodePicker } from "../components/QmkKeycodePicker";
import {
  layerGroups,
  groupTitle,
  relayerKeycode,
  type LayerGroup,
} from "../lib/osBlocks";
import type { UseVialKeyboard } from "../hooks/useVialKeyboard";
import type { VialKey } from "../lib/vial/kle";

interface QmkKeymapPageProps {
  keyboard: UseVialKeyboard;
}

export function QmkKeymapPage({ keyboard }: QmkKeymapPageProps) {
  const { t } = useLanguage();
  const { layout: keyboardLayout } = useContext(KeyboardLayoutContext);
  const { info, keymap, originalKeymap, os, visible } = keyboard;
  const groups = useMemo(
    () => (info ? layerGroups(info.definition, info.layerCount, os) : []),
    [info, os],
  );
  const [groupIndex, setGroupIndex] = useState(0);
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(
    null,
  );
  const [continuous, setContinuous] = useState(false);
  const [copyTarget, setCopyTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const group: LayerGroup | undefined = groups[groupIndex];

  // Follow the keyboard: when the firmware switches blocks (plugged into a
  // different OS, or a preview), open that block.
  useEffect(() => {
    if (!os || !groups.length) return;
    const active = groups.findIndex((g) => g.block === os.activeBlock);
    if (
      active >= 0 &&
      active !== groupIndex &&
      !groups[groupIndex]?.layers.includes(layer)
    ) {
      setGroupIndex(active);
      setLayer(groups[active].layers[0] ?? 0);
    }
  }, [os?.activeBlock]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (group && !group.layers.includes(layer)) setLayer(group.layers[0] ?? 0);
  }, [group, layer]);

  const selectKey = useCallback((key: VialKey) => {
    setSelected((prev) =>
      prev?.row === key.row && prev?.col === key.col
        ? null
        : { row: key.row, col: key.col },
    );
  }, []);

  const nextKey = useCallback(
    (from: { row: number; col: number }) => {
      const i = visible.findIndex(
        (k) => k.row === from.row && k.col === from.col,
      );
      const next = visible[i + 1];
      return next ? { row: next.row, col: next.col } : null;
    },
    [visible],
  );

  const assign = useCallback(
    async (code: number) => {
      if (!selected) return;
      setBusy(true);
      try {
        await keyboard.setKeycode(layer, selected.row, selected.col, code);
        if (continuous) setSelected(nextKey(selected));
      } finally {
        setBusy(false);
      }
    },
    [selected, layer, keyboard, continuous, nextKey],
  );

  const copyBlock = useCallback(async () => {
    if (!group || copyTarget === null || !keymap) return;
    const target = groups[copyTarget];
    if (!target || target.block === group.block) return;
    setBusy(true);
    try {
      for (
        let i = 0;
        i < group.layers.length && i < target.layers.length;
        i++
      ) {
        const src = keymap[group.layers[i]];
        const dstLayer = target.layers[i];
        for (let r = 0; r < src.length; r++) {
          for (let c = 0; c < src[r].length; c++) {
            const code = relayerKeycode(src[r][c], group, target);
            if (keymap[dstLayer][r][c] !== code) {
              await keyboard.setKeycode(dstLayer, r, c, code);
            }
          }
        }
      }
      setCopyTarget(null);
    } finally {
      setBusy(false);
    }
  }, [group, groups, copyTarget, keymap, keyboard]);

  if (!info || !keymap || !group) return null;

  const currentCode = selected
    ? (keymap[layer]?.[selected.row]?.[selected.col] ?? 0)
    : 0;
  const isActiveGroup = os ? group.block === os.activeBlock : true;

  return (
    <div className="flex flex-col gap-4 p-4">
      {groups.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label={t("OS blocks")}
        >
          {groups.map((g, i) => {
            const active = os?.activeBlock === g.block;
            return (
              <button
                key={g.id}
                role="tab"
                aria-selected={i === groupIndex}
                type="button"
                onClick={() => {
                  setGroupIndex(i);
                  setLayer(g.layers[0] ?? 0);
                  setSelected(null);
                }}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  i === groupIndex
                    ? "bg-[var(--color-electric)]/15 border-[var(--color-electric)] text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-electric)]/60"
                }`}
                title={t("Block {{id}}: layers {{layers}}", {
                  id: g.id,
                  layers: g.layers.join(", "),
                })}
              >
                {groupTitle(g, t)}
                {active && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--color-electric)]">
                    {t("Active")}
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-xs">
            <IconCopy size={14} className="text-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-secondary)]">
              {t("Copy this block to")}
            </span>
            <select
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
              value={copyTarget ?? ""}
              onChange={(e) =>
                setCopyTarget(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">{t("Choose...")}</option>
              {groups.map((g, i) =>
                i === groupIndex ? null : (
                  <option key={g.id} value={i}>
                    {groupTitle(g, t)}
                  </option>
                ),
              )}
            </select>
            <button
              type="button"
              className="btn-electric text-xs flex items-center gap-1"
              disabled={copyTarget === null || busy}
              onClick={copyBlock}
              title={t(
                "Layer keys are renumbered for the target block (MO(1) becomes MO(5))",
              )}
            >
              <IconArrowRight size={14} />
              {t("Copy")}
            </button>
          </div>
        </div>
      )}

      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label={t("Layers")}
      >
        {group.layers.map((l, i) => (
          <button
            key={l}
            role="tab"
            aria-selected={l === layer}
            type="button"
            onClick={() => {
              setLayer(l);
              setSelected(null);
            }}
            className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
              l === layer
                ? "bg-[var(--color-electric)] text-white border-[var(--color-electric)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-electric)]/60"
            }`}
          >
            {i === 0 && groups.length > 1
              ? t("Base")
              : t("Layer {{n}}", { n: l })}
            <span className="ml-1 opacity-60">#{l}</span>
          </button>
        ))}
        {!isActiveGroup && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {t("This block is not the one the keyboard is using right now.")}
          </span>
        )}
        <button
          type="button"
          onClick={() => setContinuous((v) => !v)}
          className={`ml-auto flex items-center gap-1 px-3 py-1 rounded-full border text-xs transition-colors ${
            continuous
              ? "bg-[var(--color-neon)]/15 border-[var(--color-neon)] text-[var(--color-text)]"
              : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
          }`}
          title={t(
            "After setting a key, move on to the next one automatically",
          )}
        >
          {continuous ? (
            <IconPlayerStop size={14} />
          ) : (
            <IconPlayerPlay size={14} />
          )}
          {t("Continuous entry")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-6">
        <QmkKeymapBoard
          keys={visible}
          layer={keymap[layer]}
          originalLayer={originalKeymap?.[layer]}
          selected={selected}
          onKeyClick={selectKey}
          onKeyReset={(k) => keyboard.resetKey(layer, k.row, k.col)}
          keyboardLayout={keyboardLayout}
          ariaLabel={t("Keymap of layer {{n}}", { n: layer })}
        />
      </div>

      {selected ? (
        <QmkKeycodePicker
          key={`${layer}-${selected.row}-${selected.col}`}
          current={currentCode}
          layers={group.layers}
          tapDanceCount={0}
          macroCount={0}
          keyboardLayout={keyboardLayout}
          onSelect={assign}
        />
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          {t(
            "Click a key to change what it does. Changes are written to the keyboard right away.",
          )}
        </p>
      )}
    </div>
  );
}
