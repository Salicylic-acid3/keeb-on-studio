/**
 * My layouts: the layouts in the user's own GitHub Gists, where Keyboard
 * Layout Editor keeps them too. Save the layout on screen, and open any
 * saved one -- all of them, a page at a time, with a search box.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconBrandGithub,
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
} from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import type { CapSetup } from "../lib/capSetup";
import {
  beginSignIn,
  githubClientId,
  githubUser,
  listGists,
  openGist,
  saveGist,
  signOut,
  storedToken,
  type GistEntry,
  type GistError,
  type GistLink,
  type OpenedGist,
} from "../lib/gists";
import type { LayoutProject } from "../lib/model";

const BUTTON =
  "btn-ghost border border-[var(--color-border)] flex items-center justify-center gap-2 text-sm min-h-11 disabled:opacity-40 disabled:pointer-events-none";
const FIELD =
  "w-full min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-3 focus:outline-none focus:border-[var(--color-electric)]";

/** Layouts shown at a time. */
export const GISTS_PER_PAGE = 20;

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function errorText(error: GistError, t: Translate): string {
  switch (error) {
    case "offline":
      return t("Could not reach GitHub.");
    case "not-configured":
      return t("Saving to Gists is not set up on this server yet.");
    case "signed-out":
      return t("You are signed out of GitHub. Sign in again.");
    case "rate-limit":
      return t("GitHub is refusing requests for now. Try again in a while.");
    case "not-found":
      return t("That Gist is no longer there.");
    case "not-a-layout":
      return t("That Gist has no layout this editor can read.");
    default:
      return t("GitHub refused that.");
  }
}

type Account =
  | { state: "checking" }
  | { state: "not-configured" }
  | { state: "signed-out"; clientId: string }
  | { state: "signed-in"; user: string };

export function GistDialog({
  open,
  onClose,
  project,
  caps,
  link,
  onLink,
  onRename,
  onOpen,
  signInNotice,
}: {
  open: boolean;
  onClose: () => void;
  project: LayoutProject;
  caps: CapSetup;
  /** The Gist the layout on screen came from or was saved to. */
  link: GistLink | null;
  onLink: (link: GistLink | null) => void;
  onRename: (name: string) => void;
  onOpen: (opened: OpenedGist) => void;
  /** Signing in just failed, on the way back from GitHub. */
  signInNotice: GistError | null;
}) {
  const { t, language } = useLanguage();
  const [account, setAccount] = useState<Account>({ state: "checking" });
  const [entries, setEntries] = useState<GistEntry[]>([]);
  const [requests, setRequests] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [makePublic, setMakePublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /** Ask GitHub for the next lot of Gists; `fresh` starts over. */
  const loadMore = useCallback(
    async (fresh: boolean, all = false): Promise<void> => {
      setLoading(true);
      let request = fresh ? 1 : requests + 1;
      let collected: GistEntry[] = fresh ? [] : entries;
      let further = true;
      while (further) {
        const result = await listGists(request);
        if (!result.ok) {
          setNotice(errorText(result.error, t));
          if (result.error === "signed-out") setAccount({ state: "checking" });
          break;
        }
        collected = [...collected, ...result.value.entries];
        further = result.value.more;
        setEntries(collected);
        setRequests(request);
        setMore(further);
        request += 1;
        if (!all) break;
      }
      setLoading(false);
    },
    [requests, entries, t],
  );

  // Opening the dialog finds out who is signed in and reads their Gists.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setNotice(signInNotice ? errorText(signInNotice, t) : null);
      setSaved(false);
      if (storedToken()) {
        const user = await githubUser();
        if (cancelled) return;
        if (user.ok) {
          setAccount({ state: "signed-in", user: user.value });
          setPage(0);
          const first = await listGists(1);
          if (cancelled) return;
          if (first.ok) {
            setEntries(first.value.entries);
            setRequests(1);
            setMore(first.value.more);
          } else {
            setNotice(errorText(first.error, t));
          }
          return;
        }
        if (user.error !== "signed-out") {
          setNotice(errorText(user.error, t));
          return;
        }
      }
      const config = await githubClientId();
      if (cancelled) return;
      setAccount(
        config.ok
          ? { state: "signed-out", clientId: config.value }
          : { state: "not-configured" },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, signInNotice, t]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? entries.filter((e) => e.name.toLowerCase().includes(needle))
      : entries;
  }, [entries, query]);
  const pageCount = Math.max(1, Math.ceil(shown.length / GISTS_PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const onPage = shown.slice(
    current * GISTS_PER_PAGE,
    (current + 1) * GISTS_PER_PAGE,
  );
  const atEnd = current >= pageCount - 1;

  const next = async () => {
    // The last page read so far: fetch on before turning to it.
    if (atEnd && more) await loadMore(false);
    setPage(current + 1);
  };

  const search = (text: string) => {
    setQuery(text);
    setPage(0);
    // A search looks through every Gist, so the rest are read now.
    if (text.trim() && more && !loading) void loadMore(false, true);
  };

  const save = async (over: GistLink | null) => {
    setBusy(true);
    setNotice(null);
    setSaved(false);
    const result = await saveGist(project, caps, { over, public: makePublic });
    setBusy(false);
    if (!result.ok) {
      setNotice(errorText(result.error, t));
      // The Gist it belonged to is gone: the next save makes a new one.
      if (result.error === "not-found") onLink(null);
      return;
    }
    onLink(result.value);
    setSaved(true);
    setPage(0);
    void loadMore(true);
  };

  const openEntry = async (entry: GistEntry) => {
    setBusy(true);
    setNotice(null);
    const result = await openGist(entry.id);
    setBusy(false);
    if (!result.ok) {
      setNotice(errorText(result.error, t));
      return;
    }
    onOpen(result.value);
  };

  const name = project.name.trim();
  const empty = project.keys.length === 0;

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-2xl max-h-[90dvh] overflow-auto bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-5">
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] mb-1">
            {t("My layouts")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
            {t(
              "Layouts are kept in your own GitHub Gists, the same place Keyboard Layout Editor keeps them: what you saved there opens here, and what you save here opens there.",
            )}
          </Dialog.Description>

          {notice && (
            <p
              role="alert"
              className="text-sm text-[var(--color-warning)] mb-3"
            >
              {notice}
            </p>
          )}

          {account.state === "checking" && !notice && (
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              {t("Checking…")}
            </p>
          )}

          {account.state === "not-configured" && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-3 leading-relaxed">
              {t("Saving to Gists is not set up on this server yet.")}{" "}
              {t(
                "Until it is, Export has a Project file that carries everything.",
              )}
            </p>
          )}

          {account.state === "signed-out" && (
            <div className="mb-3">
              <button
                type="button"
                className={BUTTON}
                onClick={() =>
                  beginSignIn(
                    account.clientId,
                    `${window.location.origin}${window.location.pathname}`,
                  )
                }
              >
                <IconBrandGithub size={18} />
                {t("Sign in with GitHub")}
              </button>
              <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-relaxed">
                {t(
                  "The editor asks GitHub for your Gists only, nothing else of your account. The sign-in is kept in this browser; signing out here forgets it.",
                )}
              </p>
            </div>
          )}

          {account.state === "signed-in" && (
            <>
              <div className="flex items-center justify-between gap-2 mb-3 text-sm text-[var(--color-text-secondary)]">
                <span className="flex items-center gap-1.5 min-w-0">
                  <IconBrandGithub size={16} />
                  <span className="truncate">{account.user}</span>
                </span>
                <button
                  type="button"
                  className="text-xs underline text-[var(--color-text-muted)]"
                  onClick={() => {
                    signOut();
                    setEntries([]);
                    setAccount({ state: "checking" });
                    void githubClientId().then((config) =>
                      setAccount(
                        config.ok
                          ? { state: "signed-out", clientId: config.value }
                          : { state: "not-configured" },
                      ),
                    );
                  }}
                >
                  {t("Sign out")}
                </button>
              </div>

              <section className="rounded-lg border border-[var(--color-border)] p-3 mb-4">
                <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">
                  {t("Save the layout on screen")}
                </h3>
                <input
                  key={project.name}
                  defaultValue={project.name}
                  maxLength={80}
                  onBlur={(e) => onRename(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  placeholder={t("Name")}
                  aria-label={t("Name")}
                  className={`${FIELD} mb-2`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {link && (
                    <button
                      type="button"
                      className={BUTTON}
                      disabled={busy || empty || !name}
                      onClick={() => save(link)}
                    >
                      {t("Save over it")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={busy || empty || !name}
                    onClick={() => save(null)}
                  >
                    {link ? t("Save as a new Gist") : t("Save to a Gist")}
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={makePublic}
                      onChange={(e) => setMakePublic(e.target.checked)}
                    />
                    {t("Make a new Gist public")}
                  </label>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-relaxed">
                  {link
                    ? t(
                        "This layout came from one of your Gists; Save over it updates that one.",
                      )
                    : t(
                        "A Gist that is not public is seen only by those you give its link to.",
                      )}{" "}
                  {t(
                    "Besides the file Keyboard Layout Editor reads, the Gist gets a second file that keeps the matrix numbers and keycaps for this editor.",
                  )}
                </p>
                {!name && !empty && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {t("Give it a name first.")}
                  </p>
                )}
                {saved && (
                  <p className="text-sm text-[var(--color-text)] mt-2">
                    {t("Saved.")}
                  </p>
                )}
              </section>

              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-[var(--color-text)] whitespace-nowrap">
                  {t("Saved layouts")}
                </h3>
                <input
                  value={query}
                  onChange={(e) => search(e.target.value)}
                  placeholder={t("Search by name")}
                  aria-label={t("Search by name")}
                  className={`${FIELD} !min-h-9`}
                />
              </div>
              {shown.length === 0 && !loading && (
                <p className="text-sm text-[var(--color-text-muted)] mb-3">
                  {query.trim()
                    ? t("No saved layout has that in its name.")
                    : t("No layouts are saved in your Gists yet.")}
                </p>
              )}
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {onPage.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--color-text)] truncate">
                        {entry.name}
                        {link?.id === entry.id && (
                          <span className="ml-2 text-xs text-[var(--color-electric)]">
                            {t("on screen")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {entry.updatedAt
                          ? new Date(entry.updatedAt).toLocaleDateString(
                              language,
                            )
                          : ""}
                        {" · "}
                        {entry.full
                          ? t("with matrix and keycaps")
                          : "Keyboard Layout Editor"}
                        {entry.public ? ` · ${t("public")}` : ""}
                      </div>
                    </div>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${BUTTON} !min-w-11 !px-2`}
                        aria-label={t("See the Gist on GitHub")}
                        title={t("See the Gist on GitHub")}
                      >
                        <IconExternalLink size={16} />
                      </a>
                    )}
                    <button
                      type="button"
                      className={BUTTON}
                      disabled={busy}
                      onClick={() => openEntry(entry)}
                    >
                      {t("Open")}
                    </button>
                  </li>
                ))}
              </ul>
              {(shown.length > GISTS_PER_PAGE || more) && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    type="button"
                    className={`${BUTTON} !min-w-11 !px-2`}
                    disabled={current === 0 || loading}
                    onClick={() => setPage(current - 1)}
                    aria-label={t("Previous page")}
                  >
                    <IconChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                    {more
                      ? t("Page {{page}}", { page: current + 1 })
                      : t("Page {{page}} of {{count}}", {
                          page: current + 1,
                          count: pageCount,
                        })}
                  </span>
                  <button
                    type="button"
                    className={`${BUTTON} !min-w-11 !px-2`}
                    disabled={(atEnd && !more) || loading}
                    onClick={next}
                    aria-label={t("Next page")}
                  >
                    <IconChevronRight size={18} />
                  </button>
                </div>
              )}
              {loading && (
                <p className="text-xs text-[var(--color-text-muted)] text-center mt-2">
                  {t("Reading your Gists…")}
                </p>
              )}
            </>
          )}

          <div className="flex justify-end mt-4">
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
