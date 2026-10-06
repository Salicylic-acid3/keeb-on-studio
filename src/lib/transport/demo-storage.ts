/**
 * Settings storage usage in demo mode.
 *
 * The custom-settings module publishes the partition size and the free
 * space as two temporary settings under its own subsystem. The demo
 * keyboard shows a healthy 64 KB partition about a third full: the state
 * someone will see on a freshly flashed board, which is the one worth
 * recognising as normal.
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

const TOTAL_BYTES = 65536;
const FREE_BYTES = 43008;

export function createStorageSettings(customSubsystemIndex: number): Setting[] {
  return (
    [
      ["storage_total_bytes", TOTAL_BYTES],
      ["storage_free_bytes", FREE_BYTES],
    ] as const
  ).map(([key, value]) => ({
    customSubsystemIndex,
    key,
    source: 0,
    hasUnsavedValue: false,
    meta: {
      confidentiality: 2,
      readPermission: 0,
      writePermission: 1,
      constraints: [],
    },
    value: { int32Value: value },
  }));
}
