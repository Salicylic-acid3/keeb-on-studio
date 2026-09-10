/**
 * Tap dance, edited from the app.
 *
 * The firmware keeps each slot's taps as an array setting of behavior
 * bindings, which the generic Settings screen can *almost* edit: it renders
 * the elements an array already has, but has no way to add one. A slot starts
 * with no taps, so through that screen there is nothing to type into and no
 * control that would make a row. This is the screen that closes that gap.
 *
 * A tap is picked with the same KeycodeSelector the keymap uses. That matters
 * more than it sounds: a tap is a behavior plus two parameters, and offering
 * three raw numbers would be technically complete and practically unusable.
 * Reusing the real picker means "two taps sends Escape" is chosen the same
 * way "this key sends Escape" already is.
 *
 * Edits go to the keyboard's memory as they are made and are persisted by
 * Save, which is how every other custom setting behaves here.
 */
import { useCallback, useMemo, useState } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconMinus,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react";
import { KeycodeSelector } from "../KeycodeSelector";
import { useLanguage } from "../../hooks/useLanguage";
import { useCustomSettings } from "../../hooks/useCustomSettings";
import type {
  Setting,
  SettingScalarValue,
} from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import {
  TAP_DANCE_SUBSYSTEM_ID,
  groupIntoSlots,
  type TapDanceSlot,
} from "../../lib/tapDance/slots";
import type {
  BehaviorBinding,
  BehaviorDefinition,
} from "../../hooks/useKeymap";

/** The binding a tap currently holds, in the shape the picker speaks. */
function bindingOf(setting: Setting | undefined): BehaviorBinding | null {
  const behavior =
    setting?.value?.arrayValue?.value?.behaviorValue ??
    setting?.value?.behaviorValue;
  if (!behavior) return null;
  return {
    behaviorId: behavior.behaviorId ?? 0,
    param1: behavior.param1 ?? 0,
    param2: behavior.param2 ?? 0,
  };
}

export interface TapDanceSectionProps {
  behaviors: Map<number, BehaviorDefinition>;
  layers: Array<{ id: number; name: string }>;
  disabled?: boolean;
}

export function TapDanceSection({
  behaviors,
  layers,
  disabled = false,
}: TapDanceSectionProps) {
  const { t } = useLanguage();
  const settings = useCustomSettings({
    subsystemIdentifier: TAP_DANCE_SUBSYSTEM_ID,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{
    slot: number;
    tapIndex: number;
  } | null>(null);

  const section = settings.sections[0] ?? null;
  const slots = useMemo(
    () => groupIntoSlots(section?.settings ?? []),
    [section],
  );

  const behaviorName = useCallback(
    (binding: BehaviorBinding | null) =>
      binding ? (behaviors.get(binding.behaviorId)?.displayName ?? "") : "",
    [behaviors],
  );

  const setTap = useCallback(
    (slot: TapDanceSlot, tapIndex: number, binding: BehaviorBinding) => {
      const setting = slot.taps[tapIndex];
      if (!setting) return;
      void settings.writeSettingToMemory(setting, {
        arrayValue: {
          index: setting.value?.arrayValue?.index ?? tapIndex,
          size: slot.taps.length,
          value: {
            behaviorValue: {
              behaviorId: binding.behaviorId,
              param1: binding.param1,
              param2: binding.param2,
            },
          },
        },
      });
    },
    [settings],
  );

  const addTap = useCallback(
    (slot: TapDanceSlot) => {
      if (!slot.tapsSetting) return;
      // A new tap starts unbound rather than copying the previous one: an
      // extra tap that silently repeats the last one would be worse than an
      // obviously empty row.
      const empty: SettingScalarValue = {
        behaviorValue: { behaviorId: 0, param1: 0, param2: 0 },
      };
      void settings.pushBackArrayElement(slot.tapsSetting, empty);
    },
    [settings],
  );

  const removeTap = useCallback(
    (slot: TapDanceSlot) => {
      if (!slot.tapsSetting) return;
      void settings.popBackArrayElement(slot.tapsSetting);
    },
    [settings],
  );

  const setTerm = useCallback(
    (slot: TapDanceSlot, ms: number) => {
      if (!slot.term) return;
      void settings.writeSettingToMemory(slot.term, { int32Value: ms });
    },
    [settings],
  );

  if (!settings.isAvailable) {
    return null;
  }

  const editingSlot =
    editing !== null ? slots.find((s) => s.index === editing.slot) : undefined;

  return (
    <div className="glass-card p-6">
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-3 text-left cursor-pointer"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setOpen((v) => !v);
        }}
      >
        {open ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
        <div className="flex-1">
          <h3 className="text-base font-medium text-[var(--color-text)]">
            {t("Tap Dance")}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("What one tap, two taps and three taps each do")}
          </p>
        </div>
      </div>

      {open && (
        <div className="mt-4">
          {settings.error && (
            <p className="mb-3 text-sm text-[var(--color-warning)]">
              {settings.error}
            </p>
          )}

          <div className="flex items-center gap-2 mb-4">
            <button
              className="btn-ghost text-sm flex items-center gap-1.5"
              onClick={() => void settings.loadSettings()}
              disabled={settings.isLoading || disabled}
            >
              <IconRefresh size={16} />
              {t("Refresh")}
            </button>
            {section && (
              <>
                <button
                  className="btn-electric text-sm ml-auto"
                  onClick={() =>
                    void settings.saveSection(section.customSubsystemIndex)
                  }
                  disabled={disabled}
                >
                  {t("Save")}
                </button>
                <button
                  className="btn-ghost text-sm"
                  onClick={() =>
                    void settings.discardSection(section.customSubsystemIndex)
                  }
                  disabled={disabled}
                >
                  {t("Discard")}
                </button>
              </>
            )}
          </div>

          {slots.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {settings.isLoading
                ? t("Loading…")
                : t("This keyboard has no tap dance slots.")}
            </p>
          ) : (
            <div className="space-y-4">
              {slots.map((slot) => (
                <div
                  key={slot.index}
                  className="p-4 rounded-lg border border-[var(--color-border)]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {t("Tap dance {{index}}", { index: slot.index })}
                    </span>
                    {/* The keymap binding this slot answers to. Without it
                        there is no way to tell which dance you are editing. */}
                    <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)]">
                      &amp;rtd {slot.index}
                    </code>
                    {slot.term && (
                      <label className="ml-auto flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        {t("Wait between taps")}
                        <input
                          type="number"
                          min={50}
                          max={1000}
                          step={10}
                          className="input-field w-20 text-sm"
                          value={slot.term.value?.int32Value ?? 200}
                          disabled={disabled}
                          onChange={(event) =>
                            setTerm(slot, Number(event.target.value))
                          }
                        />
                        ms
                      </label>
                    )}
                  </div>

                  {slot.taps.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)] mb-3">
                      {t(
                        "No taps yet — this slot does nothing when pressed. Add one to start.",
                      )}
                    </p>
                  ) : (
                    <ul className="space-y-2 mb-3">
                      {slot.taps.map((tap, tapIndex) => {
                        const binding = bindingOf(tap);
                        const name = behaviorName(binding);
                        return (
                          <li
                            key={tap.value?.arrayValue?.index ?? tapIndex}
                            className="flex items-center gap-3"
                          >
                            <span className="w-16 text-xs text-[var(--color-text-muted)]">
                              {t("{{count}} taps", { count: tapIndex + 1 })}
                            </span>
                            <button
                              className="btn-ghost text-sm flex-1 text-left disabled:opacity-40"
                              disabled={disabled}
                              onClick={() =>
                                setEditing({ slot: slot.index, tapIndex })
                              }
                            >
                              {name || t("Not set — click to choose")}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-40"
                      onClick={() => addTap(slot)}
                      disabled={
                        disabled ||
                        (slot.maxTaps > 0 && slot.taps.length >= slot.maxTaps)
                      }
                    >
                      <IconPlus size={14} />
                      {t("Add a tap")}
                    </button>
                    <button
                      className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-40"
                      onClick={() => removeTap(slot)}
                      disabled={disabled || slot.taps.length === 0}
                    >
                      <IconMinus size={14} />
                      {t("Remove the last tap")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The same picker the keymap uses, so a tap is chosen exactly the way
          a key is. */}
      <KeycodeSelector
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSelect={(binding) => {
          if (editingSlot && editing) {
            setTap(editingSlot, editing.tapIndex, binding);
          }
          setEditing(null);
        }}
        currentBinding={
          editingSlot && editing
            ? bindingOf(editingSlot.taps[editing.tapIndex])
            : null
        }
        behaviors={behaviors}
        layers={layers}
      />
    </div>
  );
}
