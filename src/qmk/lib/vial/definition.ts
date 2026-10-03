/**
 * The keyboard definition a Vial keyboard carries inside its firmware: the
 * keymap's vial.json, xz-compressed. Keeb-On! adds one field of its own
 * (`keebOn`) which the firmware build passes through untouched.
 */
import { XzReadableStream } from "xz-decompress";

/** One KLE row: strings are keys, objects are property changes. */
export type KleRow = Array<string | Record<string, unknown>>;

export interface VialLayoutLabel {
  /** Option name shown to the person. */
  name: string;
  /** Choices; a two-state option has none and is a checkbox. */
  choices: string[];
}

export interface KeebOnOsBlock {
  id: string;
  layers: number[];
}

export interface KeebOnDefinition {
  /** Version of the raw HID OS-switch commands the firmware implements. */
  osProtocol?: number;
  osBlocks?: KeebOnOsBlock[];
}

export interface VialDefinition {
  name: string;
  vendorId: number;
  productId: number;
  matrix: { rows: number; cols: number };
  /** Raw KLE rows; see kle.ts for the parsed form. */
  keymap: KleRow[];
  layoutLabels: VialLayoutLabel[];
  /** "none" | "qmk_rgblight" | "qmk_backlight" | "vialrgb" ... */
  lighting: string;
  keebOn: KeebOnDefinition | null;
}

export class VialDefinitionError extends Error {}

export async function decompressDefinition(bytes: Uint8Array): Promise<string> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = new XzReadableStream(source).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(out);
}

function parseLabels(raw: unknown): VialLayoutLabel[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (typeof entry === "string") return { name: entry, choices: [] };
    if (Array.isArray(entry) && entry.every((e) => typeof e === "string")) {
      const [name, ...choices] = entry as string[];
      return { name, choices };
    }
    throw new VialDefinitionError("Unreadable layout label");
  });
}

function parseNumber(value: unknown, what: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new VialDefinitionError(`Missing ${what} in keyboard definition`);
  }
  return n;
}

export function parseDefinition(json: string): VialDefinition {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new VialDefinitionError("Keyboard definition is not valid JSON");
  }
  const matrix = data.matrix as Record<string, unknown> | undefined;
  const layouts = data.layouts as Record<string, unknown> | undefined;
  if (!matrix || !layouts || !Array.isArray(layouts.keymap)) {
    throw new VialDefinitionError(
      "Keyboard definition has no matrix or keymap",
    );
  }
  const keebOnRaw = data.keebOn as Record<string, unknown> | undefined;
  const keebOn: KeebOnDefinition | null = keebOnRaw
    ? {
        osProtocol:
          typeof keebOnRaw.osProtocol === "number"
            ? keebOnRaw.osProtocol
            : undefined,
        osBlocks: Array.isArray(keebOnRaw.osBlocks)
          ? (keebOnRaw.osBlocks as Array<Record<string, unknown>>).map((b) => ({
              id: String(b.id),
              layers: Array.isArray(b.layers) ? (b.layers as number[]) : [],
            }))
          : undefined,
      }
    : null;
  return {
    name: typeof data.name === "string" ? data.name : "keyboard",
    // Vial itself does not need these (the USB descriptor has them), so an
    // older vial.json may leave them out.
    vendorId:
      data.vendorId === undefined ? 0 : parseNumber(data.vendorId, "vendorId"),
    productId:
      data.productId === undefined
        ? 0
        : parseNumber(data.productId, "productId"),
    matrix: {
      rows: parseNumber(matrix.rows, "matrix rows"),
      cols: parseNumber(matrix.cols, "matrix cols"),
    },
    keymap: layouts.keymap as KleRow[],
    layoutLabels: parseLabels(layouts.labels),
    lighting: typeof data.lighting === "string" ? data.lighting : "none",
    keebOn,
  };
}

export async function readDefinition(
  bytes: Uint8Array,
): Promise<VialDefinition> {
  return parseDefinition(await decompressDefinition(bytes));
}
