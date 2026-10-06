/**
 * How full the keyboard's settings storage is.
 *
 * Settings live in NVS on a flash partition of fixed size. When it fills,
 * every new save is refused and nothing says so: a setting changed in the
 * app takes effect until the next reboot and then comes back as it was.
 * ClickBoard ErgoTrack hit this at 32 KB and it was found by elimination.
 *
 * The custom-settings module (61f2b6a and later) publishes the partition
 * size and NVS's estimate of the free space as two temporary settings under
 * its own subsystem. Older firmware has neither key, and the card stays
 * away rather than showing a question mark.
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** The custom-settings module's own Studio subsystem id. */
export const STORAGE_SUBSYSTEM_ID = "cormoran_custom_settings";

const TOTAL_KEY = "storage_total_bytes";
const FREE_KEY = "storage_free_bytes";

/**
 * NVS keeps one sector (4 KB) in reserve for garbage collection, and a save
 * needs room for the record it replaces as well as the new one; below about
 * a sector of estimated free space, saves start failing.
 */
export const STORAGE_LOW_BYTES = 4096;

export interface StorageUsage {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  /** 0–100, of the total. */
  usedPercent: number;
  /** Saves are about to fail, or already are. */
  low: boolean;
}

export function readStorageUsage(
  settings: readonly Setting[],
): StorageUsage | null {
  const total = settings.find((s) => s.key === TOTAL_KEY)?.value?.int32Value;
  const free = settings.find((s) => s.key === FREE_KEY)?.value?.int32Value;
  // 0 total is "not measured yet" (the firmware publishes after boot), not an
  // empty partition.
  if (total === undefined || free === undefined || total <= 0) return null;
  const used = Math.max(0, total - free);
  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usedPercent: Math.round(Math.min(1, used / total) * 100),
    low: free < STORAGE_LOW_BYTES,
  };
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`;
}
