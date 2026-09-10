/**
 * The public gallery: keymaps other people published, and the way into your
 * own list.
 *
 * Opening one adds it to My keymaps and stops there, the same rule a file and
 * a link follow. Nothing here writes to a keyboard, so browsing the gallery is
 * never a risk to the keymap someone is in the middle of editing.
 *
 * There is no page count and no jump-to-page, because KV has neither. What it
 * has is a cursor, so what this offers is "load more".
 */
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconBuildingStore,
  IconDownload,
  IconFlag,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import {
  galleryErrorMessage,
  type GalleryCard,
  type GalleryError,
} from "../../lib/gallery";

export interface GalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: GalleryCard[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: GalleryError | null;
  /** Ids this browser published, so its own posts offer Delete rather than Report. */
  mine: ReadonlySet<string>;
  onOpenPost: (post: GalleryCard) => void;
  onReport: (post: GalleryCard) => void;
  onDelete: (post: GalleryCard) => void;
  onLoadMore: () => void;
  /** Set while an action is running, so its row can say so. */
  busyId: string | null;
}

export function GalleryDialog({
  open,
  onOpenChange,
  posts,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  mine,
  onOpenPost,
  onReport,
  onDelete,
  onLoadMore,
  busyId,
}: GalleryDialogProps) {
  const { t, language } = useLanguage();
  const [confirmingReport, setConfirmingReport] = useState<string | null>(null);

  const date = (at: number) =>
    new Date(at).toLocaleDateString(language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-3xl max-h-[85vh] flex flex-col bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
          <div className="flex items-start gap-2 mb-1">
            <Dialog.Title className="flex-1 text-base font-medium text-[var(--color-text)] flex items-center gap-2">
              <IconBuildingStore
                size={18}
                className="text-[var(--color-electric)]"
              />
              {t("Keymap gallery")}
            </Dialog.Title>
            <Dialog.Close className="btn-ghost p-1" aria-label={t("Close")}>
              <IconX size={16} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-xs text-[var(--color-text-muted)] mb-4">
            {t(
              "Keymaps other people published. Opening one adds it to your keymaps — nothing is written to your keyboard.",
            )}
          </Dialog.Description>

          {error && (
            <p className="mb-3 text-sm text-[var(--color-warning)]">
              {galleryErrorMessage(error, t)}
            </p>
          )}

          <div className="flex-1 overflow-auto -mx-2 px-2">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                {t("Loading…")}
              </p>
            ) : posts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                {t("Nothing has been published yet.")}
              </p>
            ) : (
              <ul className="space-y-2">
                {posts.map((post) => {
                  const isMine = mine.has(post.id);
                  const busy = busyId === post.id;
                  return (
                    <li
                      key={post.id}
                      className="p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border)]/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-text)] truncate">
                            {post.name}
                          </p>
                          {post.blurb && (
                            <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                              {post.blurb}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                            {[
                              post.layout,
                              t("{{count}} layers", { count: post.layers }),
                              date(post.at),
                              isMine ? t("published from this browser") : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-40"
                            onClick={() => onOpenPost(post)}
                            disabled={busy}
                          >
                            <IconDownload size={14} />
                            {t("Add")}
                          </button>
                          {isMine ? (
                            <button
                              className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-electric)] transition-colors disabled:opacity-40"
                              onClick={() => onDelete(post)}
                              disabled={busy}
                              title={t("Remove from the gallery")}
                              aria-label={t(
                                "Remove {{name}} from the gallery",
                                {
                                  name: post.name,
                                },
                              )}
                            >
                              <IconTrash size={14} />
                            </button>
                          ) : (
                            <button
                              className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-warning)] transition-colors disabled:opacity-40"
                              onClick={() => setConfirmingReport(post.id)}
                              disabled={busy}
                              title={t("Report this keymap")}
                              aria-label={t("Report {{name}}", {
                                name: post.name,
                              })}
                            >
                              <IconFlag size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline rather than a second dialog: reporting is a
                          small act with a real consequence, so it gets a
                          confirmation but not a whole screen. */}
                      {confirmingReport === post.id && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center gap-2">
                          <p className="flex-1 text-xs text-[var(--color-text-muted)]">
                            {t(
                              "Report this keymap for the maintainer to look at?",
                            )}
                          </p>
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => setConfirmingReport(null)}
                          >
                            {t("Cancel")}
                          </button>
                          <button
                            className="btn-electric text-xs"
                            onClick={() => {
                              onReport(post);
                              setConfirmingReport(null);
                            }}
                          >
                            {t("Report")}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {hasMore && (
            <div className="pt-3 flex justify-center">
              <button
                className="btn-ghost text-sm"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? t("Loading…") : t("Load more")}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
