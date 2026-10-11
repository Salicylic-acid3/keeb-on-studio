/**
 * The public gallery of layouts: publish the one on screen, and browse and
 * open what others published. A card shows the layout itself, drawn from
 * the post once it has been fetched.
 */
import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconBrandX,
  IconCheck,
  IconCopy,
  IconFlag,
  IconTrash,
} from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import type { GalleryError } from "../../lib/gallery/client";
import type { CapSetup } from "../lib/capSetup";
import {
  deleteLayout,
  fetchLayout,
  layoutLink,
  listLayouts,
  myLayoutIds,
  publishLayout,
  reportLayout,
  type GalleryLayout,
  type LayoutCard,
} from "../lib/galleryClient";
import { kitById } from "../lib/kits";
import { keyCorners, projectBounds, type LayoutProject } from "../lib/model";

const BUTTON =
  "btn-ghost border border-[var(--color-border)] flex items-center justify-center gap-2 text-sm min-h-11";
const FIELD =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-3 focus:outline-none focus:border-[var(--color-electric)]";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function errorText(error: GalleryError, t: Translate, limit?: number): string {
  switch (error) {
    case "offline":
      return t("Could not reach the gallery.");
    case "not-configured":
      return t("The gallery is not set up on this server yet.");
    case "quota":
      return t("You already have {{count}} layouts in the gallery.", {
        count: limit ?? 10,
      });
    case "too-large":
      return t("That layout is too big to publish.");
    case "not-a-keymap":
      return t("That layout could not be read.");
    case "not-yours":
      return t("That layout was published from another browser.");
    case "not-found":
      return t("That layout is no longer in the gallery.");
    default:
      return t("The gallery refused that.");
  }
}

/** The outline of a layout: every key, nothing else. */
function Thumb({ project }: { project: LayoutProject }) {
  const b = projectBounds(project);
  if (!b) return null;
  const pad = 0.2;
  return (
    <svg
      viewBox={`${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`}
      className="w-full h-full"
      aria-hidden
    >
      {project.keys
        .filter((k) => !k.kle?.decal)
        .map((k) => (
          <polygon
            key={k.id}
            points={keyCorners(k)
              .map((p) => `${p.x},${p.y}`)
              .join(" ")}
            fill="var(--color-surface-elevated)"
            stroke="var(--color-border-hover)"
            strokeWidth={0.05}
            strokeLinejoin="round"
          />
        ))}
    </svg>
  );
}

function setNames(ids: string): string {
  return ids
    .split(",")
    .filter(Boolean)
    .map((id) => kitById(id)?.name ?? id)
    .join(", ");
}

export function GalleryDialog({
  open,
  onClose,
  project,
  caps,
  onRename,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  project: LayoutProject;
  caps: CapSetup;
  onRename: (name: string) => void;
  onOpen: (layout: GalleryLayout) => void;
}) {
  const { t, language } = useLanguage();
  const [cards, setCards] = useState<LayoutCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<Record<string, GalleryLayout>>({});
  const [mine, setMine] = useState<Set<string>>(() => new Set());
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState<Set<string>>(() => new Set());

  const load = useCallback(
    async (from?: string) => {
      setLoading(true);
      setListError(null);
      const page = await listLayouts(from);
      setLoading(false);
      if (!page.ok) {
        setListError(errorText(page.error, t));
        return;
      }
      setCards((old) =>
        from ? [...old, ...page.value.posts] : page.value.posts,
      );
      setCursor(page.value.cursor);
      // Each card draws its layout, so each post is fetched.
      for (const card of page.value.posts) {
        void fetchLayout(card.id).then((result) => {
          if (result.ok)
            setLayouts((old) => ({ ...old, [card.id]: result.value }));
        });
      }
    },
    [t],
  );

  useEffect(() => {
    if (!open) return;
    // Opening the dialog reads the gallery afresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(myLayoutIds());
    setNotice(null);
    setPublished(null);
    void load();
  }, [open, load]);

  const name = project.name.trim();
  const empty = project.keys.length === 0;

  const publish = async () => {
    setBusy(true);
    setNotice(null);
    const result = await publishLayout(project, caps, description.trim());
    setBusy(false);
    if (!result.ok) {
      setNotice(errorText(result.error, t, result.limit));
      return;
    }
    setPublished(result.value.id);
    setMine(myLayoutIds());
    void load();
  };

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(layoutLink(id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard access: the link is shown to select by hand.
    }
  };

  const remove = async (id: string) => {
    const result = await deleteLayout(id);
    if (!result.ok) {
      setNotice(errorText(result.error, t));
      return;
    }
    setCards((old) => old.filter((c) => c.id !== id));
    setMine(myLayoutIds());
    if (published === id) setPublished(null);
  };

  const report = async (id: string) => {
    const result = await reportLayout(id);
    if (!result.ok) {
      setNotice(errorText(result.error, t));
      return;
    }
    setReported((old) => new Set(old).add(id));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-3xl max-h-[90dvh] overflow-auto bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-5">
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] mb-1">
            {t("Layout gallery")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
            {t(
              "Layouts people have published. Opening one replaces the layout on screen; Undo brings yours back.",
            )}
          </Dialog.Description>

          <section className="rounded-lg border border-[var(--color-border)] p-3 mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">
              {t("Publish the layout on screen")}
            </h3>
            <div className="flex flex-col gap-2">
              <input
                key={project.name}
                defaultValue={project.name}
                maxLength={60}
                onBlur={(e) => onRename(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder={t("Name")}
                aria-label={t("Name")}
                className={`${FIELD} min-h-11`}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder={t("A few words about it (optional)")}
                aria-label={t("A few words about it (optional)")}
                className={`${FIELD} py-2 resize-y`}
              />
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                {t(
                  "Anyone can see and open a published layout, with its legends, matrix numbers and keycaps. No account is needed; this browser can delete what it published. Up to 10 layouts.",
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={BUTTON}
                  onClick={publish}
                  disabled={busy || empty || !name}
                >
                  {t("Publish")}
                </button>
                {!name && !empty && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("Give it a name first.")}
                  </span>
                )}
              </div>
              {published && (
                <div className="rounded-lg bg-[var(--color-electric)]/10 p-3">
                  <p className="text-sm text-[var(--color-text)] mb-2">
                    {t("Published. This link opens it:")}
                  </p>
                  <p className="text-xs font-mono break-all text-[var(--color-text-secondary)] mb-2 select-all">
                    {layoutLink(published)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={BUTTON}
                      onClick={() => copyLink(published)}
                    >
                      {copied ? (
                        <IconCheck size={18} />
                      ) : (
                        <IconCopy size={18} />
                      )}
                      {copied ? t("Copied") : t("Copy link")}
                    </button>
                    <a
                      className={BUTTON}
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://x.com/intent/post?text=${encodeURIComponent(`${name} #KeebOnStudio`)}&url=${encodeURIComponent(layoutLink(published))}`}
                    >
                      <IconBrandX size={18} />
                      {t("Post on X")}
                    </a>
                  </div>
                </div>
              )}
              {notice && (
                <p role="alert" className="text-sm text-[var(--color-warning)]">
                  {notice}
                </p>
              )}
            </div>
          </section>

          {listError && (
            <p
              role="alert"
              className="text-sm text-[var(--color-warning)] mb-3"
            >
              {listError}
            </p>
          )}
          {!listError && !loading && cards.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              {t("No layouts have been published yet.")}
            </p>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => {
              const layout = layouts[card.id];
              const sets = setNames(card.layout);
              return (
                <li
                  key={card.id}
                  className="rounded-lg border border-[var(--color-border)] p-3 flex flex-col gap-2"
                >
                  <div className="h-24 rounded-md bg-[var(--color-bg)] p-1.5">
                    {layout && <Thumb project={layout.project} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)] truncate">
                      {card.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {t("{{count}} keys", { count: card.keys })}
                      {sets ? ` · ${sets}` : ""}
                      {" · "}
                      {new Date(card.at).toLocaleDateString(language)}
                    </div>
                    {(layout?.description || card.blurb) && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed break-words">
                        {layout?.description || card.blurb}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <button
                      type="button"
                      className={`${BUTTON} flex-1`}
                      disabled={!layout}
                      onClick={() => layout && onOpen(layout)}
                    >
                      {t("Open")}
                    </button>
                    {mine.has(card.id) ? (
                      <button
                        type="button"
                        className={BUTTON}
                        onClick={() => remove(card.id)}
                        aria-label={t("Delete")}
                        title={t("Delete")}
                      >
                        <IconTrash size={18} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={BUTTON}
                        onClick={() => report(card.id)}
                        disabled={reported.has(card.id)}
                        aria-label={t("Report")}
                        title={t("Report")}
                      >
                        {reported.has(card.id) ? (
                          <IconCheck size={18} />
                        ) : (
                          <IconFlag size={18} />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between gap-2 mt-4">
            {cursor ? (
              <button
                type="button"
                className={BUTTON}
                onClick={() => load(cursor)}
                disabled={loading}
              >
                {t("Load more")}
              </button>
            ) : (
              <span />
            )}
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
