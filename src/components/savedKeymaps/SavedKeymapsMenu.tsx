/**
 * The keymap tab's "Saved" control: keep the current keymap under a name, and
 * put a kept one back.
 *
 * Sits next to Versions because the two answer neighbouring questions -- "undo
 * to what it was" versus "switch to the one I made" -- but they are different
 * stores: versions are captured automatically and expire, saved keymaps are
 * named on purpose and stay until deleted.
 */
import { useEffect, useRef, useState } from "react";
import {
  IconBookmark,
  IconBuildingStore,
  IconChevronDown,
  IconDeviceFloppy,
  IconDownload,
  IconLink,
  IconTrash,
  IconUpload,
  IconWorldUpload,
} from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  isLoadable,
  type Compatibility,
  type SavedKeymap,
} from "../../lib/savedKeymaps";

export interface SavedKeymapsMenuProps {
  keymaps: SavedKeymap[];
  canSave: boolean;
  /** False in demo mode: a keymap can be kept there, but not handed to anyone. */
  canShare: boolean;
  isDurable: boolean;
  compatibility: (record: SavedKeymap) => Compatibility;
  onSave: (name: string, description: string) => void;
  onLoad: (record: SavedKeymap) => void;
  onDelete: (record: SavedKeymap) => void;
  onExport: (record: SavedKeymap) => void;
  onImport: (file: File) => void;
  onShare: (record: SavedKeymap) => void;
  onPublish: (record: SavedKeymap) => void;
  onBrowseGallery: () => void;
  disabled?: boolean;
}

/** One line explaining why a record can or cannot go onto this keyboard. */
function compatibilityNote(
  compatibility: Compatibility,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  switch (compatibility.kind) {
    case "match":
      return null;
    case "different-layout":
      return t("Saved for {{savedFor}}, but the keys line up.", {
        savedFor: compatibility.savedFor,
      });
    case "key-count":
      return t(
        "Saved for a {{savedFor}}-key keyboard; this one has {{connected}}.",
        {
          savedFor: compatibility.savedFor,
          connected: compatibility.connected,
        },
      );
    case "schema":
      return t("Saved by a newer version of Keeb-On! Studio.");
  }
}

export function SavedKeymapsMenu({
  keymaps,
  canSave,
  canShare,
  isDurable,
  compatibility,
  onSave,
  onLoad,
  onDelete,
  onExport,
  onImport,
  onShare,
  onPublish,
  onBrowseGallery,
  disabled = false,
}: SavedKeymapsMenuProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsNaming(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsNaming(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isNaming) nameInputRef.current?.focus();
  }, [isNaming]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, description.trim());
    setName("");
    setDescription("");
    setIsNaming(false);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      <button
        className="btn-ghost text-sm flex items-center gap-1.5"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <IconBookmark size={16} />
        {/* Not "Saved": the keymap preview already shows a "Saved" status
            badge meaning "no unsaved changes", and two controls with the same
            word on one screen is a coin toss for the reader. */}
        {t("My keymaps")}
        <IconChevronDown size={14} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-80 max-h-[26rem] overflow-auto z-30 glass-card p-2"
        >
          {isNaming ? (
            <div className="p-2 space-y-2">
              <label className="block text-xs text-[var(--color-text-muted)]">
                {t("Name")}
                <input
                  ref={nameInputRef}
                  className="input-field w-full mt-1 text-sm"
                  value={name}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submit();
                  }}
                />
              </label>
              <label className="block text-xs text-[var(--color-text-muted)]">
                {t("Description (optional)")}
                <textarea
                  className="input-field w-full mt-1 text-sm"
                  rows={2}
                  value={description}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  className="btn-ghost text-sm"
                  onClick={() => setIsNaming(false)}
                >
                  {t("Cancel")}
                </button>
                <button
                  className="btn-electric text-sm"
                  onClick={submit}
                  disabled={!name.trim()}
                >
                  {t("Save")}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full text-left p-3 rounded-lg hover:bg-[var(--color-border)] transition-colors disabled:opacity-40"
              onClick={() => setIsNaming(true)}
              disabled={!canSave}
              role="menuitem"
            >
              <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <IconDeviceFloppy size={16} />
                {t("Save this keymap…")}
              </span>
              <span className="block mt-0.5 text-xs text-[var(--color-text-muted)]">
                {t("Keeps a named copy in this browser.")}
              </span>
            </button>
          )}

          {!isNaming && (
            <button
              className="w-full text-left p-3 rounded-lg hover:bg-[var(--color-border)] transition-colors"
              onClick={() => fileInputRef.current?.click()}
              role="menuitem"
            >
              <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <IconUpload size={16} />
                {t("Import from a file…")}
              </span>
              <span className="block mt-0.5 text-xs text-[var(--color-text-muted)]">
                {/* Adding to the list, not writing to the keyboard: putting a
                    keymap on the board stays a separate, deliberate step. */}
                {t("Adds it to this list. Nothing is written to the keyboard.")}
              </span>
            </button>
          )}

          {!isNaming && (
            <button
              className="w-full text-left p-3 rounded-lg hover:bg-[var(--color-border)] transition-colors"
              onClick={() => {
                onBrowseGallery();
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <IconBuildingStore size={16} />
                {t("Browse the gallery…")}
              </span>
              <span className="block mt-0.5 text-xs text-[var(--color-text-muted)]">
                {t("Keymaps other people published.")}
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Clearing lets the same file be picked again after a failure.
              event.target.value = "";
              if (file) onImport(file);
            }}
          />

          {!isDurable && (
            <p className="px-3 py-2 text-xs text-[var(--color-warning)]">
              {t(
                "This browser will not keep saved keymaps after you close it.",
              )}
            </p>
          )}

          {/* Say why the share button is missing rather than leaving a gap
              where one used to be on someone else's screen. */}
          {!canShare && keymaps.length > 0 && (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              {t("Connect your keyboard to share or publish a keymap.")}
            </p>
          )}

          <div className="my-2 border-t border-[var(--color-border)]" />

          {keymaps.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              {t("Nothing saved yet.")}
            </p>
          ) : (
            keymaps.map((record) => {
              const state = compatibility(record);
              const note = compatibilityNote(state, t);
              const loadable = isLoadable(state);
              return (
                <div
                  key={record.id}
                  className="p-3 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <button
                      className="flex-1 min-w-0 text-left disabled:opacity-40"
                      onClick={() => {
                        onLoad(record);
                        setIsOpen(false);
                      }}
                      disabled={!loadable}
                      role="menuitem"
                    >
                      <span className="block text-sm text-[var(--color-text)] truncate">
                        {record.name}
                      </span>
                      {record.description && (
                        <span className="block text-xs text-[var(--color-text-muted)] line-clamp-2">
                          {record.description}
                        </span>
                      )}
                      <span className="block mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {[
                          record.target.layoutName,
                          new Date(record.updatedAt).toLocaleDateString(),
                          record.fromDemo ? t("made in demo mode") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {note && (
                        <span className="block mt-1 text-[10px] text-[var(--color-warning)]">
                          {note}
                        </span>
                      )}
                    </button>
                    {canShare && (
                      <button
                        className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-electric)] transition-colors"
                        onClick={() => {
                          onPublish(record);
                          setIsOpen(false);
                        }}
                        title={t("Publish to the gallery")}
                        aria-label={t("Publish {{name}} to the gallery", {
                          name: record.name,
                        })}
                      >
                        <IconWorldUpload size={14} />
                      </button>
                    )}
                    {canShare && (
                      <button
                        className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-electric)] transition-colors"
                        onClick={() => {
                          onShare(record);
                          setIsOpen(false);
                        }}
                        title={t("Copy a share link")}
                        aria-label={t("Copy a share link for {{name}}", {
                          name: record.name,
                        })}
                      >
                        <IconLink size={14} />
                      </button>
                    )}
                    <button
                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-electric)] transition-colors"
                      onClick={() => onExport(record)}
                      title={t("Export to a file")}
                      aria-label={t("Export {{name}}", { name: record.name })}
                    >
                      <IconDownload size={14} />
                    </button>
                    <button
                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-electric)] transition-colors"
                      onClick={() => onDelete(record)}
                      title={t("Delete")}
                      aria-label={t("Delete {{name}}", { name: record.name })}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
