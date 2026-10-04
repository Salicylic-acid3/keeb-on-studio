/**
 * Vial key overrides ("Shift + Backspace sends Delete"), in the same card
 * look as the combos. ZMK has no equivalent, so the fields follow Vial:
 * a trigger key with the modifiers that must be held, a replacement key,
 * the layers it applies on, and the finer switches folded away.
 */
import { useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import {
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { StatusDot } from "../../components/EditStatusIndicator";
import { useLanguage } from "../../hooks/useLanguage";
import { MODIFIER_FLAGS } from "../../lib/keycodes";
import type { VialKeyOverrideEntry } from "../lib/vial/protocol";
import { ALL_LAYERS, keyOverrideIsUsed, KO_OPTION } from "../lib/entries";
import { QmkKeyField } from "./qmkKeyField";
import { qmkKeyLabel, type QmkKeyContext } from "../lib/keyLabel";

function modsText(mask: number): string {
  return MODIFIER_FLAGS.filter((m) => mask & m.value)
    .map((m) => m.label)
    .join("+");
}

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs border transition-colors ${
    on
      ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border-[var(--color-electric)]/40"
      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
  }`;

function ModChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {MODIFIER_FLAGS.map((m) => (
        <button
          key={m.value}
          className={chip((value & m.value) !== 0)}
          onClick={() => onChange(value ^ m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

interface ListProps {
  overrides: VialKeyOverrideEntry[];
  saved: VialKeyOverrideEntry[];
  shown: Set<number>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onNew: () => void;
  ctx: QmkKeyContext;
}

export function QmkKeyOverrideListCard({
  overrides,
  saved,
  shown,
  selectedIndex,
  onSelect,
  onNew,
  ctx,
}: ListProps) {
  const { t } = useLanguage();
  const visible = overrides
    .map((o, index) => ({ o, index }))
    .filter(({ o, index }) => keyOverrideIsUsed(o) || shown.has(index));
  const full = overrides.every((o, i) => keyOverrideIsUsed(o) || shown.has(i));
  return (
    <section className="glass-card p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Key Overrides")}
        </h2>
        <button
          className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-electric)] disabled:opacity-40 transition-colors"
          onClick={onNew}
          disabled={full}
          title={t("New key override")}
        >
          <IconPlus size={15} />
        </button>
      </div>
      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
            {t("No key overrides configured")}
          </p>
        )}
        {visible.map(({ o, index }) => {
          const unsaved = JSON.stringify(o) !== JSON.stringify(saved[index]);
          const trigger = [modsText(o.triggerMods), qmkKeyLabel(o.trigger, ctx)]
            .filter(Boolean)
            .join("+");
          return (
            <button
              key={index}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedIndex === index
                  ? "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/40"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-electric)]/40"
              } ${o.options & KO_OPTION.enabled ? "" : "opacity-60"}`}
              onClick={() => onSelect(index)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-text)] truncate flex-1">
                  {t("Key Override {{index}}", { index })}
                </span>
                {unsaved && <StatusDot status="unsaved" />}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)] truncate">
                {trigger || "—"}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)] truncate">
                {qmkKeyLabel(o.replacement, ctx) || "—"}
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
  entry: VialKeyOverrideEntry;
  saved: VialKeyOverrideEntry | undefined;
  layerCount: number;
  onChange: (entry: VialKeyOverrideEntry) => void;
  onDelete: () => void;
  ctx: QmkKeyContext;
}

const ADVANCED_OPTIONS: Array<{ bit: number; label: string }> = [
  {
    bit: KO_OPTION.activationTriggerDown,
    label: "Activate when the trigger key is pressed",
  },
  {
    bit: KO_OPTION.activationRequiredModDown,
    label: "Activate when a required modifier is pressed",
  },
  {
    bit: KO_OPTION.activationNegativeModUp,
    label: "Activate when a negative modifier is released",
  },
  { bit: KO_OPTION.oneMod, label: "Any one of the modifiers is enough" },
  {
    bit: KO_OPTION.noReregisterTrigger,
    label: "Do not press the trigger again afterwards",
  },
  {
    bit: KO_OPTION.noUnregisterOnOtherKeyDown,
    label: "Keep the replacement held when another key is pressed",
  },
];

export function QmkKeyOverrideEditorCard({
  index,
  entry,
  saved,
  layerCount,
  onChange,
  onDelete,
  ctx,
}: EditorProps) {
  const { t } = useLanguage();
  const [advanced, setAdvanced] = useState(false);
  const unsaved = JSON.stringify(entry) !== JSON.stringify(saved);
  const enabled = (entry.options & KO_OPTION.enabled) !== 0;
  const layerIds = Array.from(
    { length: Math.min(16, layerCount) },
    (_, i) => i,
  );
  const allLayers = (entry.layers & ALL_LAYERS) === ALL_LAYERS;

  const setTriggerMods = (mods: number) =>
    onChange({
      ...entry,
      triggerMods: mods,
      // Until changed by hand, suppress exactly the modifiers that trigger it:
      // Shift + Backspace -> Delete should send Delete, not Shift + Delete.
      suppressedMods:
        entry.suppressedMods === entry.triggerMods
          ? mods
          : entry.suppressedMods,
    });

  return (
    <section className="glass-card p-4 tablet:p-6 min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {t("Key Override Editor")}
            </h2>
            {unsaved && <StatusDot status="unsaved" />}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("Key Override {{index}}", { index })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("Enabled")}
            </span>
            <Switch.Root
              checked={enabled}
              onCheckedChange={(on) =>
                onChange({
                  ...entry,
                  options: on
                    ? entry.options | KO_OPTION.enabled
                    : entry.options & ~KO_OPTION.enabled,
                })
              }
              aria-label={t("Enabled")}
              className="w-8 h-4 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors"
            >
              <Switch.Thumb className="block w-3 h-3 rounded-full transition-transform data-[state=checked]:translate-x-4 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
            </Switch.Root>
          </div>
          <button
            className="btn-ghost text-sm flex items-center gap-1.5"
            onClick={onDelete}
          >
            <IconTrash size={16} />
            {t("Delete")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3 mb-4">
        <QmkKeyField
          label={t("Trigger key")}
          code={entry.trigger}
          onChange={(code) => onChange({ ...entry, trigger: code })}
          ctx={ctx}
          modified={saved !== undefined && entry.trigger !== saved.trigger}
        />
        <QmkKeyField
          label={t("Replacement")}
          code={entry.replacement}
          onChange={(code) => onChange({ ...entry, replacement: code })}
          ctx={ctx}
          modified={
            saved !== undefined && entry.replacement !== saved.replacement
          }
        />
      </div>

      <div className="mb-4">
        <span className="block text-xs text-[var(--color-text-muted)] mb-2">
          {t("Modifiers held with the trigger key")}
        </span>
        <ModChips value={entry.triggerMods} onChange={setTriggerMods} />
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-xs text-[var(--color-text-muted)]">
            {t("Layers")}
          </span>
          <button
            className={chip(allLayers)}
            onClick={() => onChange({ ...entry, layers: ALL_LAYERS })}
          >
            {t("All")}
          </button>
          {layerIds.map((id) => (
            <button
              key={id}
              className={chip(!allLayers && (entry.layers & (1 << id)) !== 0)}
              onClick={() => {
                const base = allLayers ? 0 : entry.layers;
                const next = base ^ (1 << id);
                onChange({ ...entry, layers: next === 0 ? ALL_LAYERS : next });
              }}
            >
              {t("Layer {{id}}", { id })}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <button
          className="flex items-center gap-2 w-full px-3 py-2.5 text-left bg-[var(--color-bg)] hover:bg-[var(--color-border)]/50 transition-colors"
          onClick={() => setAdvanced(!advanced)}
        >
          <span className="text-xs font-medium text-[var(--color-text-muted)] flex-1">
            {t("Advanced Options")}
          </span>
          {advanced ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronRight size={14} />
          )}
        </button>
        {advanced && (
          <div className="p-3 space-y-4">
            <div>
              <span className="block text-xs text-[var(--color-text-muted)] mb-2">
                {t("Modifiers released before sending the replacement")}
              </span>
              <ModChips
                value={entry.suppressedMods}
                onChange={(v) => onChange({ ...entry, suppressedMods: v })}
              />
            </div>
            <div>
              <span className="block text-xs text-[var(--color-text-muted)] mb-2">
                {t("Modifiers that stop the override when held")}
              </span>
              <ModChips
                value={entry.negativeModMask}
                onChange={(v) => onChange({ ...entry, negativeModMask: v })}
              />
            </div>
            <div className="space-y-2">
              {ADVANCED_OPTIONS.map(({ bit, label }) => (
                <label
                  key={bit}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={(entry.options & bit) !== 0}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        options: e.target.checked
                          ? entry.options | bit
                          : entry.options & ~bit,
                      })
                    }
                  />
                  {t(label)}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
