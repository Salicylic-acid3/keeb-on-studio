/**
 * The key test: pick a keyboard, press its keys, see each one light up.
 *
 * Meant for the moment a keyboard arrives. Vial and the QMK side of this
 * app have a key tester too, but behind an unlock, and only for a keyboard
 * connected over USB; this one listens to what the keyboard types, like any
 * page would, so nothing is connected or unlocked and a wireless keyboard
 * is tested the same way.
 *
 * What it shows is the keyboard's default keymap. A keyboard whose keymap
 * has been changed is better tested on the standard ANSI or JIS full-size
 * keyboard, where a press lights the key that sends the same thing.
 */
import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  IconAlertTriangle,
  IconInfoCircle,
  IconKeyboard,
  IconListDetails,
  IconRefresh,
} from "@tabler/icons-react";
import { StandaloneFrame } from "../components/StandaloneFrame";
import { useLanguage } from "../hooks/useLanguage";
import { KeyTestBoard } from "../keyTest/components/KeyTestBoard";
import {
  ANSI_ID,
  JIS_ID,
  testBoard,
  testBoardEntries,
  testableLayers,
  type BoardGroup,
  type TestBoard,
} from "../keyTest/lib/boards";
import {
  CHATTER_MS,
  clearFlash,
  heldKeys,
  indexBoard,
  initialState,
  keyDown,
  keyUp,
  modsOf,
  mouseDown,
  mouseUp,
  releaseAll,
  type BoardIndex,
  type PressEvent,
  type TestState,
} from "../keyTest/lib/matcher";

export const KEY_TEST_PATH = "/keyboard-test";

const STORAGE_KEY = "keeb-on:key-test-board";
const FLASH_MS = 220;

type Action =
  | { type: "down"; ev: PressEvent }
  | { type: "up"; code: string; time: number }
  | { type: "mouseDown"; button: number; time: number }
  | { type: "mouseUp"; button: number; time: number }
  | { type: "releaseAll"; keepModifiers?: boolean }
  | { type: "clearFlash"; upTo: number }
  | { type: "reset" };

function reducer(index: BoardIndex) {
  return (state: TestState, action: Action): TestState => {
    switch (action.type) {
      case "down":
        return keyDown(state, index, action.ev);
      case "up":
        return keyUp(state, index, action);
      case "mouseDown":
        return mouseDown(state, index, action);
      case "mouseUp":
        return mouseUp(state, action);
      case "releaseAll":
        return releaseAll(state, action);
      case "clearFlash":
        return clearFlash(state, action.upTo);
      case "reset":
        return initialState();
    }
  };
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform || navigator.platform || "";
  return /mac|iphone|ipad/i.test(platform);
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private windows and blocked storage: the choice just is not kept.
  }
}

function initialBoardId(language: string): string {
  const known = new Set(testBoardEntries().map((e) => e.id));
  const fromUrl = new URLSearchParams(window.location.search).get("keyboard");
  if (fromUrl && known.has(fromUrl)) return fromUrl;
  const stored = readStored();
  if (stored && known.has(stored)) return stored;
  return language === "ja" ? JIS_ID : ANSI_ID;
}

export function KeyTestPage({ onBack }: { onBack: () => void }) {
  const { t, language } = useLanguage();
  const [boardId, setBoardId] = useState(() => initialBoardId(language));
  const board: TestBoard = useMemo(
    () => testBoard(boardId) ?? testBoard(ANSI_ID)!,
    [boardId],
  );
  return (
    <StandaloneFrame onBack={onBack}>
      {/* Remounted per keyboard, so every count starts again from nothing. */}
      <KeyTest
        key={board.id}
        board={board}
        onBoardChange={(id) => {
          setBoardId(id);
          writeStored(id);
          const url = new URL(window.location.href);
          url.searchParams.set("keyboard", id);
          window.history.replaceState(null, "", url);
        }}
        t={t}
      />
    </StandaloneFrame>
  );
}

const GROUP_LABEL: Record<BoardGroup, string> = {
  standard: "Standard keyboards",
  zmk: "ZMK keyboards",
  qmk: "QMK keyboards",
};

function KeyTest({
  board,
  onBoardChange,
  t,
}: {
  board: TestBoard;
  onBoardChange: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const index = useMemo(() => indexBoard(board), [board]);
  const layers = useMemo(() => testableLayers(board), [board]);
  const reduce = useMemo(() => reducer(index), [index]);
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const mac = useMemo(() => isMac(), []);
  const entries = useMemo(() => testBoardEntries(), []);
  const standard = board.id === ANSI_ID || board.id === JIS_ID;

  // The keyboard is listened to on the whole window, ahead of everything
  // else, and nothing it types reaches the page: Space would scroll, Tab
  // would move focus, F5 would reload.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (!e.code) return;
      e.preventDefault();
      e.stopPropagation();
      dispatch({
        type: "down",
        ev: {
          code: e.code,
          key: e.key,
          mods: modsOf(e),
          repeat: e.repeat,
          time: e.timeStamp,
        },
      });
    };
    const onUp = (e: KeyboardEvent) => {
      if (!e.code) return;
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "up", code: e.code, time: e.timeStamp });
      // A Mac sends no key-up for keys let go while Command is held.
      if (mac && e.code.startsWith("Meta"))
        dispatch({ type: "releaseAll", keepModifiers: true });
    };
    const onBlur = () => dispatch({ type: "releaseAll" });
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: "releaseAll" });
    };
    // Pointer events, not mouse events: the board cancels its pointerdown
    // (no text selection, no autoscroll), and a cancelled pointerdown means
    // the browser sends no mouseup at all.
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      dispatch({ type: "mouseUp", button: e.button, time: e.timeStamp });
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mac]);

  // Keys lit for a moment go dark again.
  const flashTop = Math.max(0, ...Object.values(state.flash));
  useEffect(() => {
    if (!flashTop) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "clearFlash", upTo: flashTop }),
      FLASH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [flashTop]);

  const held = useMemo(() => heldKeys(state), [state]);
  const done = index.testable.filter((id) => state.counts[id]).length;
  const total = index.testable.length;
  const untestable = board.keys.length - total;
  const chattering = Object.keys(state.chatter).length;
  const unmapped = Object.entries(state.unmapped);
  const labelOf = useMemo(
    () => new Map(board.keys.map((k) => [k.id, k.label.main || "?"])),
    [board],
  );
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-light tracking-wide text-[var(--color-text)]">
          <IconKeyboard size={26} className="text-[var(--color-electric)]" />
          {t("Key test")}
        </h1>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-3xl">
          {t(
            "Press each key of the keyboard in front of you: the key on screen lights up while it is held and stays tinted once it has worked. Nothing needs connecting or unlocking, so a wireless keyboard is tested the same way.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 min-w-[16rem] flex-1 sm:flex-none">
          <span className="text-xs text-[var(--color-text-muted)]">
            {t("Keyboard to test")}
          </span>
          <select
            value={board.id}
            onChange={(e) => {
              onBoardChange(e.target.value);
              // Out of the way, so the next key pressed is the test's.
              e.target.blur();
            }}
            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]"
          >
            {(["standard", "zmk", "qmk"] as const).map((group) => (
              <optgroup key={group} label={t(GROUP_LABEL[group])}>
                {entries
                  .filter((e) => e.group === group)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.group === "standard" ? t(e.name) : e.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={(e) => {
            dispatch({ type: "reset" });
            e.currentTarget.blur();
          }}
          className="btn-ghost h-10 border border-[var(--color-border)] flex items-center gap-2 text-sm"
        >
          <IconRefresh size={16} />
          {t("Reset")}
        </button>
      </div>

      {!standard && (
        <p className="flex items-start gap-2 rounded-xl border border-[var(--color-cyber)]/40 bg-[var(--color-cyber)]/10 px-4 py-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          <IconInfoCircle
            size={16}
            className="mt-px flex-shrink-0 text-[var(--color-cyber)]"
          />
          <span>
            {t(
              "Shown is this keyboard's default keymap. If you have changed its keymap, choose ANSI or JIS full size instead: a press then lights the key that sends the same thing.",
            )}
          </span>
        </p>
      )}

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--color-text)]">
            <span className="font-medium">
              {standard ? t(board.name) : board.name}
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-[14rem]">
            <div
              className="h-2 flex-1 rounded-full bg-[var(--color-surface-elevated)] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
            >
              <div
                className="h-full rounded-full bg-[var(--color-neon)] transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span
              className={`text-sm tabular-nums ${
                done === total && total > 0
                  ? "text-[var(--color-neon)] font-medium"
                  : "text-[var(--color-text-secondary)]"
              }`}
              data-testid="key-test-progress"
            >
              {done === total && total > 0
                ? t("All {{total}} keys work", { total })
                : t("{{done}} / {{total}} keys work", { done, total })}
            </span>
          </div>
        </div>

        <div
          className="select-none"
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") return;
            // No text selection, no middle-button autoscroll.
            e.preventDefault();
            dispatch({
              type: "mouseDown",
              button: e.button,
              time: e.timeStamp,
            });
          }}
          onContextMenu={(e) => e.preventDefault()}
          onAuxClick={(e) => e.preventDefault()}
        >
          <KeyTestBoard
            board={board}
            layers={layers}
            held={held}
            counts={state.counts}
            chatter={state.chatter}
            untestableTitle={t("Sends nothing a browser can see")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-muted)]">
          <Legend swatch="held">{t("Held now")}</Legend>
          <Legend swatch="tested">{t("Worked")}</Legend>
          {untestable > 0 && (
            <Legend swatch="untestable">
              {t("Not counted ({{n}})", { n: untestable })}
            </Legend>
          )}
          <Legend swatch="chatter">{t("Bounced")}</Legend>
        </div>
      </section>

      {(chattering > 0 || unmapped.length > 0) && (
        <section className="space-y-3">
          {chattering > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-text)]">
              <IconAlertTriangle
                size={18}
                className="mt-px flex-shrink-0 text-[var(--color-warning)]"
              />
              <span>
                {t(
                  "{{n}} key(s) may be chattering: they came down again within {{ms}} ms of being let go. Press them a few more times to see whether it happens again.",
                  { n: chattering, ms: CHATTER_MS },
                )}
              </span>
            </p>
          )}
          {unmapped.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-3 text-sm">
              <p className="text-[var(--color-text-secondary)]">
                {t("Pressed, but not on this keyboard's default keymap:")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {unmapped.map(([code, n]) => (
                  <span
                    key={code}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-0.5 font-mono text-xs text-[var(--color-text)]"
                  >
                    {code}
                    {n > 1 ? ` ×${n}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm">
          <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
            <IconListDetails size={18} className="text-[var(--color-cyber)]" />
            {t("Recent input")}
          </h2>
          {state.log.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              {t("Press any key.")}
            </p>
          ) : (
            <ul className="mt-3 space-y-1 font-mono text-xs">
              {state.log.map((entry) => (
                <li
                  key={entry.n}
                  className="flex items-baseline gap-3 text-[var(--color-text-secondary)]"
                >
                  <span className="w-36 flex-shrink-0 truncate text-[var(--color-text)]">
                    {[...entry.mods.map(modName), entry.code].join(" + ")}
                  </span>
                  <span className="flex-1 truncate">
                    {entry.keyIds.length === 0 ? (
                      <span className="text-[var(--color-text-muted)]">
                        {t("Not on this keyboard")}
                      </span>
                    ) : (
                      [
                        ...new Set(entry.keyIds.map((id) => labelOf.get(id))),
                      ].join(", ")
                    )}
                  </span>
                  {entry.chatter && (
                    <span className="text-[var(--color-warning)]">
                      {t("Bounced")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm">
          <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
            <IconInfoCircle size={18} className="text-[var(--color-cyber)]" />
            {t("Notes")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            <li>
              {t(
                "Layer keys light nothing on their own. Hold one with another key: that key lights up, and so does the layer key, once what they sent together shows it was held.",
              )}
            </li>
            <li>
              {t(
                "Keys with a dashed outline (Bluetooth keys and the like) send nothing a browser can see, and are not counted.",
              )}
            </li>
            <li>
              {t(
                "When several keys are assigned the same function, all of them light up. To test the key matrix itself, connect the keyboard and use the key input display.",
              )}
            </li>
            <li>
              {t("For mouse buttons, click on the keyboard drawn above.")}
            </li>
            <li>
              {t(
                "Browser and system shortcuts (closing the tab, switching apps) cannot be held back.",
              )}
            </li>
            <li>
              {t(
                "On a keyboard with a trackpad, gestures may be registered as virtual keys.",
              )}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function modName(mod: string): string {
  return { shift: "Shift", ctrl: "Ctrl", alt: "Alt", meta: "Meta" }[mod] ?? mod;
}

function Legend({
  swatch,
  children,
}: {
  swatch: "held" | "tested" | "untestable" | "chatter";
  children: ReactNode;
}) {
  const cls = {
    held: "bg-[var(--color-electric)] border-[var(--color-electric)]",
    tested:
      "bg-[color-mix(in_srgb,var(--color-neon)_20%,var(--color-surface-elevated))] border-[var(--color-neon)]",
    untestable: "border-dashed border-[var(--color-border-hover)]",
    chatter:
      "bg-[color-mix(in_srgb,var(--color-warning)_20%,var(--color-surface-elevated))] border-[var(--color-warning)]",
  }[swatch];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-3.5 rounded border ${cls}`} />
      {children}
    </span>
  );
}
