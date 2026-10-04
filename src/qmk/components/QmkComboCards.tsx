/**
 * Vial combos, in the ZMK combo cards' look (components/macroCombo).
 *
 * A Vial combo is up to four keycodes pressed together and one keycode sent:
 * it matches keycodes, not key positions, so where the ZMK editor has a
 * keyboard to click positions on, this has four key fields that open the
 * usual key picker. Empty slots are hidden; "+" takes the first free one.
 */
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { StatusDot } from "../../components/EditStatusIndicator";
import { useLanguage } from "../../hooks/useLanguage";
import type { VialComboEntry } from "../lib/vial/protocol";
import { KC_NO } from "../lib/keycodes/qmkKeycode";
import { comboIsUsed } from "../lib/entries";
import { QmkKeyField } from "./qmkKeyField";
import { qmkKeyLabel, type QmkKeyContext } from "../lib/keyLabel";

interface ListProps {
  combos: VialComboEntry[];
  saved: VialComboEntry[];
  /** Slots shown although empty: just created with "+". */
  shown: Set<number>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onNew: () => void;
  ctx: QmkKeyContext;
}

export function QmkComboListCard({
  combos,
  saved,
  shown,
  selectedIndex,
  onSelect,
  onNew,
  ctx,
}: ListProps) {
  const { t } = useLanguage();
  const visible = combos
    .map((c, index) => ({ c, index }))
    .filter(({ c, index }) => comboIsUsed(c) || shown.has(index));
  const full = combos.every((c, i) => comboIsUsed(c) || shown.has(i));
  return (
    <section className="glass-card p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Combos")}
        </h2>
        <button
          className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-electric)] disabled:opacity-40 transition-colors"
          onClick={onNew}
          disabled={full}
          title={t("New combo")}
        >
          <IconPlus size={15} />
        </button>
      </div>
      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
            {t("No combos configured")}
          </p>
        )}
        {visible.map(({ c, index }) => {
          const keys = c.input
            .filter((k) => k !== KC_NO)
            .map((k) => qmkKeyLabel(k, ctx));
          const unsaved = JSON.stringify(c) !== JSON.stringify(saved[index]);
          return (
            <button
              key={index}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedIndex === index
                  ? "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/40"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-electric)]/40"
              }`}
              onClick={() => onSelect(index)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-text)] truncate flex-1">
                  {t("Combo {{index}}", { index })}
                </span>
                {unsaved && <StatusDot status="unsaved" />}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)] truncate">
                {keys.length ? keys.join(" + ") : "—"}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)] truncate">
                {qmkKeyLabel(c.output, ctx) || "—"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface EditorProps {
  index: number;
  combo: VialComboEntry;
  saved: VialComboEntry | undefined;
  onChange: (entry: VialComboEntry) => void;
  onDelete: () => void;
  ctx: QmkKeyContext;
}

export function QmkComboEditorCard({
  index,
  combo,
  saved,
  onChange,
  onDelete,
  ctx,
}: EditorProps) {
  const { t } = useLanguage();
  const unsaved = JSON.stringify(combo) !== JSON.stringify(saved);
  // Keys fill from the left; show the filled ones plus one empty to add to.
  const filled = combo.input.filter((k) => k !== KC_NO);
  const fields = Math.min(
    4,
    Math.max(2, filled.length + (filled.length < 4 ? 1 : 0)),
  );
  const setKey = (i: number, code: number) => {
    const keys = [...filled];
    keys[i] = code;
    const packed = keys.filter((k) => k !== KC_NO);
    while (packed.length < 4) packed.push(KC_NO);
    onChange({
      ...combo,
      input: packed.slice(0, 4) as VialComboEntry["input"],
    });
  };
  return (
    <section className="glass-card p-4 tablet:p-6 min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {t("Combo Editor")}
            </h2>
            {unsaved && <StatusDot status="unsaved" />}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("Combo {{index}}", { index })}
          </p>
        </div>
        <button
          className="btn-ghost text-sm flex items-center gap-1.5"
          onClick={onDelete}
        >
          <IconTrash size={16} />
          {t("Delete")}
        </button>
      </div>

      <div className="mb-4">
        <QmkKeyField
          label={t("Behavior")}
          code={combo.output}
          onChange={(code) => onChange({ ...combo, output: code })}
          ctx={ctx}
          modified={saved !== undefined && combo.output !== saved.output}
        />
      </div>

      <div className="mb-2">
        <span className="text-xs text-[var(--color-text-muted)]">
          {t("Keys pressed together")}
        </span>
      </div>
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2 mb-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <QmkKeyField
                label={t("Key {{n}}", { n: i + 1 })}
                code={filled[i] ?? KC_NO}
                onChange={(code) => setKey(i, code)}
                ctx={ctx}
              />
            </div>
            {filled[i] !== undefined && (
              <button
                className="mt-2 p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)]"
                onClick={() => setKey(i, KC_NO)}
                title={t("Remove")}
                aria-label={t("Remove")}
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "Up to four keys. A QMK combo matches what the keys send, not where they are.",
        )}
      </p>
    </section>
  );
}
