/**
 * The layout editor: draw a keyboard's physical layout, give every key a
 * legend and a matrix position, and take it out as Keyboard Layout Editor,
 * VIA or Vial data. Works without a keyboard connected.
 *
 * So far: read KLE data, show it on a canvas that pans and zooms on mouse
 * and touch, add, move, stretch, copy, mirror and delete keys with undo,
 * switch between legends and matrix positions, and write KLE data back.
 * Rotation and typing the legends come next.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconDownload,
  IconFile,
  IconFileImport,
  IconFileExport,
  IconSquarePlus,
  IconSquaresSelected,
  IconUpload,
} from "@tabler/icons-react";
import { StandaloneFrame } from "../components/StandaloneFrame";
import { useLanguage } from "../hooks/useLanguage";
import { KeyPanel } from "../layoutEditor/components/KeyPanel";
import { LayoutCanvas } from "../layoutEditor/components/LayoutCanvas";
import { useHistory } from "../layoutEditor/hooks/useHistory";
import {
  addKey,
  copyKeys,
  deleteKeys,
  duplicateKeys,
  mirrorKeys,
  moveKeys,
  offsetBelow,
  pasteClip,
  resizeKeys,
  SNAP_STEPS,
  templateProject,
  type Added,
  type Clip,
  type TemplateId,
} from "../layoutEditor/lib/edit";
import {
  exportKle,
  importKle,
  kleToRawData,
  parseKleText,
} from "../layoutEditor/lib/kle";
import type { LayoutLayer, LayoutProject } from "../layoutEditor/lib/model";
import { sampleProject } from "../layoutEditor/lib/sample";
import { loadStoredProject, storeProject } from "../layoutEditor/lib/storage";

export const LAYOUT_PATH = "/layout";

const DIALOG_OVERLAY = "fixed inset-0 bg-black/50 backdrop-blur-sm z-50";
const DIALOG_CONTENT =
  "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl max-h-[88dvh] overflow-auto bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-5";
const TEXTAREA =
  "w-full h-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-xs font-mono p-3 resize-y focus:outline-none focus:border-[var(--color-electric)]";
const BUTTON =
  "btn-ghost border border-[var(--color-border)] flex items-center justify-center gap-2 text-sm min-h-11";

function LayerToggle({
  layer,
  onChange,
}: {
  layer: LayoutLayer;
  onChange: (layer: LayoutLayer) => void;
}) {
  const { t } = useLanguage();
  const options: Array<{ id: LayoutLayer; label: string }> = [
    { id: "legend", label: t("Legends") },
    { id: "matrix", label: t("Matrix") },
  ];
  return (
    <div
      role="group"
      aria-label={t("Which text the keys show")}
      className="flex rounded-lg border border-[var(--color-border)] overflow-hidden"
    >
      {options.map((o) => {
        const active = o.id === layer;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`px-3 sm:px-4 min-h-11 text-sm whitespace-nowrap transition-colors ${
              active
                ? "bg-[var(--color-electric)] text-white"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (project: LayoutProject) => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (source: string) => {
    try {
      const project = importKle(parseKleText(source));
      if (project.keys.length === 0) throw new Error("no keys");
      setText("");
      setFailed(false);
      onImport(project);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setFailed(false);
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={DIALOG_OVERLAY} />
        <Dialog.Content className={DIALOG_CONTENT}>
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] mb-2">
            {t("Import a layout")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-3">
            {t(
              "Paste Keyboard Layout Editor data (the downloaded JSON or the Raw data box), a VIA definition or a vial.json. It replaces the layout on screen.",
            )}
          </Dialog.Description>
          <textarea
            className={TEXTAREA}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFailed(false);
            }}
            aria-label={t("Layout data")}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          {failed && (
            <p
              role="alert"
              className="text-sm text-[var(--color-warning)] mt-2"
            >
              {t("This could not be read as Keyboard Layout Editor data.")}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) load(await file.text());
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
            <button
              type="button"
              className={BUTTON}
              onClick={() => fileRef.current?.click()}
            >
              <IconUpload size={18} />
              {t("Choose a file")}
            </button>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <button type="button" className={BUTTON}>
                  {t("Cancel")}
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="btn-electric min-h-11 text-sm"
                disabled={!text.trim()}
                onClick={() => load(text)}
              >
                {t("Load")}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ExportFormat = "json" | "raw";

function ExportDialog({
  open,
  onClose,
  project,
  layer,
}: {
  open: boolean;
  onClose: () => void;
  project: LayoutProject;
  layer: LayoutLayer;
}) {
  const { t } = useLanguage();
  const [format, setFormat] = useState<ExportFormat>("json");
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    if (!open) return "";
    const doc = exportKle(project, layer);
    return format === "raw" ? kleToRawData(doc) : JSON.stringify(doc);
  }, [open, project, layer, format]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard access: the text is in the box to select by hand.
    }
  };

  const download = () => {
    const name = (project.name || "layout").replace(/[^\w.-]+/g, "_");
    const blob = new Blob([text], {
      type: format === "raw" ? "text/plain" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${layer}.${format === "raw" ? "txt" : "json"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formats: Array<{ id: ExportFormat; label: string }> = [
    { id: "json", label: t("KLE JSON") },
    { id: "raw", label: t("KLE Raw data") },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={DIALOG_OVERLAY} />
        <Dialog.Content className={DIALOG_CONTENT}>
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] mb-2">
            {t("Export the layout")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-3">
            {layer === "matrix"
              ? t(
                  "The keys carry their matrix positions, as on screen now. This is what goes into layouts.keymap of a VIA definition or a vial.json.",
                )
              : t("The keys carry their legends, as on screen now.")}
          </Dialog.Description>
          <div className="flex gap-2 mb-3">
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.id === format}
                onClick={() => setFormat(f.id)}
                className={`px-3 min-h-11 rounded-lg border text-sm ${
                  f.id === format
                    ? "border-[var(--color-electric)] text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <textarea
            className={TEXTAREA}
            value={text}
            readOnly
            aria-label={t("Layout data")}
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-wrap justify-end gap-2 mt-4">
            <button type="button" className={BUTTON} onClick={copy}>
              {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
              {copied ? t("Copied") : t("Copy")}
            </button>
            <button type="button" className={BUTTON} onClick={download}>
              <IconDownload size={18} />
              {t("Download")}
            </button>
            <Dialog.Close asChild>
              <button type="button" className={BUTTON}>
                {t("Close")}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TemplateDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (project: LayoutProject) => void;
}) {
  const { t } = useLanguage();
  const templates: Array<{ id: TemplateId | "sample"; label: string }> = [
    { id: "empty", label: t("Empty") },
    { id: "ortho40", label: t("40% ortholinear (4 x 12)") },
    { id: "ansi60", label: t("60% ANSI") },
    { id: "split36", label: t("Split, 3 x 6 and three thumb keys") },
    { id: "sample", label: t("Sample with turned thumb keys") },
  ];
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={DIALOG_OVERLAY} />
        <Dialog.Content className={DIALOG_CONTENT}>
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] mb-2">
            {t("New layout")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-3">
            {t(
              "Pick what to start from. It replaces the layout on screen; Undo brings the old one back.",
            )}
          </Dialog.Description>
          <div className="flex flex-col gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={`${BUTTON} justify-start`}
                onClick={() =>
                  onPick(
                    tpl.id === "sample"
                      ? sampleProject()
                      : templateProject(tpl.id),
                  )
                }
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Dialog.Close asChild>
              <button type="button" className={BUTTON}>
                {t("Cancel")}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

const ICON_BUTTON =
  "btn-ghost border border-[var(--color-border)] flex items-center justify-center gap-2 text-sm min-h-11 min-w-11 !px-2.5 disabled:opacity-40 disabled:pointer-events-none";

export function LayoutEditorPage({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const history = useHistory<LayoutProject>(
    () => loadStoredProject() ?? sampleProject(),
  );
  const project = history.value;
  const { commit, undo, redo } = history;
  const [layer, setLayer] = useState<LayoutLayer>("legend");
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [snap, setSnap] = useState<number | null>(SNAP_STEPS[0]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [fitToken, setFitToken] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const clipboard = useRef<{ clip: Clip; pastes: number } | null>(null);

  useEffect(() => {
    storeProject(project);
  }, [project]);

  const selectedKeys = useMemo(
    () => project.keys.filter((k) => selection.has(k.id)),
    [project, selection],
  );
  const selectedIds = useMemo(
    () => selectedKeys.map((k) => k.id),
    [selectedKeys],
  );
  // Buttons move by the grid step; with the grid off, by its finest step.
  const step = snap ?? SNAP_STEPS[SNAP_STEPS.length - 1];

  const commitAdded = useCallback(
    (added: Added) => {
      if (added.ids.length === 0) return;
      commit(added.project);
      setSelection(new Set(added.ids));
    },
    [commit],
  );

  const replaceProject = (next: LayoutProject) => {
    commit(next);
    setSelection(new Set());
    setMultiSelect(false);
    setFitToken((n) => n + 1);
    // A layout that arrives with matrix positions and no legends is a VIA /
    // Vial one: show what it has.
    const hasLegends = next.keys.some((k) => k.legends.some(Boolean));
    const hasMatrix = next.keys.some((k) => k.matrix);
    if (hasMatrix && !hasLegends) setLayer("matrix");
    if (hasLegends && !hasMatrix) setLayer("legend");
  };

  const addOne = useCallback(() => {
    commitAdded(
      addKey(project, selectedIds.length === 1 ? selectedIds[0] : null),
    );
  }, [commitAdded, project, selectedIds]);
  const duplicate = useCallback(() => {
    commitAdded(duplicateKeys(project, selectedIds));
  }, [commitAdded, project, selectedIds]);
  const mirror = useCallback(() => {
    commitAdded(mirrorKeys(project, selectedIds));
  }, [commitAdded, project, selectedIds]);
  const remove = useCallback(() => {
    if (selectedIds.length === 0) return;
    commit(deleteKeys(project, selectedIds));
    setSelection(new Set());
  }, [commit, project, selectedIds]);
  const nudge = useCallback(
    (dx: number, dy: number) => {
      commit(moveKeys(project, selectedIds, dx, dy));
    },
    [commit, project, selectedIds],
  );
  const copy = useCallback(() => {
    if (selectedIds.length === 0) return;
    clipboard.current = { clip: copyKeys(project, selectedIds), pastes: 0 };
  }, [project, selectedIds]);
  const paste = useCallback(() => {
    const held = clipboard.current;
    if (!held) return;
    held.pastes += 1;
    commitAdded(
      pasteClip(
        project,
        held.clip,
        0,
        offsetBelow(held.clip.keys) * held.pastes,
      ),
    );
  }, [commitAdded, project]);

  const dialogOpen = importOpen || exportOpen || templateOpen;
  useEffect(() => {
    if (dialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        redo();
      } else if (mod && key === "c") {
        copy();
      } else if (mod && key === "v") {
        e.preventDefault();
        paste();
      } else if (mod && key === "d") {
        e.preventDefault();
        duplicate();
      } else if (mod && key === "a") {
        e.preventDefault();
        setSelection(new Set(project.keys.map((k) => k.id)));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      } else if (e.key === "Escape") {
        setSelection(new Set());
        setMultiSelect(false);
      } else if (e.key.startsWith("Arrow") && selectedIds.length > 0) {
        e.preventDefault();
        const d = e.shiftKey ? 1 : step;
        if (e.key === "ArrowLeft") nudge(-d, 0);
        if (e.key === "ArrowRight") nudge(d, 0);
        if (e.key === "ArrowUp") nudge(0, -d);
        if (e.key === "ArrowDown") nudge(0, d);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    dialogOpen,
    undo,
    redo,
    copy,
    paste,
    duplicate,
    remove,
    nudge,
    project,
    selectedIds,
    step,
  ]);

  const empty = project.keys.length === 0;
  const renderPanel = (hideCount: boolean) => (
    <KeyPanel
      hideCount={hideCount}
      keys={selectedKeys}
      step={step}
      onResize={(size) => commit(resizeKeys(project, selectedIds, size))}
      onNudge={nudge}
      onAddNext={addOne}
      onDuplicate={duplicate}
      onMirror={mirror}
      onDelete={remove}
    />
  );
  const BAR =
    "flex-shrink-0 flex items-center gap-2 px-3 py-2 border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm";

  return (
    <StandaloneFrame onBack={onBack} fill>
      <div className="h-full flex flex-col">
        <div
          className={`${BAR} order-4 sm:order-1 border-t sm:border-t-0 sm:border-b pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2`}
        >
          <h1 className="hidden md:block text-sm font-medium text-[var(--color-text)] mr-2">
            {t("Layout Editor")}
          </h1>
          <LayerToggle layer={layer} onChange={setLayer} />
          <span className="hidden sm:inline text-xs text-[var(--color-text-muted)] ml-1">
            {t("{{count}} keys", { count: project.keys.length })}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            className={BUTTON}
            onClick={() => setImportOpen(true)}
            aria-label={t("Import")}
          >
            <IconFileImport size={18} />
            <span className="hidden sm:inline">{t("Import")}</span>
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => setExportOpen(true)}
            disabled={empty}
            aria-label={t("Export")}
          >
            <IconFileExport size={18} />
            <span className="hidden sm:inline">{t("Export")}</span>
          </button>
        </div>

        <div
          className={`${BAR} order-3 sm:order-2 border-t sm:border-t-0 sm:border-b overflow-x-auto`}
        >
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={undo}
            disabled={!history.canUndo}
            aria-label={t("Undo")}
            title={t("Undo")}
          >
            <IconArrowBackUp size={18} />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={redo}
            disabled={!history.canRedo}
            aria-label={t("Redo")}
            title={t("Redo")}
          >
            <IconArrowForwardUp size={18} />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={addOne}
            aria-label={t("Add a key")}
            title={t("Add a key")}
          >
            <IconSquarePlus size={18} />
            <span className="hidden sm:inline whitespace-nowrap">
              {t("Add a key")}
            </span>
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={() => setTemplateOpen(true)}
            aria-label={t("New layout")}
            title={t("New layout")}
          >
            <IconFile size={18} />
            <span className="hidden sm:inline whitespace-nowrap">
              {t("New layout")}
            </span>
          </button>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap ml-1">
            <span className="hidden sm:inline">{t("Grid")}</span>
            <select
              aria-label={t("Grid")}
              value={snap === null ? "off" : String(snap)}
              onChange={(e) =>
                setSnap(
                  e.target.value === "off" ? null : Number(e.target.value),
                )
              }
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-2 tabular-nums"
            >
              {SNAP_STEPS.map((s) => (
                <option key={s} value={s}>
                  {s}u
                </option>
              ))}
              <option value="off">{t("Off")}</option>
            </select>
          </label>
          <button
            type="button"
            className={`${ICON_BUTTON} pointer-fine:hidden ${
              multiSelect
                ? "!border-[var(--color-electric)] !text-[var(--color-text)]"
                : ""
            }`}
            onClick={() => setMultiSelect((on) => !on)}
            aria-pressed={multiSelect}
            aria-label={t("Select several")}
            title={t("Select several")}
          >
            <IconSquaresSelected size={18} />
          </button>
        </div>

        <div className="order-1 sm:order-3 flex-1 min-h-0 flex">
          <div className="relative flex-1 min-w-0">
            <LayoutCanvas
              project={project}
              layer={layer}
              selection={selection}
              onSelectionChange={setSelection}
              onMoveKeys={(ids, dx, dy) =>
                commit(moveKeys(project, ids, dx, dy))
              }
              onResizeKey={(id, w) => commit(resizeKeys(project, [id], { w }))}
              snapStep={snap}
              multiSelect={multiSelect}
              onLongPressKey={(id) => {
                setMultiSelect(true);
                setSelection((cur) => new Set([...cur, id]));
              }}
              fitToken={fitToken}
            />
            {empty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center pointer-events-none">
                <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
                  {t(
                    "No keys yet. Add a key, start from a template, or import Keyboard Layout Editor data.",
                  )}
                </p>
                <button
                  type="button"
                  className={`${BUTTON} pointer-events-auto`}
                  onClick={() => setTemplateOpen(true)}
                >
                  {t("New layout")}
                </button>
              </div>
            )}
          </div>
          <aside className="hidden lg:block w-80 flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 overflow-y-auto">
            {renderPanel(false)}
          </aside>
        </div>

        {selectedKeys.length > 0 && (
          <div className="order-2 sm:order-4 lg:hidden flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
            <button
              type="button"
              className="w-full min-h-11 px-3 flex items-center justify-between text-sm text-[var(--color-text-secondary)]"
              onClick={() => setSheetOpen((o) => !o)}
              aria-expanded={sheetOpen}
            >
              <span>
                {selectedKeys.length === 1
                  ? t("1 key selected")
                  : t("{{count}} keys selected", {
                      count: selectedKeys.length,
                    })}
              </span>
              {sheetOpen ? (
                <IconChevronDown size={18} />
              ) : (
                <IconChevronUp size={18} />
              )}
            </button>
            {sheetOpen && (
              <div className="max-h-[38dvh] overflow-y-auto px-3 pb-3">
                {renderPanel(true)}
              </div>
            )}
          </div>
        )}
      </div>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(next) => {
          replaceProject(next);
          setImportOpen(false);
        }}
      />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        project={project}
        layer={layer}
      />
      <TemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onPick={(next) => {
          replaceProject(next);
          setTemplateOpen(false);
        }}
      />
    </StandaloneFrame>
  );
}
