/**
 * Vial dynamic macros, in the ZMK side's macro list and editor look
 * (pages/MacroComboPage.tsx, components/macroCombo/MacroEditorCard.tsx):
 * the same five step kinds (tap, down, up, delay, string), one row each.
 * Vial macros have no names and share one buffer, so the size shown is
 * the shared buffer's.
 */
import { useState } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { KeycodeSelector } from "../../components/KeycodeSelector";
import { StatusDot } from "../../components/EditStatusIndicator";
import { useLanguage } from "../../hooks/useLanguage";
import {
  bindingToKeycode,
  keycodeToBinding,
  QmkBridgeError,
} from "../lib/zmkBridge";
import { isTypeable, macroBytesUsed, type MacroStep } from "../lib/macro";
import { qmkKeyLabel, type QmkKeyContext } from "../lib/keyLabel";

type Action = MacroStep["action"];

interface ListProps {
  macros: MacroStep[][];
  saved: MacroStep[][];
  shown: Set<number>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onNew: () => void;
}

export function QmkMacroListCard({
  macros,
  saved,
  shown,
  selectedIndex,
  onSelect,
  onNew,
}: ListProps) {
  const { t } = useLanguage();
  const visible = macros
    .map((m, index) => ({ m, index }))
    .filter(({ m, index }) => m.length > 0 || shown.has(index));
  const full = macros.every((m, i) => m.length > 0 || shown.has(i));
  return (
    <section className="glass-card p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Macros")}
        </h2>
        <button
          className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-electric)] disabled:opacity-40 transition-colors"
          onClick={onNew}
          disabled={full}
          title={t("Create macro")}
        >
          <IconPlus size={15} />
        </button>
      </div>
      <div className="space-y-1">
        {visible.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
            {t("No macros yet. Create one above.")}
          </p>
        )}
        {visible.map(({ m, index }) => (
          <button
            key={index}
            className={`w-full px-3 py-2 rounded-lg text-left transition-colors ${
              selectedIndex === index
                ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]/30"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
            }`}
            onClick={() => onSelect(index)}
          >
            <div className="flex items-center gap-1.5">
              <span className="block text-sm font-medium truncate flex-1">
                {t("Macro {{slot}}", { slot: index })}
              </span>
              {JSON.stringify(m) !== JSON.stringify(saved[index]) && (
                <StatusDot status="unsaved" />
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

interface EditorProps {
  index: number;
  steps: MacroStep[];
  saved: MacroStep[] | undefined;
  allMacros: MacroStep[][];
  bufferSize: number;
  onChange: (steps: MacroStep[]) => void;
  onDelete: () => void;
  ctx: QmkKeyContext;
}

function blank(action: Action): MacroStep {
  if (action === "delay") return { action, ms: 100 };
  if (action === "string") return { action, text: "" };
  return { action, keycode: 0 };
}

export function QmkMacroEditorCard({
  index,
  steps,
  saved,
  allMacros,
  bufferSize,
  onChange,
  onDelete,
  ctx,
}: EditorProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const used = macroBytesUsed(allMacros);
  const over = used > bufferSize;
  const unsaved = JSON.stringify(steps) !== JSON.stringify(saved);
  const replace = (i: number, step: MacroStep) =>
    onChange(steps.map((s, j) => (j === i ? step : s)));
  const editingStep = editing === null ? null : steps[editing];

  return (
    <div className="glass-card p-4 min-w-0">
      <div className="flex flex-col tablet:flex-row tablet:items-end gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] mb-1">
            {t("Name")}
            {unsaved && <StatusDot status="unsaved" />}
          </label>
          <div className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]">
            {t("Macro {{slot}}", { slot: index })}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            {t("Size")}
          </label>
          <div
            className={`px-3 py-2 rounded-lg border text-sm ${
              over
                ? "border-red-500/40 bg-red-500/10 text-red-400"
                : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
            }`}
            title={t("All macros share this memory")}
          >
            {used}/{bufferSize}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Steps")}
        </h2>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-sm flex items-center gap-1.5 text-red-400"
            onClick={onDelete}
          >
            <IconTrash size={16} />
            {t("Delete")}
          </button>
          <button
            className="btn-electric text-sm flex items-center gap-1.5"
            onClick={() => onChange([...steps, blank("tap")])}
          >
            <IconPlus size={16} />
            {t("Step")}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-[var(--color-warning)]">{t(error)}</p>
      )}

      {steps.length === 0 ? (
        <div className="p-6 text-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("No steps in this macro")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className="grid grid-cols-1 tablet:grid-cols-[64px_128px_1fr_40px] gap-2 items-center p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]"
            >
              <div className="text-xs font-mono text-[var(--color-text-muted)]">
                #{i + 1}
              </div>
              <select
                className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                value={step.action}
                onChange={(e) => {
                  const action = e.target.value as Action;
                  // Keep the key when switching between tap, down and up.
                  replace(
                    i,
                    "keycode" in step &&
                      action !== "delay" &&
                      action !== "string"
                      ? { action, keycode: step.keycode }
                      : blank(action),
                  );
                }}
              >
                <option value="tap">{t("Tap")}</option>
                <option value="down">{t("Down")}</option>
                <option value="up">{t("Up")}</option>
                <option value="delay">{t("Delay")}</option>
                <option value="string">{t("String")}</option>
              </select>

              {step.action === "delay" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={65000}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                    value={step.ms}
                    onChange={(e) =>
                      replace(i, {
                        action: "delay",
                        ms: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("ms")}
                  </span>
                </div>
              ) : step.action === "string" ? (
                <div>
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                    value={step.text}
                    onChange={(e) =>
                      replace(i, { action: "string", text: e.target.value })
                    }
                  />
                  {!isTypeable(step.text) && (
                    <p className="mt-1 text-xs text-[var(--color-warning)]">
                      {t(
                        "Only letters, numbers and symbols on a US keyboard can be typed",
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-left text-sm text-[var(--color-text-secondary)] transition-colors"
                  onClick={() => setEditing(i)}
                >
                  {qmkKeyLabel(step.keycode, ctx) || t("Not set")}
                </button>
              )}

              <button
                className="p-2 rounded-lg hover:bg-[var(--color-border)]"
                onClick={() => onChange(steps.filter((_, j) => j !== i))}
                aria-label={t("Remove step {{n}}", { n: i + 1 })}
              >
                <IconTrash
                  size={16}
                  className="text-[var(--color-text-muted)]"
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <KeycodeSelector
        open={editingStep !== null && "keycode" in editingStep}
        onClose={() => setEditing(null)}
        onSelect={(binding) => {
          if (editing === null || !editingStep || !("keycode" in editingStep))
            return;
          try {
            replace(editing, {
              action: editingStep.action,
              keycode: bindingToKeycode(binding),
            });
            setError(null);
            setEditing(null);
          } catch (err) {
            setError(err instanceof QmkBridgeError ? err.message : String(err));
          }
        }}
        currentBinding={
          editingStep && "keycode" in editingStep && editingStep.keycode
            ? keycodeToBinding(editingStep.keycode)
            : null
        }
        behaviors={ctx.behaviors}
        layers={ctx.layers}
        keyboardLayout={ctx.keyboardLayout}
      />
    </div>
  );
}
