/**
 * The layout editor: draw a keyboard's physical layout, give every key a
 * legend and a matrix position, and take it out as Keyboard Layout Editor,
 * VIA or Vial data. Works without a keyboard connected.
 *
 * This is the first stage: read KLE data, show it on a canvas that pans and
 * zooms on mouse and touch, switch between legends and matrix positions,
 * and write KLE data back. Editing comes next.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileImport,
  IconFileExport,
  IconUpload,
} from "@tabler/icons-react";
import { StandaloneFrame } from "../components/StandaloneFrame";
import { useLanguage } from "../hooks/useLanguage";
import { LayoutCanvas } from "../layoutEditor/components/LayoutCanvas";
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

export function LayoutEditorPage({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const [project, setProject] = useState<LayoutProject>(
    () => loadStoredProject() ?? sampleProject(),
  );
  const [layer, setLayer] = useState<LayoutLayer>("legend");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    storeProject(project);
  }, [project]);

  const replaceProject = (next: LayoutProject) => {
    setProject(next);
    setSelectedId(null);
    setFitToken((n) => n + 1);
    // A layout that arrives with matrix positions and no legends is a VIA /
    // Vial one: show what it has.
    const hasLegends = next.keys.some((k) => k.legends.some(Boolean));
    const hasMatrix = next.keys.some((k) => k.matrix);
    if (hasMatrix && !hasLegends) setLayer("matrix");
    if (hasLegends && !hasMatrix) setLayer("legend");
  };

  const empty = project.keys.length === 0;

  return (
    <StandaloneFrame onBack={onBack} fill>
      <div className="h-full flex flex-col">
        <div className="order-last sm:order-first flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t sm:border-t-0 sm:border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2">
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

        <div className="relative flex-1 min-h-0">
          <LayoutCanvas
            project={project}
            layer={layer}
            selectedId={selectedId}
            onSelect={setSelectedId}
            fitToken={fitToken}
          />
          {empty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center pointer-events-none">
              <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
                {t(
                  "No keys yet. Load Keyboard Layout Editor data, or start from the sample.",
                )}
              </p>
              <button
                type="button"
                className={`${BUTTON} pointer-events-auto`}
                onClick={() => replaceProject(sampleProject())}
              >
                {t("Start from the sample")}
              </button>
            </div>
          )}
        </div>
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
    </StandaloneFrame>
  );
}
