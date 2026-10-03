/**
 * How layers are shown: grouped into OS blocks when the firmware has the
 * OS-switch module and the definition names the blocks, otherwise flat.
 */
import type { VialDefinition } from "./vial/definition";
import type { KeebOnOsState } from "./vial/protocol";
import { decodeKeycode, encodeKeycode } from "./keycodes/qmkKeycode";

export const OS_TARGETS = ["windows", "macos", "linux", "other"] as const;
export type OsTarget = (typeof OS_TARGETS)[number];

/** QMK os_variant_t */
export const DETECTED_OS_NAMES: Record<number, string> = {
  0: "Unknown",
  1: "Linux",
  2: "Windows",
  3: "macOS",
  4: "iOS",
};

export const OS_TARGET_NAMES: Record<OsTarget, string> = {
  windows: "Windows",
  macos: "macOS / iOS",
  linux: "Linux",
  other: "Unknown OS",
};

export interface LayerGroup {
  /** Block id from the definition ("A"), or "" for the flat list. */
  id: string;
  /** OS targets that use this block, in OS_TARGETS order. */
  targets: OsTarget[];
  layers: number[];
  /** Block index, or -1 when flat. */
  block: number;
}

export function layerGroups(
  definition: VialDefinition,
  layerCount: number,
  os: KeebOnOsState | null,
): LayerGroup[] {
  const blocks = definition.keebOn?.osBlocks;
  if (!os || !blocks || !blocks.length) {
    return [
      {
        id: "",
        targets: [],
        layers: Array.from({ length: layerCount }, (_, i) => i),
        block: -1,
      },
    ];
  }
  return blocks.map((b, index) => ({
    id: b.id,
    targets: OS_TARGETS.filter((_, t) => os.blocks[t] === index),
    layers: b.layers.filter((l) => l < layerCount),
    block: index,
  }));
}

/** "Windows" / "macOS / iOS, Linux" / "Block C (unused)" */
export function groupTitle(
  group: LayerGroup,
  t: (key: string) => string,
): string {
  if (group.block < 0) return t("Layers");
  if (!group.targets.length)
    return t("Block {{id}} (unused)").replace("{{id}}", group.id);
  return group.targets.map((target) => t(OS_TARGET_NAMES[target])).join(", ");
}

/**
 * Translate a keycode from one block's layers to another's: MO(1) in block A
 * becomes MO(5) in block B. Only layer references inside the source block
 * move; references outside it are left alone.
 */
export function relayerKeycode(
  code: number,
  from: LayerGroup,
  to: LayerGroup,
): number {
  const key = decodeKeycode(code);
  if (!("layer" in key)) return code;
  const index = from.layers.indexOf(key.layer);
  if (index < 0 || index >= to.layers.length) return code;
  return encodeKeycode({ ...key, layer: to.layers[index] });
}
