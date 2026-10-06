/**
 * The storage card's one job is to go red before saves start failing.
 */
import { readStorageUsage, STORAGE_LOW_BYTES } from "../usage";
import type { Setting } from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

const row = (key: string, value: number) =>
  ({
    customSubsystemIndex: 9,
    key,
    source: 0,
    value: { int32Value: value },
  }) as Setting;

describe("reading settings storage usage", () => {
  it("reads used space from total and free", () => {
    const usage = readStorageUsage([
      row("storage_total_bytes", 65536),
      row("storage_free_bytes", 43008),
    ]);
    expect(usage).toMatchObject({
      usedBytes: 22528,
      usedPercent: 34,
      low: false,
    });
  });

  it("calls less than a sector free low", () => {
    const usage = readStorageUsage([
      row("storage_total_bytes", 32768),
      row("storage_free_bytes", STORAGE_LOW_BYTES - 1),
    ]);
    expect(usage?.low).toBe(true);
  });

  it("shows nothing before the firmware has measured, or on older firmware", () => {
    // 0 total is "not yet published"; a missing key is firmware without it.
    expect(
      readStorageUsage([
        row("storage_total_bytes", 0),
        row("storage_free_bytes", 0),
      ]),
    ).toBeNull();
    expect(readStorageUsage([])).toBeNull();
  });
});
