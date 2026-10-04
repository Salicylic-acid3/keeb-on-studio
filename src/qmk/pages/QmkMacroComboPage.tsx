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
import type { UseVialKeyboard } from "../hooks/useVialKeyboard";

type RightView = "tapdance" | null;

export function QmkMacroComboPage({ keyboard }: { keyboard: UseVialKeyboard }) {
  const { t } = useLanguage();
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const tapDance = useVialTapDance(keyboard);
  const [rightView, setRightView] = useState<RightView>(null);
  const [selectedTapDance, setSelectedTapDance] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const counts = keyboard.info?.entryCounts;

  const behaviors = useMemo(
    () => qmkBehaviors({ tapDanceCount: counts?.tapDance ?? 0, macroCount: 0 }),
    [counts?.tapDance],
  );
  const layers = useMemo(
    () =>
      Array.from({ length: keyboard.info?.layerCount ?? 0 }, (_, id) => ({
        id,
        name: t("Layer {{id}}", { id }),
      })),
    [keyboard.info?.layerCount, t],
  );

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
                  "Clears every tap dance. Nothing is written until you Save.",
                ),
                onSelect: () => void tapDance.resetToDefault(),
                disabled: busy,
              }}
              discard={{
                description: t(
                  "Drops the edits not yet saved and goes back to what the keyboard holds.",
                ),
                onSelect: () => void tapDance.discard(),
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
              />
            )}
          </div>

          <div className="min-w-0">
            {rightView === "tapdance" && selectedTapDanceSlot ? (
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
