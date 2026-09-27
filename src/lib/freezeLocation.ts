/**
 * Turning a freeze incident's captured location into readable lines.
 *
 * Firmware with the freeze-location watchdog records, for the work queue
 * that stopped: the thread's state bits, the kernel object it was waiting
 * on, and a few code addresses (PC, LR, then return addresses found on its
 * stack). With the build's ELF loaded these become function names; without
 * it they stay hex, which is still worth copying into a report.
 *
 * Shared by the Watchdog table and the support report so both say the same
 * thing.
 */
import type { FreezeDetail } from "../proto/cormoran/watchdog/watchdog";
import type { ResolvedAddress } from "./elfAnalysis";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export interface FreezeResolvers {
  resolve: (address: number) => ResolvedAddress | null;
  resolveData: (address: number) => { name: string; offset: number } | null;
}

// Zephyr's thread_state bits (kernel_structs.h).
const THREAD_PENDING = 0x02;
const THREAD_SLEEPING = 0x04;
const THREAD_SUSPENDED = 0x10;
const THREAD_QUEUED = 0x80;

export function hasFreezeLocation(freeze: FreezeDetail | undefined): boolean {
  return Boolean(freeze && freeze.frames.length > 0);
}

const hex = (value: number) =>
  `0x${(value >>> 0).toString(16).padStart(8, "0")}`;

function formatCode(address: number, resolvers?: FreezeResolvers): string {
  const r = resolvers?.resolve(address);
  if (!r?.functionName) return hex(address);
  let s = r.functionName;
  if (r.offset) s += `+0x${r.offset.toString(16)}`;
  if (r.file) {
    const shortFile = r.file.replace(/\\/g, "/").split("/").slice(-3).join("/");
    s += ` (${shortFile}${r.line !== undefined ? `:${r.line}` : ""})`;
  }
  return s;
}

/** What the thread was doing, in words. */
export function describeThreadState(bits: number, t: Translate): string {
  if (bits & THREAD_PENDING) return t("waiting on a kernel object");
  if (bits & THREAD_SLEEPING) return t("sleeping");
  if (bits & THREAD_SUSPENDED) return t("suspended");
  if (bits & THREAD_QUEUED)
    return t(
      "ready but not running (higher-priority work kept it off the CPU)",
    );
  return t("state 0x{{bits}}", { bits: bits.toString(16) });
}

/**
 * One line per fact: the state, what it waited on, then the frames.
 * Empty for a freeze recorded by firmware that does not capture a location.
 */
export function freezeLocationLines(
  freeze: FreezeDetail,
  t: Translate,
  resolvers?: FreezeResolvers,
): string[] {
  if (!hasFreezeLocation(freeze)) return [];
  const lines = [
    `${t("Thread")}: ${describeThreadState(freeze.threadState, t)}`,
  ];
  if (freeze.pendedOn) {
    const data = resolvers?.resolveData(freeze.pendedOn);
    const target = data
      ? `${data.name}${data.offset ? `+0x${data.offset.toString(16)}` : ""}`
      : hex(freeze.pendedOn);
    lines.push(`${t("Waiting on")}: ${target}`);
  }
  freeze.frames.forEach((address, index) => {
    const label = index === 0 ? "PC" : index === 1 ? "LR" : `#${index}`;
    lines.push(`${label} → ${formatCode(address, resolvers)}`);
  });
  return lines;
}
