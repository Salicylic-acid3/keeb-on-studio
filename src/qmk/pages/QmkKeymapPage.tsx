/**
 * The QMK keymap page. Same chrome, board, picker and bottom keyboard as the
 * ZMK keymap page: the QMK keymap is shown to those components through the
 * ZMK-shaped model in lib/zmkBridge.ts, so a key looks and edits the same
 * on both sides. What differs is only what sits above the board: layers are
 * grouped into OS blocks, with a copy between blocks.
 */
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCopy,
  IconDeviceFloppy,
  IconInfoCircle,
  IconKeyboard,
  IconLoader2,
  IconRefresh,
  IconMouse,
} from "@tabler/icons-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Dialog from "@radix-ui/react-dialog";
import { HexIcon } from "../../components/brand/HexIcon";
import { StatusDot } from "../../components/EditStatusIndicator";
import { KeyboardLayout } from "../../components/KeyboardLayout";
import { KeycodeSelector } from "../../components/KeycodeSelector";
import { QuickAssignBar } from "../../components/keymap/QuickAssignBar";
import { KeyboardLayoutContext } from "../../contexts/KeyboardLayoutContext";
import { useLanguage } from "../../hooks/useLanguage";
import type {
  BehaviorBinding,
  Layer,
  PhysicalLayout,
} from "../../hooks/useKeymap";
import {
  getAvailableLayouts,
  getLayoutLabel,
  type KeyboardLayoutType,
} from "../../lib/keyboardLayouts";
import { keyPressParam, nextKeyPosition } from "../../lib/keymap/quickAssign";
import { extractBaseKeycode } from "../../lib/keycodes";
import {
  layerGroups,
  groupTitle,
  relayerKeycode,
  type LayerGroup,
} from "../lib/osBlocks";
import {
  bindingToKeycode,
  keycodeToBinding,
  qmkBehaviors,
  QmkBridgeError,
  QMK_BEHAVIOR,
} from "../lib/zmkBridge";
import type { UseVialKeyboard } from "../hooks/useVialKeyboard";
import type { VialKey } from "../lib/vial/kle";
import { QmkSettingsCard } from "../components/QmkSettingsCard";
import {
  MOUSE_KEY_SETTINGS,
  readField,
  supportedFields,
} from "../lib/qmkSettings";

interface QmkKeymapPageProps {
  keyboard: UseVialKeyboard;
}

const tooltipClass =
  "px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50";

export function QmkKeymapPage({ keyboard }: QmkKeymapPageProps) {
  const { t } = useLanguage();
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const { info, keymap, saved, os, visible } = keyboard;

  const groups = useMemo(
    () => (info ? layerGroups(info.definition, info.layerCount, os) : []),
    [info, os],
  );
  const [groupIndex, setGroupIndex] = useState(0);
  const [layerId, setLayerId] = useState(0);
  const [selectedKeyPosition, setSelectedKeyPosition] = useState<number | null>(
    null,
  );
  const [showKeycodeSelector, setShowKeycodeSelector] = useState(false);
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [quickAssignFinished, setQuickAssignFinished] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<LayerGroup | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [mouseSettingsOpen, setMouseSettingsOpen] = useState(false);
  const mouseSettings = supportedFields(
    MOUSE_KEY_SETTINGS,
    keyboard.qmkSettingIds,
  );
  const mouseSettingsModified = mouseSettings.some(
    (f) =>
      readField(f, keyboard.qmkSettings) !==
      readField(f, keyboard.savedQmkSettings),
  );

  const group: LayerGroup | undefined = groups[groupIndex];

  // Follow the keyboard: when the firmware switches blocks (a different OS,
  // or a preview), open that block.
  useEffect(() => {
    if (!os || !groups.length) return;
    const active = groups.findIndex((g) => g.block === os.activeBlock);
    if (active >= 0 && active !== groupIndex) {
      setGroupIndex(active);
      setLayerId(groups[active].layers[0] ?? 0);
      setSelectedKeyPosition(null);
    }
  }, [os?.activeBlock]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (group && !group.layers.includes(layerId))
      setLayerId(group.layers[0] ?? 0);
  }, [group, layerId]);

  // ---- The ZMK-shaped view of this keyboard ------------------------------

  // Tap dances are picked from the same key picker as on the ZMK side.
  const tapDanceCount = info?.entryCounts.tapDance ?? 0;
  const macroCount = keyboard.macros.length;
  const behaviors = useMemo(
    () => qmkBehaviors({ tapDanceCount, macroCount }),
    [tapDanceCount, macroCount],
  );

  const physicalLayout = useMemo<PhysicalLayout>(
    () => ({
      name: info?.definition.name ?? "",
      keys: visible.map((k) => ({
        width: k.width,
        height: k.height,
        x: k.x,
        y: k.y,
        r: k.r,
        rx: k.rx,
        ry: k.ry,
      })),
    }),
    [info, visible],
  );

  const layerName = useCallback(
    (id: number, index: number) =>
      index === 0 && groups.length > 1 ? t("Base") : t("Layer {{id}}", { id }),
    [groups.length, t],
  );

  const toLayer = useCallback(
    (map: number[][][], id: number, index: number): Layer => ({
      id,
      name: layerName(id, index),
      bindings: visible.map((k: VialKey) =>
        keycodeToBinding(map[id]?.[k.row]?.[k.col] ?? 0),
      ),
    }),
    [visible, layerName],
  );

  const layers = useMemo<Layer[]>(
    () =>
      keymap && group
        ? group.layers.map((id, i) => toLayer(keymap, id, i))
        : [],
    [keymap, group, toLayer],
  );
  const currentLayer = layers.find((l) => l.id === layerId) ?? null;

  const positionKey = useCallback(
    (position: number) => visible[position],
    [visible],
  );

  const isBindingModified = useCallback(
    (id: number, position: number) => {
      const k = positionKey(position);
      if (!k || !keymap || !saved) return false;
      return keymap[id]?.[k.row]?.[k.col] !== saved[id]?.[k.row]?.[k.col];
    },
    [keymap, saved, positionKey],
  );
  const getOriginalBinding = useCallback(
    (id: number, position: number): BehaviorBinding | null => {
      const k = positionKey(position);
      const code = k && saved ? saved[id]?.[k.row]?.[k.col] : undefined;
      return code === undefined ? null : keycodeToBinding(code);
    },
    [saved, positionKey],
  );

  // ---- Editing -------------------------------------------------------------

  const assign = useCallback(
    (position: number, binding: BehaviorBinding): boolean => {
      const k = positionKey(position);
      if (!k) return false;
      try {
        keyboard.setKeycode(layerId, k.row, k.col, bindingToKeycode(binding));
        setBridgeError(null);
        return true;
      } catch (err) {
        setBridgeError(
          err instanceof QmkBridgeError ? err.message : String(err),
        );
        return false;
      }
    },
    [keyboard, layerId, positionKey],
  );

  const handleKeyClick = useCallback(
    (position: number) => {
      setSelectedKeyPosition(position);
      setQuickAssignFinished(false);
      if (!quickAssignOpen) setShowKeycodeSelector(true);
    },
    [quickAssignOpen],
  );

  const handleKeyReset = useCallback(
    (position: number) => {
      const k = positionKey(position);
      if (k) keyboard.resetKey(layerId, k.row, k.col);
    },
    [keyboard, layerId, positionKey],
  );

  const handleBindingSelect = useCallback(
    (binding: BehaviorBinding) => {
      if (selectedKeyPosition === null) return;
      if (assign(selectedKeyPosition, binding)) {
        setShowKeycodeSelector(false);
        setSelectedKeyPosition(null);
      }
    },
    [assign, selectedKeyPosition],
  );

  const layoutPositions = useMemo(() => visible.map((_, i) => i), [visible]);
  const handleQuickAssign = useCallback(
    (code: number) => {
      if (selectedKeyPosition === null) return;
      const ok = assign(selectedKeyPosition, {
        behaviorId: QMK_BEHAVIOR.keyPress,
        param1: keyPressParam(code),
        param2: 0,
      });
      if (ok) {
        const next = nextKeyPosition(layoutPositions, selectedKeyPosition);
        setSelectedKeyPosition(next);
        setQuickAssignFinished(next === null);
      }
    },
    [assign, selectedKeyPosition, layoutPositions],
  );

  const copyBlock = useCallback(() => {
    if (!group || !copyTarget || !keymap) return;
    for (
      let i = 0;
      i < group.layers.length && i < copyTarget.layers.length;
      i++
    ) {
      const src = keymap[group.layers[i]];
      const dst = copyTarget.layers[i];
      src.forEach((row, r) =>
        row.forEach((code, c) =>
          keyboard.setKeycode(
            dst,
            r,
            c,
            relayerKeycode(code, group, copyTarget),
          ),
        ),
      );
    }
    setCopyDialogOpen(false);
  }, [group, copyTarget, keymap, keyboard]);

  const handleReload = useCallback(async () => {
    setIsReloading(true);
    try {
      await keyboard.reload();
    } finally {
      setIsReloading(false);
    }
  }, [keyboard]);

  const currentBinding =
    currentLayer && selectedKeyPosition !== null
      ? currentLayer.bindings[selectedKeyPosition]
      : null;
  const quickAssignSelectedCode =
    currentBinding?.behaviorId === QMK_BEHAVIOR.keyPress
      ? extractBaseKeycode(currentBinding.param1)
      : 0;

  if (!info || !keymap || !group) return null;

  const isActiveGroup = os ? group.block === os.activeBlock : true;
  const otherGroups = groups.filter((g) => g !== group);

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <HexIcon>
              <IconKeyboard
                size={24}
                className="text-[var(--color-electric)]"
              />
            </HexIcon>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("Keymap")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("Configure key bindings and layers")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {mouseSettings.length > 0 && (
              <button
                onClick={() => setMouseSettingsOpen(true)}
                className="relative btn-ghost text-sm flex items-center gap-1.5 flex-shrink-0"
                title={t("Mouse key speed")}
              >
                <IconMouse size={16} />
                {t("Mouse keys")}
                {mouseSettingsModified && (
                  <StatusDot
                    status="unsaved"
                    className="absolute -top-0.5 -right-0.5"
                  />
                )}
              </button>
            )}
            <button
              onClick={handleReload}
              disabled={isReloading || keyboard.isSaving}
              className="btn-ghost text-sm flex items-center gap-1.5 flex-shrink-0"
              title={t("Reload the keymap from the keyboard")}
            >
              <IconRefresh
                size={16}
                className={isReloading ? "animate-spin" : undefined}
              />
              {t("Reload")}
            </button>
            {keyboard.hasUnsavedChanges && (
              <button
                onClick={keyboard.discardChanges}
                disabled={keyboard.isSaving}
                className="btn-ghost text-sm flex-shrink-0"
              >
                {t("Discard")}
              </button>
            )}
            <button
              onClick={() => keyboard.saveChanges()}
              disabled={!keyboard.hasUnsavedChanges || keyboard.isSaving}
              className="btn-electric text-sm flex items-center gap-1.5"
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

        {bridgeError && (
          <div className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">{t(bridgeError)}</p>
            <button
              className="ml-auto text-xs text-red-300 hover:text-red-200"
              onClick={() => setBridgeError(null)}
            >
              {t("Dismiss")}
            </button>
          </div>
        )}

        {/* OS blocks */}
        {groups.length > 1 && (
          <div
            className="flex gap-2 overflow-x-auto pb-2 mb-2"
            role="group"
            aria-label={t("OS blocks")}
          >
            {groups.map((g, i) => {
              const active = os?.activeBlock === g.block;
              return (
                <button
                  key={g.id}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    i === groupIndex
                      ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]/30"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                  onClick={() => {
                    setGroupIndex(i);
                    setLayerId(g.layers[0] ?? 0);
                    setSelectedKeyPosition(null);
                  }}
                  aria-pressed={i === groupIndex}
                  title={t("Block {{id}}: layers {{layers}}", {
                    id: g.id,
                    layers: g.layers.join(", "),
                  })}
                >
                  {groupTitle(g, t)}
                  {active && (
                    <span
                      className="w-2 h-2 rounded-full bg-[var(--color-neon)]"
                      title={t("The keyboard is using this block now")}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Layer tabs + actions */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div
            className="flex gap-2 flex-1 overflow-x-auto pb-2 basis-full sm:basis-auto"
            role="group"
            aria-label={t("Keymap layers")}
          >
            {layers.map((layer) => (
              <button
                key={layer.id}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  layer.id === layerId
                    ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]/30"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                }`}
                onClick={() => {
                  setLayerId(layer.id);
                  setSelectedKeyPosition(null);
                }}
                aria-pressed={layer.id === layerId}
              >
                {layer.name}
              </button>
            ))}
          </div>
          {otherGroups.length > 0 && (
            <Tooltip.Provider delayDuration={200}>
              <div className="flex items-center gap-1 border-l border-[var(--color-border)] pl-2 ml-auto">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => {
                        setCopyTarget(otherGroups[0]);
                        setCopyDialogOpen(true);
                      }}
                      aria-label={t("Copy this block to another")}
                    >
                      <IconCopy
                        size={16}
                        className="text-[var(--color-text-muted)]"
                      />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className={tooltipClass} sideOffset={5}>
                      {t("Copy this block to another")}
                      <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            </Tooltip.Provider>
          )}
        </div>

        {/* Layout selectors */}
        <div className="relative flex items-center gap-2 justify-between flex-wrap mb-4">
          {info.definition.layoutLabels.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("Physical Layout")}:
              </span>
              {info.definition.layoutLabels.map((label, index) => (
                <LayoutOptionSelect
                  key={index}
                  index={index}
                  label={label}
                  labels={info.definition.layoutLabels}
                  value={keyboard.layoutOptions}
                  onChange={(v) => keyboard.setLayoutOptions(v)}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <label
              htmlFor="qmk-os-layout"
              className="text-xs text-[var(--color-text-muted)]"
            >
              {t("OS Layout")}:
            </label>
            <select
              id="qmk-os-layout"
              value={keyboardLayoutContext.layout}
              onChange={(e) =>
                keyboardLayoutContext.setLayout(
                  e.target.value as KeyboardLayoutType,
                )
              }
              className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
            >
              {getAvailableLayouts().map((layoutType) => (
                <option key={layoutType} value={layoutType}>
                  {getLayoutLabel(layoutType)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Keyboard */}
        {currentLayer && (
          <div className="glass-card p-8 relative">
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 text-xs"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  keyboard.hasUnsavedChanges
                    ? "bg-[var(--color-neon)]"
                    : "bg-[var(--color-text-muted)]"
                }`}
              />
              <span
                className={
                  keyboard.hasUnsavedChanges
                    ? "text-[var(--color-neon)]"
                    : "text-[var(--color-text-muted)]"
                }
              >
                {keyboard.hasUnsavedChanges ? t("Unsaved changes") : t("Saved")}
              </span>
            </div>
            {!isActiveGroup && (
              <p className="mb-3 text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
                <IconInfoCircle size={14} />
                {t(
                  "This block is not the one the keyboard is using right now.",
                )}
              </p>
            )}
            <KeyboardLayout
              layout={physicalLayout}
              layer={currentLayer}
              layers={layers}
              behaviors={behaviors}
              selectedKey={selectedKeyPosition}
              onKeyClick={handleKeyClick}
              onKeyReset={handleKeyReset}
              isBindingModified={isBindingModified}
              getOriginalBinding={getOriginalBinding}
              keyboardLayout={keyboardLayoutContext.layout}
              ariaLabel={t("Keyboard layout for {{layer}}", {
                layer: currentLayer.name,
              })}
            />
            <QuickAssignBar
              open={quickAssignOpen}
              onOpenChange={(next) => {
                setQuickAssignOpen(next);
                if (next) setQuickAssignFinished(false);
              }}
              targetLabel={
                selectedKeyPosition === null
                  ? null
                  : t("Key {{position}}", { position: selectedKeyPosition + 1 })
              }
              selectedCode={quickAssignSelectedCode}
              onAssign={handleQuickAssign}
              keyboardLayout={keyboardLayoutContext.layout}
              finished={quickAssignFinished}
            />
          </div>
        )}

        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(
              "Click on a key to modify its binding. Modified keys are highlighted in green and show the original binding on hover. Use the Discard button to drop unsaved changes.",
            )}
          </p>
        </div>
      </div>

      <KeycodeSelector
        open={showKeycodeSelector}
        onClose={() => {
          setShowKeycodeSelector(false);
          setSelectedKeyPosition(null);
        }}
        onSelect={handleBindingSelect}
        currentBinding={currentBinding}
        behaviors={behaviors}
        layers={layers.map((l) => ({ id: l.id, name: l.name }))}
        keyboardLayout={keyboardLayoutContext.layout}
      />

      {/* Mouse key settings: QMK Settings, saved with the keymap */}
      <Dialog.Root open={mouseSettingsOpen} onOpenChange={setMouseSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md max-h-[85vh] overflow-y-auto z-50 rounded-xl shadow-2xl">
            <Dialog.Title className="sr-only">
              {t("Mouse Key Settings")}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {t("Mouse key speed")}
            </Dialog.Description>
            <QmkSettingsCard
              title="Mouse Key Settings"
              fields={mouseSettings}
              values={keyboard.qmkSettings}
              saved={keyboard.savedQmkSettings}
              onChange={keyboard.setQmkSetting}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Copy block dialog */}
      <Dialog.Root open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
            <Dialog.Title className="text-base font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <IconAlertTriangle
                size={20}
                className="text-[var(--color-warning)]"
              />
              {t("Copy {{source}} onto another block?", {
                source: groupTitle(group, t),
              })}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-4">
              {t(
                "Every layer of the target block is replaced. Layer keys are renumbered for the target block (MO(1) becomes MO(5)). Nothing is written until you Save.",
              )}
            </Dialog.Description>
            <div className="flex flex-col gap-2 mb-5">
              {otherGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setCopyTarget(g)}
                  className={`px-4 py-2 rounded-lg text-sm text-left border transition-colors ${
                    copyTarget === g
                      ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border-[var(--color-electric)]/30"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                >
                  {groupTitle(g, t)}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 btn-ghost border border-[var(--color-border)]"
                onClick={() => setCopyDialogOpen(false)}
              >
                {t("Cancel")}
              </button>
              <button
                className="flex-1 btn-electric"
                onClick={copyBlock}
                disabled={!copyTarget}
              >
                {t("Copy")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/** One Vial layout option: a checkbox or a select, packed into the 32-bit value. */
function LayoutOptionSelect({
  index,
  label,
  labels,
  value,
  onChange,
}: {
  index: number;
  label: { name: string; choices: string[] };
  labels: Array<{ choices: string[] }>;
  value: number;
  onChange: (value: number) => void;
}) {
  const widths = labels.map((l) =>
    l.choices.length === 0
      ? 1
      : l.choices.length === 1
        ? 0
        : (l.choices.length - 1).toString(2).length,
  );
  let shift = 0;
  for (let i = labels.length - 1; i > index; i--) shift += widths[i];
  const width = widths[index];
  const mask = ((1 << width) - 1) << shift;
  const current = (value & mask) >>> shift;
  const set = (choice: number) =>
    onChange(((value & ~mask) | (choice << shift)) >>> 0);
  if (label.choices.length === 0) {
    return (
      <label className="flex items-center gap-1 text-sm text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={current === 1}
          onChange={(e) => set(e.target.checked ? 1 : 0)}
        />
        {label.name}
      </label>
    );
  }
  return (
    <select
      aria-label={label.name}
      value={current}
      onChange={(e) => set(Number(e.target.value))}
      className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
    >
      {label.choices.map((choice, i) => (
        <option key={i} value={i}>
          {label.name}: {choice}
        </option>
      ))}
    </select>
  );
}
