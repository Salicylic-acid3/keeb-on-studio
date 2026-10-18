/**
 * Typing practice and the keymap setup guide, at /practice (SPEC: docs/
 * practice/SPEC.md): the page frame, the keyboard and OS layout choice,
 * and the switch between the guide, free practice (sentences or tasks)
 * and, with ?meta, the keyboard metadata editor.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  IconChevronRight,
  IconCompass,
  IconDeviceFloppy,
  IconPlugConnected,
  IconPlugConnectedX,
  IconRoute,
  IconSchool,
  IconTypography,
} from "@tabler/icons-react";
import { ConnectionNoticeDialog } from "../components/ConnectionNoticeDialog";
import { StandaloneFrame } from "../components/StandaloneFrame";
import { useLanguage } from "../hooks/useLanguage";
import { hasAcceptedNotice } from "../lib/connectionNoticeStorage";
import {
  usePracticeDevice,
  type PracticeDevice,
} from "../practice/hooks/usePracticeDevice";
import {
  testBoard,
  testBoardEntries,
  type TestBoard,
} from "../keyTest/lib/boards";
import type { LabelLayout } from "../layoutEditor/lib/keyLabels";
import { PracticeSession } from "../practice/components/PracticeSession";
import { TaskSession } from "../practice/components/TaskSession";
import { MetaEditor } from "../practice/components/MetaEditor";
import { Notice } from "../practice/components/bits";
import { GuideBoundary, GuideFlow } from "../practice/components/GuideFlow";
import { GUIDE_40 } from "../practice/lib/guide";
import { readProgress } from "../practice/lib/guideStore";
import { keyboardMeta } from "../practice/lib/metadata";

type PracticeMode = "pick" | "guide" | "free" | "meta";

export const PRACTICE_PATH = "/practice";

const DEFAULT_BOARD = "goforty_max_ortho";

type T = (key: string, params?: Record<string, string | number>) => string;

export function PracticePage({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const entries = useMemo(
    () => testBoardEntries().filter((e) => e.group !== "standard"),
    [],
  );
  const [boardId, setBoardId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("keyboard");
    return fromUrl && entries.some((e) => e.id === fromUrl)
      ? fromUrl
      : DEFAULT_BOARD;
  });
  const [kind, setKind] = useState<"text" | "task">("text");
  const [layout, setLayout] = useState<LabelLayout>("us");
  // With a keyboard connected, its own layout and keymap take the place of
  // the registered keyboard's defaults, and the guide's steps are written
  // to it as they are applied.
  const device = usePracticeDevice(layout);
  const live = device.live;
  const board = useMemo(
    () => live?.board ?? testBoard(boardId) ?? testBoard(entries[0].id)!,
    [live, boardId, entries],
  );
  // Metadata comes from the registered board the device is, when known.
  const metaBoard = useMemo(
    () => (live && device.boardId ? testBoard(device.boardId) : null) ?? board,
    [live, device.boardId, board],
  );
  const progressKey = live ? `live:${board.id}` : board.id;
  const onApply = useCallback(
    (writes: Parameters<PracticeDevice["write"]>[0]) => {
      void device.write(writes);
    },
    [device],
  );
  // The mode lives in the URL too (?mode=guide), so Back and Forward, or
  // a reload, land on the same screen rather than the picker.
  const [mode, setModeState] = useState<PracticeMode>(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("meta")) return "meta";
    const m = q.get("mode");
    return m === "guide" || m === "free" ? m : "pick";
  });
  const setMode = (m: PracticeMode) => {
    setModeState(m);
    const url = new URL(window.location.href);
    if (m === "pick" || m === "meta") url.searchParams.delete("mode");
    else url.searchParams.set("mode", m);
    window.history.replaceState(null, "", url);
  };

  return (
    <StandaloneFrame onBack={onBack}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-light tracking-wide text-[var(--color-text)]">
              <IconSchool size={26} className="text-[var(--color-electric)]" />
              {t("Typing practice")}
            </h1>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-3xl">
              {t(
                "Decide your keymap step by step, then practise on it with the real keymap in front of you. A wrong key points straight at the key you meant, so what you learn here feeds back into the layout.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {live ? (
              <div className="flex flex-col gap-1 min-w-[14rem]">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t("Keyboard to practise on")}
                </span>
                <span className="flex h-10 items-center gap-2 rounded-lg border border-[var(--color-electric)]/60 bg-[var(--color-electric)]/10 px-3 text-sm text-[var(--color-text)]">
                  <IconPlugConnected
                    size={16}
                    className="text-[var(--color-electric)]"
                  />
                  {board.name}
                </span>
              </div>
            ) : (
              <label className="flex flex-col gap-1 min-w-[14rem]">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t("Keyboard to practise on")}
                </span>
                <select
                  value={board.id}
                  onChange={(e) => {
                    setBoardId(e.target.value);
                    e.target.blur();
                  }}
                  className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]"
                >
                  {(["zmk", "qmk"] as const).map((group) => (
                    <optgroup
                      key={group}
                      label={t(
                        group === "zmk" ? "ZMK keyboards" : "QMK keyboards",
                      )}
                    >
                      {entries
                        .filter((e) => e.group === group)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("OS keyboard layout")}
              </span>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as LabelLayout)}
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]"
              >
                <option value="us">US</option>
                <option value="jis">JIS</option>
              </select>
            </label>
          </div>
        </div>

        <DeviceBar t={t} device={device} />

        {mode === "meta" && <MetaEditor key={board.id} board={board} t={t} />}
        {mode === "pick" && (
          <ModePicker
            t={t}
            board={board}
            metaBoard={metaBoard}
            progressKey={progressKey}
            onPick={setMode}
          />
        )}
        {mode === "guide" && (
          <GuideBoundary
            key={`${progressKey}:${layout}`}
            t={t}
            boardId={progressKey}
          >
            <GuideFlow
              board={board}
              meta={keyboardMeta(metaBoard)}
              layout={layout}
              t={t}
              onExit={() => setMode("pick")}
              startKeymap={live?.keymap}
              progressKey={progressKey}
              onApply={live ? onApply : undefined}
            />
          </GuideBoundary>
        )}
        {mode === "free" && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("Practise with")}
              </span>
              <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)] divide-x divide-[var(--color-border)]">
                {(["text", "task"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`h-9 px-4 text-sm transition-colors ${
                      kind === k
                        ? "bg-[var(--color-electric)]/15 text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {k === "text" ? t("Sentences") : t("Tasks")}
                  </button>
                ))}
              </div>
            </div>
            {kind === "text" ? (
              <PracticeSession
                key={`${board.id}:${layout}`}
                board={board}
                layout={layout}
                t={t}
                onExit={() => setMode("pick")}
              />
            ) : (
              <TaskSession
                key={`${board.id}:${layout}`}
                board={board}
                layout={layout}
                t={t}
                onExit={() => setMode("pick")}
              />
            )}
          </>
        )}
      </div>
    </StandaloneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* The connected keyboard                                               */
/* ------------------------------------------------------------------ */

/**
 * Demo mode or the connected keyboard: a connect button, or the device's
 * name with what the guide has written to it and the save / discard
 * buttons. Writes go to the keyboard's memory; saving keeps them.
 */
function DeviceBar({ t, device }: { t: T; device: PracticeDevice }) {
  const [notice, setNotice] = useState(false);
  const connect = () => {
    if (hasAcceptedNotice("serial")) device.connect("serial");
    else setNotice(true);
  };
  const outcome = device.lastWrite;
  const failed = outcome?.unwritable.length ?? 0;
  if (!device.connected) {
    return (
      <>
        <Notice>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>
              {t(
                "Demo mode: the keymap shown is this keyboard's default. Connect a ZMK keyboard to use the keymap read from it, and the guide writes each applied step to the keyboard.",
              )}
            </span>
            <button
              type="button"
              onClick={connect}
              disabled={device.loading}
              className="btn-electric h-8 px-3 text-xs flex items-center gap-1.5"
            >
              <IconPlugConnected size={14} />
              {device.loading ? t("Connecting...") : t("Connect Keyboard")}
            </button>
          </span>
          {device.error && (
            <span className="block mt-1 text-[var(--color-warning)]">
              {device.error}
            </span>
          )}
        </Notice>
        <ConnectionNoticeDialog
          open={notice}
          method="serial"
          onAgree={() => {
            setNotice(false);
            device.connect("serial");
          }}
          onCancel={() => setNotice(false)}
        />
      </>
    );
  }
  return (
    <Notice>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5">
          <IconPlugConnected
            size={14}
            className="text-[var(--color-electric)]"
          />
          {device.ready
            ? t(
                "Connected: the guide and the practice use the keymap read from {{name}}.",
                {
                  name: device.deviceName ?? "",
                },
              )
            : t("Reading the keymap from {{name}}...", {
                name: device.deviceName ?? "",
              })}
        </span>
        {device.hasUnsavedChanges && (
          <span className="text-[var(--color-electric)]">
            {t("Written to the keyboard, not yet saved.")}
          </span>
        )}
        {outcome && failed > 0 && (
          <span className="text-[var(--color-warning)]">
            {t("{{n}} of the changes could not be written to the keyboard.", {
              n: failed,
            })}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void device.save()}
            disabled={!device.hasUnsavedChanges || device.writing}
            className="btn-electric h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <IconDeviceFloppy size={14} />
            {t("Save to keyboard")}
          </button>
          <button
            type="button"
            onClick={() => void device.discard()}
            disabled={!device.hasUnsavedChanges || device.writing}
            className="btn-ghost h-8 border border-[var(--color-border)] px-3 text-xs disabled:opacity-50"
          >
            {t("Discard unsaved")}
          </button>
          <button
            type="button"
            onClick={device.disconnect}
            className="btn-ghost h-8 px-2 text-xs flex items-center gap-1"
            title={t("Disconnect")}
          >
            <IconPlugConnectedX size={14} />
          </button>
        </span>
      </span>
    </Notice>
  );
}

/* ------------------------------------------------------------------ */
/* Mode picker                                                          */
/* ------------------------------------------------------------------ */

function ModePicker({
  t,
  board,
  metaBoard,
  progressKey,
  onPick,
}: {
  t: T;
  board: TestBoard;
  metaBoard: TestBoard;
  progressKey: string;
  onPick: (mode: PracticeMode) => void;
}) {
  const saved = readProgress(progressKey);
  const meta = keyboardMeta(metaBoard);
  const noGuide = meta.defaultGuide === null;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <ModeCard
          icon={<IconRoute size={22} />}
          title={t("Setup guide")}
          body={
            noGuide
              ? t(
                  "A pad has no guide: its keys are decided by what it is for. Free practice still works.",
                )
              : t(
                  "Questions in order: which symbols you use most, where your thumb lands for Space, which thumb key becomes a layer key, what goes on each layer. Each answer becomes a proposal drawn on your keymap, to apply or skip. Practice follows every finished layer.",
                )
          }
          action={
            saved ? t("Continue where you left off") : t("Start the guide")
          }
          onClick={() => onPick("guide")}
          disabled={noGuide}
          primary
        />
        <ModeCard
          icon={<IconTypography size={22} />}
          title={t("Free practice")}
          body={t(
            "Practise sentences and tasks on the keymap as it is now. Stop at a wrong key and see which key you meant, or keep going and read the misses at the end.",
          )}
          action={t("Start practising")}
          onClick={() => onPick("free")}
        />
      </div>
      {saved && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-hover)] px-5 py-4 text-sm text-[var(--color-text-secondary)]">
          <IconCompass size={18} className="text-[var(--color-neon)]" />
          <span>
            {t("Last time: {{keyboard}}, step {{n}} of {{total}} ({{step}})", {
              keyboard: board.name,
              n: saved.step + 1,
              total: GUIDE_40.length,
              step: t(GUIDE_40[saved.step]?.title ?? ""),
            })}
          </span>
        </section>
      )}
    </div>
  );
}

function ModeCard({
  icon,
  title,
  body,
  action,
  onClick,
  primary = false,
  disabled = false,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm">
      <h2 className="flex items-center gap-2 text-base font-medium text-[var(--color-text)]">
        <span className="text-[var(--color-cyber)]">{icon}</span>
        {title}
      </h2>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {body}
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-5 h-10 self-start px-4 text-sm flex items-center gap-2 disabled:opacity-50 ${
          primary
            ? "btn-electric"
            : "btn-ghost border border-[var(--color-border)]"
        }`}
      >
        {action}
        <IconChevronRight size={16} />
      </button>
    </section>
  );
}
