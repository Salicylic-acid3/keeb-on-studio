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
  IconBrandX,
  IconDownload,
  IconPhoto,
  IconShare,
  IconFile,
  IconFileImport,
  IconFileExport,
  IconHelp,
  IconLayoutGrid,
  IconKeyboard,
  IconSquarePlus,
  IconSquaresSelected,
  IconWall,
  IconUpload,
} from "@tabler/icons-react";
import { StandaloneFrame } from "../components/StandaloneFrame";
import { useLanguage } from "../hooks/useLanguage";
import { CapTray } from "../layoutEditor/components/CapTray";
import { EntryPanel } from "../layoutEditor/components/EntryPanel";
import { HelpDialog } from "../layoutEditor/components/HelpDialog";
import { GalleryDialog } from "../layoutEditor/components/GalleryDialog";
import { FitPanel } from "../layoutEditor/components/FitPanel";
import { KeyPanel } from "../layoutEditor/components/KeyPanel";
import { LayoutCanvas } from "../layoutEditor/components/LayoutCanvas";
import { useHistory } from "../layoutEditor/hooks/useHistory";
import {
  addKey,
  copyKeys,
  defaultPivot,
  deleteKeys,
  duplicateKeys,
  fillLegends,
  keyAfterDelete,
  makeIsoEnter,
  mirrorKeys,
  moveKeys,
  offsetBelow,
  pasteClip,
  resizeKeys,
  rotateKeys,
  setConvex,
  setLegendSlot,
  setMainAndSub,
  setMatrix,
  SNAP_STEPS,
  templateProject,
  type Added,
  type Clip,
  type TemplateId,
} from "../layoutEditor/lib/edit";
import {
  capFitsKey,
  compareSets,
  defaultRows,
  fitCaps,
  poolOf,
  type KitChoice,
} from "../layoutEditor/lib/fit";
import { capArt } from "../layoutEditor/lib/capArt";
import { EMPTY_CAP_SETUP, type CapSetup } from "../layoutEditor/lib/capSetup";
import { fetchLayout, linkedLayoutId } from "../layoutEditor/lib/galleryClient";
import { layoutPng } from "../layoutEditor/lib/picture";
import {
  keyboardProject,
  keyboardTemplates,
} from "../layoutEditor/lib/keyboards";
import type { FitMark } from "../layoutEditor/lib/fitMark";
import { kitById, kitsFor, type SwitchType } from "../layoutEditor/lib/kits";
import {
  findOverlaps,
  limitRotation,
  separationFor,
  touchingCorners,
} from "../layoutEditor/lib/geometry";
import {
  labelForCode,
  rowPreset,
  type LabelLayout,
} from "../layoutEditor/lib/keyLabels";
import {
  matrixRows,
  matrixStats,
  readingRows,
  splitAt,
  stepInRows,
  suggestMatrix,
  type SplitNumbering,
} from "../layoutEditor/lib/order";
import type {
  LayoutLayer,
  LayoutProject,
  Point,
} from "../layoutEditor/lib/model";
import {
  exportText,
  readCapSetupText,
  readLayoutText,
  type ExportFormat,
} from "../layoutEditor/lib/project";
import { sampleProject } from "../layoutEditor/lib/sample";
import {
  loadStoredCaps,
  loadStoredProject,
  storeCaps,
  storeProject,
} from "../layoutEditor/lib/storage";

export const LAYOUT_PATH = "/layout";

const DIALOG_OVERLAY = "fixed inset-0 bg-black/50 backdrop-blur-sm z-50";
/** Where the editor lives, for the line under a picture and for posts. */
const SHARE_URL = "https://keeb-on.studio/layout";
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
    { id: "both", label: t("Both") },
  ];
  return (
    <div
      role="group"
      aria-label={t("Which text the keys show")}
      className="flex flex-shrink-0 rounded-lg border border-[var(--color-border)] overflow-hidden"
    >
      {options.map((o) => {
        const active = o.id === layer;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`px-2.5 sm:px-4 min-h-11 text-sm whitespace-nowrap transition-colors ${
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
  onImport: (project: LayoutProject, caps: CapSetup | null) => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (source: string) => {
    try {
      const project = readLayoutText(source);
      if (project.keys.length === 0) throw new Error("no keys");
      setText("");
      setFailed(false);
      onImport(project, readCapSetupText(source));
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
              "Paste Keyboard Layout Editor data (the downloaded JSON or the Raw data box), a VIA definition, a vial.json, or a project file saved here. It replaces the layout on screen.",
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
              {t("This could not be read as layout data.")}
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

function ExportDialog({
  open,
  onClose,
  project,
  layer,
  caps,
  marks,
  stats,
  onRename,
}: {
  open: boolean;
  onClose: () => void;
  project: LayoutProject;
  layer: LayoutLayer;
  /** What was chosen in the keycap check; goes into the project file. */
  caps: CapSetup;
  /** The keycap check's verdicts when it is on: the picture shows the caps. */
  marks: ReadonlyMap<string, FitMark> | null;
  stats: { rows: number; cols: number; missing: number; duplicates: number };
  onRename: (name: string) => void;
}) {
  const { t } = useLanguage();
  const [format, setFormat] = useState<ExportFormat>("kle-json");
  const [copied, setCopied] = useState(false);

  const out = useMemo(
    () => (open ? exportText(project, format, layer, caps) : null),
    [open, project, format, layer, caps],
  );
  const text = out?.text ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard access: the text is in the box to select by hand.
    }
  };

  const saveBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    // In the page while it is clicked, and the URL kept a moment longer:
    // some browsers drop the file name or the download otherwise.
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const download = () => {
    if (out) saveBlob(new Blob([out.text], { type: out.mime }), out.fileName);
  };

  // The picture: what is on screen now, to save or to post.
  const [pictureFailed, setPictureFailed] = useState(false);
  const pictureName = `${(project.name.trim() || "layout").replace(/[^\p{L}\p{N}._-]+/gu, "_")}.png`;
  const makePicture = async () => {
    setPictureFailed(false);
    const blob = await layoutPng(project, {
      layer,
      marks,
      credit: `Keeb-On! Studio  ${SHARE_URL.replace("https://", "")}`,
    }).catch(() => null);
    if (!blob) setPictureFailed(true);
    return blob;
  };
  const savePicture = async () => {
    const blob = await makePicture();
    if (blob) saveBlob(blob, pictureName);
  };
  const shareText = project.name.trim()
    ? `${project.name.trim()} #KeebOnStudio`
    : "#KeebOnStudio";
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";
  const sharePicture = async () => {
    const blob = await makePicture();
    if (!blob) return;
    const file = new File([blob], pictureName, { type: "image/png" });
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
        return;
      }
    } catch {
      // Dismissed, or sharing a file is not allowed here: save it instead.
      return;
    }
    saveBlob(blob, pictureName);
  };
  const postOnX = async () => {
    // X takes no picture through a link: save it, then open the post box.
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(SHARE_URL)}`,
      "_blank",
      "noopener",
    );
    await savePicture();
  };

  const formats: Array<{ id: ExportFormat; label: string }> = [
    { id: "kle-json", label: t("KLE JSON") },
    { id: "kle-raw", label: t("KLE Raw data") },
    { id: "via", label: "VIA" },
    { id: "vial", label: "Vial" },
    { id: "project", label: t("Project file") },
  ];
  const forFirmware = format === "via" || format === "vial";
  const carriesMatrix =
    forFirmware || (format !== "project" && layer !== "legend");

  let about: string;
  if (format === "project") {
    about = t(
      "Everything in this layout: legends, matrix positions and rotation pivots. Import it here to carry on later or on another device.",
    );
  } else if (format === "via") {
    about = t(
      "The rows for layouts.keymap of a VIA definition, with every key's matrix position. The matrix is {{rows}} rows by {{cols}} columns.",
      { rows: stats.rows, cols: stats.cols },
    );
  } else if (format === "vial") {
    about = t(
      "The rows for layouts.keymap of a vial.json, with every key's matrix position. The matrix is {{rows}} rows by {{cols}} columns.",
      { rows: stats.rows, cols: stats.cols },
    );
  } else if (layer === "matrix") {
    about = t(
      "Keyboard Layout Editor data with the matrix positions on the keys, as on screen now.",
    );
  } else if (layer === "both") {
    about = t(
      "The keys carry their legends with the matrix position at the bottom right, as on screen now.",
    );
  } else {
    about = t(
      "Keyboard Layout Editor data with the legends, as on screen now.",
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={DIALOG_OVERLAY} />
        <Dialog.Content className={DIALOG_CONTENT}>
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] mb-3">
            {t("Export the layout")}
          </Dialog.Title>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-3">
            <span className="whitespace-nowrap">{t("Name")}</span>
            <input
              // Remount when the name changes elsewhere (undo, import).
              key={project.name}
              defaultValue={project.name}
              onBlur={(e) => onRename(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="layout"
              className="flex-1 min-w-0 min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-3 focus:outline-none focus:border-[var(--color-electric)]"
            />
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.id === format}
                onClick={() => setFormat(f.id)}
                className={`px-3 min-h-11 rounded-lg border text-sm ${
                  f.id === format
                    ? "border-[var(--color-electric)] text-[var(--color-text)] bg-[var(--color-electric)]/10"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
            {about}
          </Dialog.Description>
          {carriesMatrix && (stats.missing > 0 || stats.duplicates > 0) && (
            <p
              role="alert"
              className="text-sm text-[var(--color-warning)] mb-3 leading-relaxed"
            >
              {stats.missing > 0 &&
                t("{{count}} keys have no matrix position yet.", {
                  count: stats.missing,
                })}{" "}
              {stats.duplicates > 0 &&
                t("{{count}} keys share a position with another key.", {
                  count: stats.duplicates,
                })}
            </p>
          )}
          <textarea
            className={TEXTAREA}
            value={text}
            readOnly
            wrap="off"
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
          <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text)] mb-1">
              {t("Picture")}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
              {marks
                ? t(
                    "A PNG of the layout with the keycaps on it, as on screen now.",
                  )
                : t("A PNG of the layout, as on screen now.")}{" "}
              {t(
                "X cannot take a picture from a link: the picture is saved, and you attach it in the post box that opens.",
              )}
            </p>
            {pictureFailed && (
              <p
                role="alert"
                className="text-sm text-[var(--color-warning)] mb-3"
              >
                {t("The picture could not be made.")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BUTTON} onClick={savePicture}>
                <IconPhoto size={18} />
                {t("Save picture")}
              </button>
              {canShareFiles && (
                <button type="button" className={BUTTON} onClick={sharePicture}>
                  <IconShare size={18} />
                  {t("Share")}
                </button>
              )}
              <button type="button" className={BUTTON} onClick={postOnX}>
                <IconBrandX size={18} />
                {t("Post on X")}
              </button>
            </div>
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
          <h3 className="text-xs text-[var(--color-text-muted)] mb-1.5">
            {t("Generic layouts")}
          </h3>
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
          <h3 className="text-xs text-[var(--color-text-muted)] mt-4 mb-1.5">
            {t("Supported keyboards")}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {keyboardTemplates().map((board) => (
              <button
                key={board.id}
                type="button"
                className={`${BUTTON} justify-start text-left`}
                onClick={() => {
                  const project = keyboardProject(board.id);
                  if (project) onPick(project);
                }}
              >
                {board.name}
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
  const [rotateMode, setRotateMode] = useState(false);
  const [fineRotate, setFineRotate] = useState(false);
  const [stopAtKeys, setStopAtKeys] = useState(false);
  const [capture, setCapture] = useState(false);
  const [labelLayout, setLabelLayout] = useState<LabelLayout>("us");
  const [numbering, setNumbering] = useState<SplitNumbering>("across");
  const [focusToken, setFocusToken] = useState(0);
  // The keycap check: which sets, which sculpt row each line of the layout
  // is, and the caps put somewhere by hand (null: the key kept bare).
  const [fitMode, setFitMode] = useState(false);
  const [storedCaps] = useState(() => loadStoredCaps() ?? EMPTY_CAP_SETUP);
  const [switchType, setSwitchType] = useState<SwitchType | null>(
    storedCaps.switchType,
  );
  const [kitChoices, setKitChoices] = useState<KitChoice[]>(storedCaps.sets);
  // The colourway shown per set ("" = the plain drawing; unset = the first).
  const [kitColours, setKitColours] = useState<Record<string, string>>(
    storedCaps.colours,
  );
  const [rowOverrides, setRowOverrides] = useState<Record<number, string>>(
    storedCaps.rows,
  );
  const [pins, setPins] = useState<Map<string, string | null>>(
    () => new Map(storedCaps.pins),
  );
  const [trayOpen, setTrayOpen] = useState(true);
  // A pivot put somewhere by hand, for the selection it was set on.
  const [pivotOverride, setPivotOverride] = useState<{
    key: string;
    at: Point;
    touchIndex: number;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [fitToken, setFitToken] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const clipboard = useRef<{ clip: Clip; pastes: number } | null>(null);

  useEffect(() => {
    storeProject(project);
  }, [project]);
  // What was chosen in the keycap check, as it is saved and exported.
  const capSetup = useMemo<CapSetup>(
    () => ({
      switchType,
      sets: kitChoices,
      colours: kitColours,
      rows: rowOverrides,
      pins: [...pins],
    }),
    [switchType, kitChoices, kitColours, rowOverrides, pins],
  );
  useEffect(() => {
    storeCaps(capSetup);
  }, [capSetup]);

  const selectedKeys = useMemo(
    () => project.keys.filter((k) => selection.has(k.id)),
    [project, selection],
  );
  const selectedIds = useMemo(
    () => selectedKeys.map((k) => k.id),
    [selectedKeys],
  );
  const selectionKey = selectedIds.join(",");
  const pivot = useMemo(
    () =>
      pivotOverride && pivotOverride.key === selectionKey
        ? pivotOverride.at
        : defaultPivot(project, selectedKeys),
    [pivotOverride, selectionKey, project, selectedKeys],
  );
  const pivotMoved = Boolean(
    pivotOverride && pivotOverride.key === selectionKey,
  );
  const touching = useMemo(
    () => touchingCorners(project, selectedIds),
    [project, selectedIds],
  );
  const overlapping = useMemo(() => {
    const clashes = findOverlaps(project.keys);
    return selectedIds.some((id) => clashes.has(id));
  }, [project, selectedIds]);
  const layoutRows = useMemo(() => readingRows(project.keys), [project]);
  const rowNames = useMemo(
    () =>
      defaultRows(layoutRows.length).map((row, i) => rowOverrides[i] ?? row),
    [layoutRows, rowOverrides],
  );
  const fit = useMemo(
    () => (fitMode ? fitCaps(project, kitChoices, rowNames, pins) : null),
    [fitMode, project, kitChoices, rowNames, pins],
  );
  const fitMarks = useMemo(() => {
    if (!fit || kitChoices.length === 0) return null;
    const marks = new Map<string, FitMark>();
    for (const key of fit.missing) {
      marks.set(key.id, {
        status: "missing",
        main: "",
        sub: "",
        offRow: false,
        convex: false,
        pinned: pins.has(key.id),
      });
    }
    for (const [id, p] of fit.placed) {
      marks.set(id, {
        status: p.status,
        main: p.cap.cap.main,
        sub: p.cap.cap.sub,
        offRow: p.offRow,
        convex: p.cap.cap.convex,
        pinned: p.pinned,
        art:
          capArt(p.cap.kitId, kitColours[p.cap.kitId], p.cap.cap.index) ??
          undefined,
      });
    }
    return marks;
  }, [fit, kitChoices, pins, kitColours]);
  const offeredKits = useMemo(
    () => (switchType ? kitsFor(switchType) : []),
    [switchType],
  );
  const comparison = useMemo(
    () => (fitMode ? compareSets(project, rowNames, offeredKits) : []),
    [fitMode, project, rowNames, offeredKits],
  );
  /** Put a cap (by id; null for none) on a key by hand, if it is its size. */
  const pinCap = useCallback(
    (keyId: string, capId: string | null) => {
      const key = project.keys.find((k) => k.id === keyId);
      if (!key) return;
      if (capId) {
        const cap = poolOf(kitChoices).find((c) => c.id === capId);
        if (!cap || !capFitsKey(cap.cap, key)) return;
      }
      setPins((old) => {
        const next = new Map(old);
        // A cap is in one place: it leaves the key it was pinned to.
        if (capId) {
          for (const [k, v] of next) if (v === capId) next.delete(k);
        }
        next.set(keyId, capId);
        return next;
      });
    },
    [project, kitChoices],
  );
  const swapCaps = useCallback(
    (a: string, b: string) => {
      if (!fit) return;
      const keyA = project.keys.find((k) => k.id === a);
      const keyB = project.keys.find((k) => k.id === b);
      if (!keyA || !keyB) return;
      const capA = fit.placed.get(a)?.cap ?? null;
      const capB = fit.placed.get(b)?.cap ?? null;
      // Only caps that fit where they are going.
      if (capA && !capFitsKey(capA.cap, keyB)) return;
      if (capB && !capFitsKey(capB.cap, keyA)) return;
      setPins((old) => {
        const next = new Map(old);
        next.set(a, capB?.id ?? null);
        next.set(b, capA?.id ?? null);
        return next;
      });
    },
    [fit, project],
  );

  // The order Enter walks the keys in: the matrix's own on that layer.
  const entryRows = useMemo(
    () =>
      layer === "matrix"
        ? matrixRows(project, numbering)
        : readingRows(project.keys),
    [layer, project, numbering],
  );
  const stats = useMemo(() => matrixStats(project), [project]);
  const suggestions = useMemo(
    () => suggestMatrix(project, numbering),
    [project, numbering],
  );
  const ghosts = useMemo(() => {
    const out = new Map<string, string>();
    if (layer === "matrix") {
      for (const [id, m] of suggestions) out.set(id, `${m.row},${m.col}`);
    }
    return out;
  }, [layer, suggestions]);
  const isSplit = useMemo(() => splitAt(project.keys) !== null, [project]);
  const target = selectedKeys.length === 1 ? selectedKeys[0] : null;
  const stepEntry = useCallback(
    (by: 1 | -1) => {
      if (!target) return;
      const next = stepInRows(entryRows, target.id, by);
      if (next) setSelection(new Set([next]));
    },
    [entryRows, target],
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

  const replaceProject = (next: LayoutProject, caps?: CapSetup | null) => {
    commit(next);
    // Caps put on by hand belong to the keys of the old layout. A project
    // file brings its own choices; anything else keeps the sets chosen.
    setPins(new Map(caps?.pins ?? []));
    setRowOverrides(caps?.rows ?? {});
    if (caps) {
      setSwitchType(caps.switchType);
      setKitChoices(caps.sets);
      setKitColours(caps.colours);
    }
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

  // A shared link (/layout?g=<id>) opens that layout from the gallery. The
  // layout that was here stays one Undo away.
  const replaceRef = useRef(replaceProject);
  useEffect(() => {
    replaceRef.current = replaceProject;
  });
  useEffect(() => {
    const id = linkedLayoutId(window.location.search);
    if (!id) return;
    window.history.replaceState(null, "", LAYOUT_PATH);
    void fetchLayout(id).then((result) => {
      if (result.ok)
        replaceRef.current(result.value.project, result.value.caps);
    });
  }, []);

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
    // Move on to the key on the left, so Delete can be pressed again.
    const next = keyAfterDelete(project, selectedIds);
    commit(deleteKeys(project, selectedIds));
    setSelection(new Set(next ? [next] : []));
  }, [commit, project, selectedIds]);
  const nudge = useCallback(
    (dx: number, dy: number) => {
      commit(moveKeys(project, selectedIds, dx, dy));
    },
    [commit, project, selectedIds],
  );
  const rotateBy = useCallback(
    (delta: number) => {
      if (!pivot || delta === 0) return;
      const allowed = stopAtKeys
        ? limitRotation(project, selectedIds, pivot, delta)
        : delta;
      commit(rotateKeys(project, selectedIds, pivot, allowed));
    },
    [commit, pivot, project, selectedIds, stopAtKeys],
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

  const dialogOpen =
    importOpen || exportOpen || templateOpen || galleryOpen || helpOpen;
  useEffect(() => {
    if (dialogOpen || fitMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (capture && layer !== "matrix" && target && !mod) {
        // The key pressed names itself on the selected key.
        const label = labelForCode(e.code, labelLayout);
        e.preventDefault();
        if (label) {
          commit(
            setMainAndSub(project, target.id, label.main, label.sub ?? ""),
          );
          stepEntry(1);
        }
        return;
      }
      if ((e.key === "Enter" || e.key === "F2") && target && !mod) {
        e.preventDefault();
        setFocusToken((n) => n + 1);
        return;
      }
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
    fitMode,
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
    capture,
    layer,
    target,
    labelLayout,
    commit,
    stepEntry,
  ]);

  const empty = project.keys.length === 0;
  const entry = (
    <EntryPanel
      layer={layer}
      legend={{
        target,
        selectedCount: selectedKeys.length,
        onCommit: (main, sub) => {
          if (target) commit(setMainAndSub(project, target.id, main, sub));
        },
        onSlot: (slot, text) => {
          if (target) commit(setLegendSlot(project, target.id, slot, text));
        },
        onStep: stepEntry,
        labelLayout,
        onLabelLayout: setLabelLayout,
        capture,
        onToggleCapture: () => setCapture((on) => !on),
        onFillRow: (row) => {
          // Left to right, top to bottom, among the selected keys.
          const ids = readingRows(selectedKeys)
            .flat()
            .map((k) => k.id);
          commit(fillLegends(project, ids, rowPreset(row, labelLayout)));
        },
        focusToken,
      }}
      matrix={{
        target,
        suggestion: target ? (suggestions.get(target.id) ?? null) : null,
        onCommit: (position) => {
          if (target) {
            commit(setMatrix(project, new Map([[target.id, position]])));
          }
        },
        onStep: stepEntry,
        stats,
        suggested: suggestions.size,
        onAdoptAll: () => commit(setMatrix(project, suggestions)),
        onRenumber: () => {
          const cleared = setMatrix(
            project,
            new Map(project.keys.map((k) => [k.id, null])),
          );
          commit(setMatrix(cleared, suggestMatrix(cleared, numbering)));
        },
        split: isSplit,
        numbering,
        onNumbering: setNumbering,
        onPickCell: (row, col) => {
          if (target) {
            commit(setMatrix(project, new Map([[target.id, { row, col }]])));
          }
        },
        focusToken,
      }}
    />
  );
  const fitPanel = fit ? (
    <FitPanel
      totalKeys={layoutRows.flat().length}
      switchType={switchType}
      onSwitch={(type) => {
        setSwitchType(type);
        // Sets that do not go on these switches are put away, and with
        // them whatever was placed by hand.
        const fits = new Set(kitsFor(type).map((k) => k.id));
        setKitChoices((old) => old.filter((c) => fits.has(c.kitId)));
        setPins(new Map());
      }}
      kits={offeredKits}
      choices={kitChoices}
      onCount={(kitId, count) =>
        setKitChoices((old) => {
          const rest = old.filter((c) => c.kitId !== kitId);
          return count > 0 ? [...rest, { kitId, count }] : rest;
        })
      }
      colours={kitColours}
      onColour={(kitId, colour) =>
        setKitColours((old) => ({ ...old, [kitId]: colour }))
      }
      fit={fit}
      onApply={setKitChoices}
      comparison={comparison}
      rows={layoutRows.map((keys, i) => ({
        hint: keys
          .map((k) => k.legends[6] || k.legends.find(Boolean) || "")
          .filter(Boolean)
          .slice(0, 5)
          .join(" "),
        row: rowNames[i],
      }))}
      onRow={(index, row) =>
        setRowOverrides((old) => ({ ...old, [index]: row }))
      }
      sculpted={kitChoices.some((c) => kitById(c.kitId)?.sculpted)}
      target={target}
      targetPlacement={target ? (fit.placed.get(target.id) ?? null) : null}
      onBare={() => target && pinCap(target.id, null)}
      onConvex={(convex) => {
        if (target) commit(setConvex(project, [target.id], convex));
      }}
      onAuto={() => {
        if (!target) return;
        setPins((old) => {
          const next = new Map(old);
          next.delete(target.id);
          return next;
        });
      }}
      pinned={pins.size}
      onAutoAll={() => setPins(new Map())}
    />
  ) : null;
  const renderPanel = (hideCount: boolean) => (
    <KeyPanel
      hideCount={hideCount}
      keys={selectedKeys}
      step={step}
      onResize={(size) => commit(resizeKeys(project, selectedIds, size))}
      onNudge={nudge}
      onIsoEnter={() => commit(makeIsoEnter(project, selectedIds))}
      onConvex={(convex) => commit(setConvex(project, selectedIds, convex))}
      onAddNext={addOne}
      onDuplicate={duplicate}
      onMirror={mirror}
      onDelete={remove}
      rotation={{
        shown: rotateMode,
        onToggleShown: () => setRotateMode((on) => !on),
        fine: fineRotate,
        onToggleFine: () => setFineRotate((on) => !on),
        onRotateBy: rotateBy,
        touching: touching.length,
        onPivotToTouching: () => {
          if (touching.length === 0) return;
          // Each press moves on to the next shared corner.
          const index =
            pivotMoved && pivotOverride
              ? (pivotOverride.touchIndex + 1) % touching.length
              : 0;
          setPivotOverride({
            key: selectionKey,
            at: touching[index],
            touchIndex: index,
          });
          setRotateMode(true);
        },
        pivotMoved,
        onPivotReset: () => setPivotOverride(null),
        overlapping,
        onSeparate: () => {
          const v = separationFor(project, selectedIds);
          commit(moveKeys(project, selectedIds, v.x, v.y));
        },
      }}
    />
  );
  const BAR =
    "flex-shrink-0 flex items-center gap-2 px-3 py-2 border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm";

  return (
    <StandaloneFrame onBack={onBack} fill>
      <div className="h-full flex flex-col">
        <div
          className={`${BAR} order-4 sm:order-1 border-t sm:border-t-0 sm:border-b overflow-x-auto pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2`}
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
            className={`${BUTTON} ${
              fitMode
                ? "!border-[var(--color-electric)] !text-[var(--color-text)] bg-[var(--color-electric)]/10"
                : ""
            }`}
            onClick={() => {
              setFitMode((on) => !on);
              setSelection(new Set());
              setMultiSelect(false);
              setSheetOpen(true);
            }}
            aria-pressed={fitMode}
            aria-label={t("Keycap check")}
          >
            <IconKeyboard size={18} />
            <span className="hidden lg:inline whitespace-nowrap">
              {t("Keycap check")}
            </span>
          </button>
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
          <button
            type="button"
            className={BUTTON}
            onClick={() => setGalleryOpen(true)}
            aria-label={t("Gallery")}
          >
            <IconLayoutGrid size={18} />
            <span className="hidden sm:inline">{t("Gallery")}</span>
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => setHelpOpen(true)}
            aria-label={t("How to use")}
            title={t("How to use")}
          >
            <IconHelp size={18} />
          </button>
        </div>

        <div
          className={`${BAR} order-3 sm:order-2 border-t sm:border-t-0 sm:border-b overflow-x-auto ${
            fitMode ? "!hidden" : ""
          }`}
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
            className={`${ICON_BUTTON} ${
              stopAtKeys
                ? "!border-[var(--color-electric)] !text-[var(--color-text)]"
                : ""
            }`}
            onClick={() => setStopAtKeys((on) => !on)}
            aria-pressed={stopAtKeys}
            aria-label={t("Stop at other keys")}
            title={t("Stop at other keys")}
          >
            <IconWall size={18} />
            <span className="hidden sm:inline whitespace-nowrap">
              {t("Stop at other keys")}
            </span>
          </button>
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
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="relative flex-1 min-h-0">
              <LayoutCanvas
                project={project}
                layer={layer}
                selection={selection}
                onSelectionChange={setSelection}
                onMoveKeys={(ids, dx, dy) =>
                  commit(moveKeys(project, ids, dx, dy))
                }
                onResizeKey={(id, w) =>
                  commit(resizeKeys(project, [id], { w }))
                }
                snapStep={snap}
                multiSelect={multiSelect}
                ghosts={ghosts}
                flagged={stats.duplicates}
                onEditKey={() => {
                  setSheetOpen(true);
                  setFocusToken((n) => n + 1);
                }}
                capMarks={fitMode ? (fitMarks ?? new Map()) : null}
                onFitSwap={swapCaps}
                onCapDrop={(capId, keyId) => pinCap(keyId, capId)}
                rotateMode={rotateMode}
                pivot={pivot}
                onPivotChange={(at) =>
                  setPivotOverride({ key: selectionKey, at, touchIndex: -1 })
                }
                onRotateKeys={(ids, at, delta) =>
                  commit(rotateKeys(project, ids, at, delta))
                }
                fineRotate={fineRotate}
                stopAtKeys={stopAtKeys}
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
            {fit && kitChoices.length > 0 && (
              <div className="flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]/80">
                <button
                  type="button"
                  className="w-full min-h-9 px-3 flex items-center justify-between text-xs text-[var(--color-text-secondary)]"
                  onClick={() => setTrayOpen((o) => !o)}
                  aria-expanded={trayOpen}
                >
                  <span>
                    {t("Caps left over: {{count}}", {
                      count: fit.spare.length,
                    })}
                  </span>
                  {trayOpen ? (
                    <IconChevronDown size={16} />
                  ) : (
                    <IconChevronUp size={16} />
                  )}
                </button>
                {trayOpen && (
                  <CapTray
                    spare={fit.spare}
                    target={target}
                    artOf={(cap) =>
                      capArt(cap.kitId, kitColours[cap.kitId], cap.cap.index)
                    }
                    onPick={(capId) => {
                      if (!target) return;
                      pinCap(target.id, capId);
                      // On to the next key, so a row can be capped tap by tap.
                      const next = stepInRows(layoutRows, target.id, 1);
                      if (next) setSelection(new Set([next]));
                    }}
                  />
                )}
              </div>
            )}
          </div>
          <aside className="hidden lg:block w-80 flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 overflow-y-auto">
            {fitPanel ?? (
              <>
                {entry}
                {renderPanel(false)}
              </>
            )}
          </aside>
        </div>

        {(selectedKeys.length > 0 || layer === "matrix" || fitMode) && (
          <div className="order-2 sm:order-4 lg:hidden flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
            <button
              type="button"
              className="w-full min-h-11 px-3 flex items-center justify-between text-sm text-[var(--color-text-secondary)]"
              onClick={() => setSheetOpen((o) => !o)}
              aria-expanded={sheetOpen}
            >
              <span>
                {fitMode
                  ? t("Keycap check")
                  : selectedKeys.length === 0
                    ? t("Matrix")
                    : selectedKeys.length === 1
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
                {fitPanel ?? (
                  <>
                    {entry}
                    {renderPanel(true)}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(next, caps) => {
          replaceProject(next, caps);
          setImportOpen(false);
        }}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <GalleryDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        project={project}
        caps={capSetup}
        onRename={(name) => {
          if (name !== project.name) commit({ ...project, name });
        }}
        onOpen={(layout) => {
          replaceProject(layout.project, layout.caps);
          setGalleryOpen(false);
        }}
      />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        project={project}
        layer={layer}
        caps={capSetup}
        marks={fitMode ? fitMarks : null}
        stats={{
          rows: stats.rows,
          cols: stats.cols,
          missing: stats.missing,
          duplicates: stats.duplicates.size,
        }}
        onRename={(name) => {
          if (name !== project.name) commit({ ...project, name });
        }}
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
