/**
 * Typing practice and the keymap setup guide, at /practice (SPEC: docs/
 * practice/SPEC.md): the page frame, the keyboard and OS layout choice,
 * and the switch between the guide, free practice (sentences or tasks)
 * and, with ?meta, the keyboard metadata editor.
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  IconChevronRight,
  IconCompass,
  IconRoute,
  IconSchool,
  IconTypography,
} from "@tabler/icons-react";
import { StandaloneFrame } from "../components/StandaloneFrame";
import { useLanguage } from "../hooks/useLanguage";
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
import { GuideFlow } from "../practice/components/GuideFlow";
import { GUIDE_40 } from "../practice/lib/guide";
import { readProgress } from "../practice/lib/guideStore";
import { keyboardMeta } from "../practice/lib/metadata";
import { keyboardFirmware } from "../layoutEditor/lib/keyboards";
import { QMK_PATH } from "../lib/firmware";

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
  const board = useMemo(
    () => testBoard(boardId) ?? testBoard(entries[0].id)!,
    [boardId, entries],
  );
  const [mode, setMode] = useState<PracticeMode>(() =>
    new URLSearchParams(window.location.search).has("meta") ? "meta" : "pick",
  );
  const [kind, setKind] = useState<"text" | "task">("text");
  const [layout, setLayout] = useState<LabelLayout>("us");

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

        <Notice>
          {t(
            "Demo mode: the keymap shown is this keyboard's default. With a keyboard connected, the guide and the practice use the keymap read from it.",
          )}
        </Notice>

        {mode === "meta" && <MetaEditor key={board.id} board={board} t={t} />}
        {mode === "pick" && <ModePicker t={t} board={board} onPick={setMode} />}
        {mode === "guide" && (
          <GuideFlow
            key={`${board.id}:${layout}`}
            board={board}
            meta={keyboardMeta(board)}
            layout={layout}
            remapperHref={keyboardFirmware(board.id) === "qmk" ? QMK_PATH : "/"}
            t={t}
            onExit={() => setMode("pick")}
          />
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
/* Mode picker                                                          */
/* ------------------------------------------------------------------ */

function ModePicker({
  t,
  board,
  onPick,
}: {
  t: T;
  board: TestBoard;
  onPick: (mode: PracticeMode) => void;
}) {
  const saved = readProgress(board.id);
  const meta = keyboardMeta(board);
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
