/**
 * .vil files: Vial's own "Save current layout" / "Load saved layout" format
 * (vial-gui keyboard_comm.py save_layout / restore_layout), so a keymap moves
 * freely between Vial and Keeb-On! Studio.
 *
 *   {
 *     "version": 1, "uid": <64-bit int>, "vial_protocol": 6, "via_protocol": 9,
 *     "layout": [layer][row][col] keycode names (-1 where there is no key),
 *     "layout_options": int,
 *     "macro": [[["text", "hi"], ["tap", "KC_A", ...], ["down", ..], ["up", ..], ["delay", ms]]],
 *     "tap_dance": [[tap, hold, double tap, tap-hold, term]],
 *     "combo": [[k1, k2, k3, k4, out]],
 *     "key_override": [{ "trigger", "replacement", "layers", "trigger_mods",
 *                        "negative_mod_mask", "suppressed_mods", "options" }],
 *     "settings": { "<qsid>": value }
 *   }
 *
 * Keycodes travel as Vial's names (KC_A, LT1(KC_SPACE), KC_CAPSLOCK), from
 * vial-gui's own tables, so both programs read each other's files. Anything that
 * does not fit this keyboard (more layers, unknown keycodes, ids it lacks)
 * is skipped and reported rather than guessed at.
 */
import { KC_NO } from "./keycodes/qmkKeycode";
import { parseVialKeycode, vialKeycodeName } from "./keycodes/vialNames";
import type { MacroStep } from "./macro";
import type {
  VialComboEntry,
  VialKeyOverrideEntry,
  VialTapDanceEntry,
} from "./vial/protocol";

export interface VilState {
  uid?: string; // 16 hex digits, bytes as the firmware sends them
  vialProtocol: number;
  keymap: number[][][];
  layoutOptions: number;
  macros: MacroStep[][];
  tapDances: VialTapDanceEntry[];
  combos: VialComboEntry[];
  keyOverrides: VialKeyOverrideEntry[];
  settings: Record<number, number>;
}

/** The uid as Vial writes it: the 8 bytes read as a little-endian integer. */
function uidToDecimal(hex: string): string {
  const bytes = hex.match(/../g) ?? [];
  let v = 0n;
  for (let i = bytes.length - 1; i >= 0; i--)
    v = (v << 8n) | BigInt(parseInt(bytes[i], 16));
  return v.toString();
}

const name = (code: number) => vialKeycodeName(code);

function macroToVil(steps: MacroStep[]): unknown[] {
  const out: unknown[] = [];
  for (const s of steps) {
    const last = out[out.length - 1] as unknown[] | undefined;
    if (s.action === "string") out.push(["text", s.text]);
    else if (s.action === "delay") out.push(["delay", s.ms]);
    // Vial groups a run of taps (or downs, or ups) into one action.
    else if (last && last[0] === s.action) last.push(name(s.keycode));
    else out.push([s.action, name(s.keycode)]);
  }
  return out;
}

export function exportVil(state: VilState): string {
  const UID = "__UID__";
  const doc = {
    version: 1,
    uid: state.uid ? UID : 0,
    layout: state.keymap.map((layer) => layer.map((row) => row.map(name))),
    encoder_layout: [],
    layout_options: state.layoutOptions,
    macro: state.macros.map(macroToVil),
    vial_protocol: state.vialProtocol,
    via_protocol: 9,
    tap_dance: state.tapDances.map((t) => [
      name(t.onTap),
      name(t.onHold),
      name(t.onDoubleTap),
      name(t.onTapHold),
      t.tappingTerm,
    ]),
    combo: state.combos.map((c) => [...c.input.map(name), name(c.output)]),
    key_override: state.keyOverrides.map((o) => ({
      trigger: name(o.trigger),
      replacement: name(o.replacement),
      layers: o.layers,
      trigger_mods: o.triggerMods,
      negative_mod_mask: o.negativeModMask,
      suppressed_mods: o.suppressedMods,
      options: o.options,
    })),
    settings: Object.fromEntries(
      Object.entries(state.settings).map(([k, v]) => [String(k), v]),
    ),
  };
  // A 64-bit uid does not fit a JS number; write its digits as they are.
  return JSON.stringify(doc).replace(
    `"${UID}"`,
    state.uid ? uidToDecimal(state.uid) : "0",
  );
}

export interface VilImport {
  keymap: Array<{ layer: number; row: number; col: number; code: number }>;
  layoutOptions?: number;
  macros?: MacroStep[][];
  tapDances?: VialTapDanceEntry[];
  combos?: VialComboEntry[];
  keyOverrides?: VialKeyOverrideEntry[];
  settings?: Record<number, number>;
  /** The file was saved from a different keyboard model. */
  otherKeyboard: boolean;
  /** Things left out, already worded for the person. */
  skipped: string[];
}

export class VilFormatError extends Error {}

interface VilTarget {
  uid?: string;
  layerCount: number;
  rows: number;
  cols: number;
  tapDanceCount: number;
  comboCount: number;
  keyOverrideCount: number;
  macroCount: number;
  settingIds: Set<number>;
}

export function importVil(text: string, target: VilTarget): VilImport {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new VilFormatError("This is not a .vil file");
  }
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.layout)) {
    throw new VilFormatError("This is not a .vil file");
  }
  const skipped: string[] = [];
  const unknown = new Set<string>();
  const code = (v: unknown): number | undefined => {
    if (typeof v === "number") return v < 0 ? undefined : v & 0xffff;
    if (typeof v !== "string") return undefined;
    const c = parseVialKeycode(v);
    if (c === undefined) unknown.add(v);
    return c;
  };
  const codeOrNo = (v: unknown) => code(v) ?? KC_NO;

  const uidDigits = /"uid"\s*:\s*(\d+)/.exec(text)?.[1];
  const otherKeyboard =
    target.uid !== undefined &&
    uidDigits !== undefined &&
    uidDigits !== "0" &&
    uidDigits !== uidToDecimal(target.uid);

  const keymap: VilImport["keymap"] = [];
  const layout = doc.layout as unknown[][][];
  if (layout.length > target.layerCount) {
    skipped.push(
      `Layers ${target.layerCount} and up (this keyboard has ${target.layerCount})`,
    );
  }
  layout.slice(0, target.layerCount).forEach((rows, layer) =>
    rows?.slice(0, target.rows).forEach((cols, row) =>
      cols?.slice(0, target.cols).forEach((v, col) => {
        const c = code(v);
        if (c !== undefined) keymap.push({ layer, row, col, code: c });
      }),
    ),
  );

  const fit = <T>(
    list: T[] | undefined,
    count: number,
    what: string,
  ): T[] | undefined => {
    if (!list) return undefined;
    if (list.length > count)
      skipped.push(`${what} ${count} and up (this keyboard has ${count})`);
    return list.slice(0, count);
  };

  const tapDances = fit(
    (doc.tap_dance as unknown[][] | undefined)?.map((t) => ({
      onTap: codeOrNo(t[0]),
      onHold: codeOrNo(t[1]),
      onDoubleTap: codeOrNo(t[2]),
      onTapHold: codeOrNo(t[3]),
      tappingTerm: typeof t[4] === "number" ? t[4] : 200,
    })),
    target.tapDanceCount,
    "Tap dances",
  );
  const combos = fit(
    (doc.combo as unknown[][] | undefined)?.map((c) => ({
      input: [
        codeOrNo(c[0]),
        codeOrNo(c[1]),
        codeOrNo(c[2]),
        codeOrNo(c[3]),
      ] as VialComboEntry["input"],
      output: codeOrNo(c[4]),
    })),
    target.comboCount,
    "Combos",
  );
  const keyOverrides = fit(
    (doc.key_override as Array<Record<string, unknown>> | undefined)?.map(
      (o) => ({
        trigger: codeOrNo(o.trigger),
        replacement: codeOrNo(o.replacement),
        layers: Number(o.layers ?? 0xffff) & 0xffff,
        triggerMods: Number(o.trigger_mods ?? 0) & 0xff,
        negativeModMask: Number(o.negative_mod_mask ?? 0) & 0xff,
        suppressedMods: Number(o.suppressed_mods ?? 0) & 0xff,
        options: Number(o.options ?? 0) & 0xff,
      }),
    ),
    target.keyOverrideCount,
    "Key overrides",
  );
  const macros = fit(
    (doc.macro as unknown[][][] | undefined)?.map((m) => {
      const steps: MacroStep[] = [];
      for (const a of m ?? []) {
        const [kind, ...args] = a as [string, ...unknown[]];
        if (kind === "text")
          steps.push({ action: "string", text: String(args[0] ?? "") });
        else if (kind === "delay")
          steps.push({ action: "delay", ms: Number(args[0]) || 0 });
        else if (kind === "tap" || kind === "down" || kind === "up") {
          for (const k of args) {
            const c = code(k);
            if (c !== undefined) steps.push({ action: kind, keycode: c });
          }
        }
      }
      return steps;
    }),
    target.macroCount,
    "Macros",
  );

  let settings: Record<number, number> | undefined;
  if (doc.settings && typeof doc.settings === "object") {
    settings = {};
    const missing: number[] = [];
    for (const [k, v] of Object.entries(
      doc.settings as Record<string, unknown>,
    )) {
      const id = Number(k);
      if (!target.settingIds.has(id)) missing.push(id);
      else if (typeof v === "number") settings[id] = v;
    }
    if (missing.length)
      skipped.push(`QMK Settings this firmware lacks (${missing.join(", ")})`);
  }

  if (unknown.size)
    skipped.push(
      `Unknown keycodes, left empty: ${[...unknown].slice(0, 5).join(", ")}`,
    );

  return {
    keymap,
    layoutOptions:
      typeof doc.layout_options === "number" ? doc.layout_options : undefined,
    macros,
    tapDances,
    combos,
    keyOverrides,
    settings,
    otherKeyboard,
    skipped,
  };
}
