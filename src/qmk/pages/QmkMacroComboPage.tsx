/**
 * The QMK side's "Macro, Combo & Tap Dance" tab. Same layout and cards as
 * the ZMK page (pages/MacroComboPage.tsx): lists on the left, the selected
 * item's editor on the right, one action bar on top. Tap dances come first;
 * combos, key overrides and macros join the same columns.
 */
import { useCallback, useContext, useMemo, useState } from "react";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconRefresh,
  IconWand,
} from "@tabler/icons-react";
import { HexIcon } from "../../components/brand/HexIcon";
import { StatusDot } from "../../components/EditStatusIndicator";
import { ResetVersionMenu } from "../../components/versionHistory/ResetVersionMenu";
import { TapDanceListCard } from "../../components/tapDance/TapDanceListCard";
import { TapDanceEditorCard } from "../../components/tapDance/TapDanceEditorCard";
import { KeyboardLayoutContext } from "../../contexts/KeyboardLayoutContext";
import { useLanguage } from "../../hooks/useLanguage";
import type { TapDanceSlot } from "../../lib/tapDance/slots";
import { qmkBehaviors } from "../lib/zmkBridge";
import { useVialTapDance } from "../hooks/useVialTapDance";
import {
  QmkComboEditorCard,
  QmkComboListCard,
} from "../components/QmkComboCards";
import {
  QmkKeyOverrideEditorCard,
  QmkKeyOverrideListCard,
} from "../components/QmkKeyOverrideCards";
import type { QmkKeyContext } from "../lib/keyLabel";
import { QmkSettingsCard } from "../components/QmkSettingsCard";
import {
  QmkMacroEditorCard,
  QmkMacroListCard,
} from "../components/QmkMacroCards";
import {
  COMBO_SETTINGS,
  readField,
  supportedFields,
  TAP_HOLD_SETTINGS,
  type QmkSettingField,
} from "../lib/qmkSettings";
import { IconSettings } from "@tabler/icons-react";
import {
  comboIsUsed,
  EMPTY_COMBO,
  EMPTY_KEY_OVERRIDE,
  keyOverrideIsUsed,
  NEW_KEY_OVERRIDE,
} from "../lib/entries";
import type { UseVialKeyboard } from "../hooks/useVialKeyboard";

type RightView =
  | "macro"
  | "tapdance"
  | "combo"
  | "keyoverride"
  | "combo-settings"
  | "tap-hold-settings"
  | null;

export function QmkMacroComboPage({ keyboard }: { keyboard: UseVialKeyboard }) {
  const { t } = useLanguage();
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const tapDance = useVialTapDance(keyboard);
  const [rightView, setRightView] = useState<RightView>(null);
  const [selectedTapDance, setSelectedTapDance] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCombo, setSelectedCombo] = useState<number | null>(null);
  const [selectedMacro, setSelectedMacro] = useState<number | null>(null);
  const [shownMacros, setShownMacros] = useState<Set<number>>(new Set());
  const [selectedOverride, setSelectedOverride] = useState<number | null>(null);
  // Slots created with "+" and still empty, so they stay in the list.
  const [shownCombos, setShownCombos] = useState<Set<number>>(new Set());
  const [shownOverrides, setShownOverrides] = useState<Set<number>>(new Set());
  const counts = keyboard.info?.entryCounts;

  const behaviors = useMemo(
    () =>
      qmkBehaviors({
        tapDanceCount: counts?.tapDance ?? 0,
        macroCount: keyboard.macros.length,
      }),
    [counts?.tapDance, keyboard.macros.length],
  );
  const layers = useMemo(
    () =>
      Array.from({ length: keyboard.info?.layerCount ?? 0 }, (_, id) => ({
        id,
        name: t("Layer {{id}}", { id }),
      })),
    [keyboard.info?.layerCount, t],
  );

  const ctx: QmkKeyContext = {
    behaviors,
    layers,
    keyboardLayout: keyboardLayoutContext.layout,
  };

  const comboSettings = supportedFields(COMBO_SETTINGS, keyboard.qmkSettingIds);
  const tapHoldSettings = supportedFields(
    TAP_HOLD_SETTINGS,
    keyboard.qmkSettingIds,
  );
  const settingsModified = (fields: QmkSettingField[]) =>
    fields.some(
      (f) =>
        readField(f, keyboard.qmkSettings) !==
        readField(f, keyboard.savedQmkSettings),
    );

  const forgetShown = () => {
    setShownMacros(new Set());
    setShownCombos(new Set());
    setShownOverrides(new Set());
  };
  const newMacro = () => {
    const index = keyboard.macros.findIndex(
      (m, i) => m.length === 0 && !shownMacros.has(i),
    );
    if (index < 0) return;
    setShownMacros(new Set(shownMacros).add(index));
    setSelectedMacro(index);
    setRightView("macro");
  };
  const deleteMacro = (index: number) => {
    keyboard.setMacro(index, []);
    const next = new Set(shownMacros);
    next.delete(index);
    setShownMacros(next);
    setRightView(null);
  };
  const newCombo = () => {
    const index = keyboard.combos.findIndex(
      (c, i) => !comboIsUsed(c) && !shownCombos.has(i),
    );
    if (index < 0) return;
    setShownCombos(new Set(shownCombos).add(index));
    setSelectedCombo(index);
    setRightView("combo");
  };
  const deleteCombo = (index: number) => {
    keyboard.setCombo(index, EMPTY_COMBO);
    const next = new Set(shownCombos);
    next.delete(index);
    setShownCombos(next);
    setRightView(null);
  };
  const newOverride = () => {
    const index = keyboard.keyOverrides.findIndex(
      (o, i) => !keyOverrideIsUsed(o) && !shownOverrides.has(i),
    );
    if (index < 0) return;
    keyboard.setKeyOverride(index, NEW_KEY_OVERRIDE);
    setShownOverrides(new Set(shownOverrides).add(index));
    setSelectedOverride(index);
    setRightView("keyoverride");
  };
  const deleteOverride = (index: number) => {
    keyboard.setKeyOverride(index, EMPTY_KEY_OVERRIDE);
    const next = new Set(shownOverrides);
    next.delete(index);
    setShownOverrides(next);
    setRightView(null);
  };

  const selectedTapDanceSlot = useMemo(
    () =>
      selectedTapDance === null
        ? undefined
        : tapDance.slots.find((slot) => slot.index === selectedTapDance),
    [selectedTapDance, tapDance.slots],
  );

  const handleSelectTapDance = useCallback((slot: TapDanceSlot) => {
    setSelectedTapDance(slot.index);
    setRightView("tapdance");
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      forgetShown();
      await tapDance.refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [tapDance]);

  if (!keyboard.info) return null;
  const busy = isRefreshing || keyboard.isSaving;

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <HexIcon>
              <IconWand size={24} className="text-[var(--color-electric)]" />
            </HexIcon>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("Macro, Combo & Tap Dance")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("Edit runtime macro, combo and tap dance slots")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              className="btn-ghost text-sm flex items-center gap-1.5"
              onClick={() => void handleRefresh()}
              disabled={busy}
            >
              <IconRefresh
                size={16}
                className={isRefreshing ? "animate-spin" : undefined}
              />
              {t("Refresh")}
            </button>
            {keyboard.hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-neon)] mr-2">
                <StatusDot status="unsaved" />
                {t("Unsaved changes")}
              </span>
            )}
            <ResetVersionMenu
              versions={[]}
              onSelectVersion={() => undefined}
              disabled={busy}
              resetToDefault={{
                description: t(
                  "Clears every combo, key override and tap dance. Nothing is written until you Save.",
                ),
                onSelect: () => {
                  keyboard.combos.forEach((_, i) =>
                    keyboard.setCombo(i, EMPTY_COMBO),
                  );
                  keyboard.keyOverrides.forEach((_, i) =>
                    keyboard.setKeyOverride(i, EMPTY_KEY_OVERRIDE),
                  );
                  forgetShown();
                  void tapDance.resetToDefault();
                },
                disabled: busy,
              }}
              discard={{
                description: t(
                  "Drops the edits not yet saved and goes back to what the keyboard holds.",
                ),
                onSelect: () => {
                  forgetShown();
                  void tapDance.discard();
                },
                disabled: busy || !keyboard.hasUnsavedChanges,
              }}
            />
            <button
              className="btn-electric text-sm flex items-center gap-1.5"
              onClick={() => void keyboard.saveChanges()}
              disabled={busy || !keyboard.hasUnsavedChanges}
            >
              {keyboard.isSaving ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconDeviceFloppy size={16} />
              )}
              {t("Save")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 desktop:grid-cols-[300px_1fr] gap-4 min-w-0">
          <div className="space-y-4">
            {keyboard.macros.length > 0 && (
              <QmkMacroListCard
                macros={keyboard.macros}
                saved={keyboard.savedMacros}
                shown={shownMacros}
                selectedIndex={rightView === "macro" ? selectedMacro : null}
                onSelect={(index) => {
                  setSelectedMacro(index);
                  setRightView("macro");
                }}
                onNew={newMacro}
              />
            )}
            {keyboard.combos.length > 0 && (
              <QmkComboListCard
                combos={keyboard.combos}
                saved={keyboard.savedCombos}
                shown={shownCombos}
                selectedIndex={rightView === "combo" ? selectedCombo : null}
                onSelect={(index) => {
                  setSelectedCombo(index);
                  setRightView("combo");
                }}
                onNew={newCombo}
                ctx={ctx}
                onSettings={
                  comboSettings.length
                    ? () => setRightView("combo-settings")
                    : undefined
                }
                settingsModified={settingsModified(comboSettings)}
              />
            )}
            {keyboard.keyOverrides.length > 0 && (
              <QmkKeyOverrideListCard
                overrides={keyboard.keyOverrides}
                saved={keyboard.savedKeyOverrides}
                shown={shownOverrides}
                selectedIndex={
                  rightView === "keyoverride" ? selectedOverride : null
                }
                onSelect={(index) => {
                  setSelectedOverride(index);
                  setRightView("keyoverride");
                }}
                onNew={newOverride}
                ctx={ctx}
              />
            )}
            {tapDance.isAvailable && (
              <TapDanceListCard
                tapDance={tapDance}
                behaviors={behaviors}
                layers={layers}
                keyboardLayout={keyboardLayoutContext.layout}
                selectedIndex={
                  rightView === "tapdance" ? selectedTapDance : null
                }
                onSelect={handleSelectTapDance}
                headerActions={
                  tapHoldSettings.length > 0 && (
                    <button
                      className="relative p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-electric)] transition-colors"
                      onClick={() => setRightView("tap-hold-settings")}
                      title={t("Tap-Hold Settings")}
                      aria-label={t("Tap-Hold Settings")}
                    >
                      <IconSettings size={15} />
                      {settingsModified(tapHoldSettings) && (
                        <StatusDot
                          status="unsaved"
                          className="absolute -top-0.5 -right-0.5"
                        />
                      )}
                    </button>
                  )
                }
              />
            )}
          </div>

          <div className="min-w-0">
            {rightView === "macro" &&
            selectedMacro !== null &&
            keyboard.macros[selectedMacro] ? (
              <QmkMacroEditorCard
                index={selectedMacro}
                steps={keyboard.macros[selectedMacro]}
                saved={keyboard.savedMacros[selectedMacro]}
                allMacros={keyboard.macros}
                bufferSize={keyboard.macroBufferSize}
                onChange={(steps) => keyboard.setMacro(selectedMacro, steps)}
                onDelete={() => deleteMacro(selectedMacro)}
                ctx={ctx}
              />
            ) : rightView === "combo-settings" ||
              rightView === "tap-hold-settings" ? (
              <QmkSettingsCard
                title={
                  rightView === "combo-settings"
                    ? "Combo Global Settings"
                    : "Tap-Hold Settings"
                }
                fields={
                  rightView === "combo-settings"
                    ? comboSettings
                    : tapHoldSettings
                }
                values={keyboard.qmkSettings}
                saved={keyboard.savedQmkSettings}
                onChange={keyboard.setQmkSetting}
              />
            ) : rightView === "combo" &&
              selectedCombo !== null &&
              keyboard.combos[selectedCombo] ? (
              <QmkComboEditorCard
                index={selectedCombo}
                combo={keyboard.combos[selectedCombo]}
                saved={keyboard.savedCombos[selectedCombo]}
                onChange={(entry) => keyboard.setCombo(selectedCombo, entry)}
                onDelete={() => deleteCombo(selectedCombo)}
                ctx={ctx}
              />
            ) : rightView === "keyoverride" &&
              selectedOverride !== null &&
              keyboard.keyOverrides[selectedOverride] ? (
              <QmkKeyOverrideEditorCard
                index={selectedOverride}
                entry={keyboard.keyOverrides[selectedOverride]}
                saved={keyboard.savedKeyOverrides[selectedOverride]}
                layerCount={keyboard.info.layerCount}
                onChange={(entry) =>
                  keyboard.setKeyOverride(selectedOverride, entry)
                }
                onDelete={() => deleteOverride(selectedOverride)}
                ctx={ctx}
              />
            ) : rightView === "tapdance" && selectedTapDanceSlot ? (
              <TapDanceEditorCard
                tapDance={tapDance}
                slot={selectedTapDanceSlot}
                behaviors={behaviors}
                layers={layers}
                keyboardLayout={keyboardLayoutContext.layout}
              />
            ) : (
              <section className="glass-card p-6 flex items-center justify-center min-h-[320px] text-center">
                <div>
                  <IconWand
                    size={32}
                    className="mx-auto mb-3 text-[var(--color-electric)]"
                  />
                  <h2 className="text-sm font-medium text-[var(--color-text)]">
                    {t("Select a macro, combo or tap dance")}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {t("Choose an item from the lists on the left.")}
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
