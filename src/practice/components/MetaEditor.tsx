/**
 * The keyboard metadata editor (SPEC §8): what the setup guide needs to
 * know about a keyboard, filled in by clicking the keys on its drawing.
 * Opened with /practice?meta; meant for registering a keyboard, not for
 * the people who practise.
 *
 * It starts from the stored values or, for a keyboard not yet in
 * keyboards.json, from an estimate. The result is JSON to paste into
 * src/practice/data/keyboards.json under the keyboard's id.
 */
import { useMemo, useState } from "react";
import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import type { TestBoard } from "../../keyTest/lib/boards";
import {
  estimateMeta,
  guidesFor,
  hasStoredMeta,
  keyboardMeta,
  SIZE_CLASSES,
  type Hand,
  type KeyboardMeta,
  type SizeClass,
} from "../lib/metadata";
import { Notice } from "./bits";
import { PracticeBoard, type Mark } from "./PracticeBoard";

type T = (key: string, params?: Record<string, string | number>) => string;

type Role =
  | "thumbL"
  | "thumbR"
  | "homeL"
  | "homeR"
  | "esc"
  | "tab"
  | "capslock"
  | "symbol"
  | "layerL"
  | "layerR";

const ROLES: Array<[Role, string, string]> = [
  ["thumbL", "Thumb (left)", "var(--color-electric)"],
  ["thumbR", "Thumb (right)", "var(--color-electric)"],
  ["homeL", "Home row (left)", "var(--color-cyber)"],
  ["homeR", "Home row (right)", "var(--color-cyber)"],
  ["symbol", "Symbol slot", "var(--color-neon)"],
  ["layerL", "Layer key (left)", "var(--color-warning)"],
  ["layerR", "Layer key (right)", "var(--color-warning)"],
  ["esc", "Esc", "var(--color-text-muted)"],
  ["tab", "Tab", "var(--color-text-muted)"],
  ["capslock", "CapsLock", "var(--color-text-muted)"],
];

const ROLE_TAG: Record<Role, string> = {
  thumbL: "T·L",
  thumbR: "T·R",
  homeL: "H·L",
  homeR: "H·R",
  symbol: "Sym",
  layerL: "Ly·L",
  layerR: "Ly·R",
  esc: "Esc",
  tab: "Tab",
  capslock: "Caps",
};

function without(list: number[], pos: number) {
  return list.filter((p) => p !== pos);
}

/** Apply a click with `role` on key `pos`: toggles membership. */
function toggle(meta: KeyboardMeta, role: Role, pos: number): KeyboardMeta {
  const m: KeyboardMeta = {
    ...meta,
    thumbKeys: [...meta.thumbKeys],
    homeRow: { L: [...meta.homeRow.L], R: [...meta.homeRow.R] },
    fixedKeys: { ...meta.fixedKeys },
    symbolSlots: [...meta.symbolSlots],
    defaultLayerKeys: [...meta.defaultLayerKeys],
  };
  const hand: Hand = role.endsWith("L") ? "L" : "R";
  switch (role) {
    case "thumbL":
    case "thumbR": {
      const i = m.thumbKeys.findIndex((k) => k.pos === pos);
      if (i >= 0 && m.thumbKeys[i].hand === hand) m.thumbKeys.splice(i, 1);
      else if (i >= 0) m.thumbKeys[i] = { pos, hand };
      else m.thumbKeys.push({ pos, hand });
      m.thumbKeys.sort((a, b) => a.pos - b.pos);
      return m;
    }
    case "homeL":
    case "homeR": {
      const other: Hand = hand === "L" ? "R" : "L";
      m.homeRow[other] = without(m.homeRow[other], pos);
      m.homeRow[hand] = m.homeRow[hand].includes(pos)
        ? without(m.homeRow[hand], pos)
        : [...m.homeRow[hand], pos].sort((a, b) => a - b);
      return m;
    }
    case "symbol":
      m.symbolSlots = m.symbolSlots.includes(pos)
        ? without(m.symbolSlots, pos)
        : [...m.symbolSlots, pos].sort((a, b) => a - b);
      return m;
    case "layerL":
    case "layerR": {
      const i = m.defaultLayerKeys.findIndex((k) => k.pos === pos);
      if (i >= 0 && m.defaultLayerKeys[i].hand === hand)
        m.defaultLayerKeys.splice(i, 1);
      else if (i >= 0)
        m.defaultLayerKeys[i] = { ...m.defaultLayerKeys[i], hand };
      else m.defaultLayerKeys.push({ pos, layer: 1, hand });
      m.defaultLayerKeys.sort((a, b) => a.pos - b.pos);
      return m;
    }
    case "esc":
    case "tab":
    case "capslock":
      m.fixedKeys[role] = m.fixedKeys[role] === pos ? null : pos;
      return m;
  }
}

export function MetaEditor({ board, t }: { board: TestBoard; t: T }) {
  const [meta, setMeta] = useState<KeyboardMeta>(() => keyboardMeta(board));
  const [role, setRole] = useState<Role>("thumbL");
  const [copied, setCopied] = useState(false);

  const marks = useMemo(() => {
    const m = new Map<string, Mark>();
    const keys = board.keys;
    const tag = (pos: number, text: string, tone: Mark["tone"]) => {
      const k = keys[pos];
      if (!k) return;
      const prev = m.get(k.id);
      m.set(k.id, {
        tone,
        label: prev?.label ? `${prev.label}/${text}` : text,
      });
    };
    for (const th of meta.thumbKeys)
      tag(th.pos, ROLE_TAG[th.hand === "L" ? "thumbL" : "thumbR"], "hint");
    for (const p of meta.homeRow.L) tag(p, ROLE_TAG.homeL, "hold");
    for (const p of meta.homeRow.R) tag(p, ROLE_TAG.homeR, "hold");
    for (const p of meta.symbolSlots) tag(p, ROLE_TAG.symbol, "set");
    for (const lk of meta.defaultLayerKeys)
      tag(
        lk.pos,
        `${ROLE_TAG[lk.hand === "L" ? "layerL" : "layerR"]}${lk.layer}`,
        "wrong",
      );
    if (meta.fixedKeys.esc !== null) tag(meta.fixedKeys.esc, "Esc", "set");
    if (meta.fixedKeys.tab !== null) tag(meta.fixedKeys.tab, "Tab", "set");
    if (meta.fixedKeys.capslock !== null)
      tag(meta.fixedKeys.capslock, "Caps", "set");
    return m;
  }, [meta, board]);

  const { id, ...rest } = meta;
  const json = JSON.stringify({ [id]: rest }, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The text is in the box to select by hand.
    }
  };

  const onKeyClick = (pos: number) => setMeta((m) => toggle(m, role, pos));

  return (
    <div className="space-y-4">
      <Notice>
        {t(
          "Keyboard metadata for the setup guide. Pick a role, then click keys on the drawing to give or take it. Paste the JSON into src/practice/data/keyboards.json.",
        )}{" "}
        {hasStoredMeta(board.id)
          ? t("This keyboard has stored values.")
          : t("This keyboard is not in the file yet: these are estimates.")}
      </Notice>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("Size class")}
              </span>
              <select
                value={meta.sizeClass}
                onChange={(e) => {
                  const sizeClass = e.target.value as SizeClass;
                  setMeta((m) => ({
                    ...m,
                    sizeClass,
                    ...guidesFor(sizeClass),
                  }));
                }}
                className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]"
              >
                {SIZE_CLASSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "pad" ? t("Pad (no guide)") : `${s}%`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("Default guide")}
              </span>
              <select
                value={meta.defaultGuide ?? ""}
                onChange={(e) =>
                  setMeta((m) => ({
                    ...m,
                    defaultGuide: (e.target.value ||
                      null) as KeyboardMeta["defaultGuide"],
                  }))
                }
                className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]"
              >
                <option value="">{t("None")}</option>
                {(["30", "40", "60"] as const).map((g) => (
                  <option key={g} value={g}>
                    {g}%
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={meta.allowGuide.includes("30")}
                onChange={(e) =>
                  setMeta((m) => ({
                    ...m,
                    allowGuide: e.target.checked
                      ? ([
                          ...new Set(["30", ...m.allowGuide]),
                        ] as KeyboardMeta["allowGuide"])
                      : m.allowGuide.filter((g) => g !== "30"),
                  }))
                }
              />
              {t("Offer the 30% guide")}
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={meta.split}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, split: e.target.checked }))
                }
              />
              {t("Split keyboard")}
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={meta.reviewed}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, reviewed: e.target.checked }))
                }
              />
              {t("Reviewed")}
            </label>
          </div>

          <div>
            <h3 className="text-xs text-[var(--color-text-muted)]">
              {t("Role to give by clicking")}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ROLES.map(([r, label, color]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`h-8 rounded-full border px-3 text-xs transition-colors ${
                    role === r
                      ? "bg-[var(--color-surface-elevated)] text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  style={{
                    borderColor: role === r ? color : "var(--color-border)",
                  }}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          {meta.defaultLayerKeys.length > 0 && (
            <div>
              <h3 className="text-xs text-[var(--color-text-muted)]">
                {t("Layer keys")}
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {meta.defaultLayerKeys.map((lk, i) => (
                  <li key={lk.pos} className="flex items-center gap-2">
                    <span className="w-24 font-mono text-xs text-[var(--color-text-secondary)]">
                      #{lk.pos} {board.keys[lk.pos]?.label.main ?? ""}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t("layer")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={lk.layer}
                      onChange={(e) =>
                        setMeta((m) => {
                          const list = [...m.defaultLayerKeys];
                          list[i] = {
                            ...list[i],
                            layer: Number(e.target.value) || 1,
                          };
                          return { ...m, defaultLayerKeys: list };
                        })
                      }
                      className="h-7 w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {lk.hand}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMeta(estimateMeta(board))}
              className="btn-ghost h-9 border border-[var(--color-border)] flex items-center gap-2 text-sm"
            >
              <IconRefresh size={16} />
              {t("Estimate again")}
            </button>
            <button
              type="button"
              onClick={copy}
              className="btn-electric h-9 px-4 text-sm flex items-center gap-2"
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied ? t("Copied") : t("Copy JSON")}
            </button>
          </div>
          <textarea
            readOnly
            value={json}
            className="h-56 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 p-3 font-mono text-xs text-[var(--color-text)]"
          />
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-3">
          <div className="text-sm font-medium text-[var(--color-text)]">
            {board.name}
          </div>
          <PracticeBoard board={board} marks={marks} onKeyClick={onKeyClick} />
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(
              "T: thumb, H: home row, Sym: symbol slot, Ly: layer key (with its layer number); L / R is the hand.",
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
