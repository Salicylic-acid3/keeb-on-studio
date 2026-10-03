/**
 * Generate the QMK keycode table for the QMK (Vial) side of Keeb-On! Studio.
 *
 * Reads `quantum/keycodes.h` from a QMK / vial-qmk checkout and writes every
 * `NAME = 0xNNNN` entry of `enum qk_keycode_defines`, plus the `KC_TRNS = KC_TRANSPARENT`
 * style aliases in the same enum, to a generated TypeScript module.
 *
 * Usage:
 *   node --experimental-strip-types scripts/generateQmkKeycodes.ts /path/to/vial-qmk/quantum/keycodes.h
 *
 * The table is pinned to Vial protocol 6 (QMK 0.22-era numbering), which is
 * what every Keeb-On! QMK keyboard ships. Re-run when the firmware fork moves.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const headerPath = process.argv[2];
if (!headerPath) {
  console.error("usage: generateQmkKeycodes.ts <path to quantum/keycodes.h>");
  process.exit(1);
}
const source = readFileSync(headerPath, "utf8");

const enumStart = source.indexOf("enum qk_keycode_defines {");
const enumEnd = source.indexOf("};", enumStart);
const enumBody = source.slice(enumStart, enumEnd);

const codes: Array<{ name: string; code: number }> = [];
for (const match of enumBody.matchAll(
  /^\s+([A-Z0-9_]+)\s*=\s*0x([0-9A-Fa-f]+),?/gm,
)) {
  codes.push({ name: match[1], code: parseInt(match[2], 16) });
}

// `KC_TRNS = KC_TRANSPARENT,` style aliases inside the same enum.
const byName = new Map(codes.map((c) => [c.name, c.code]));
const aliases: Array<{ alias: string; name: string }> = [];
for (const match of enumBody.matchAll(
  /^\s+([A-Z0-9_]+)\s*=\s*([A-Z][A-Z0-9_]+),?/gm,
)) {
  if (byName.has(match[2]) && !byName.has(match[1])) {
    aliases.push({ alias: match[1], name: match[2] });
  }
}

const lines = [
  "// GENERATED FILE — do not edit. See scripts/generateQmkKeycodes.ts",
  "// Source: quantum/keycodes.h (Vial protocol 6)",
  "",
  "/** Every named keycode: canonical name -> 16-bit code. */",
  "export const QMK_KEYCODES: ReadonlyArray<readonly [name: string, code: number]> = [",
  ...codes.map(
    (c) =>
      `  ["${c.name}", 0x${c.code.toString(16).toUpperCase().padStart(4, "0")}],`,
  ),
  "];",
  "",
  "/** Short aliases (KC_TRNS, KC_ENT, ...) -> canonical name. */",
  "export const QMK_KEYCODE_ALIASES: ReadonlyArray<readonly [alias: string, name: string]> = [",
  ...aliases.map((a) => `  ["${a.alias}", "${a.name}"],`),
  "];",
  "",
];
const outPath = resolve("src/qmk/lib/keycodes/qmkKeycodesV6.generated.ts");
writeFileSync(outPath, lines.join("\n"));
console.log(
  `${codes.length} keycodes, ${aliases.length} aliases -> ${outPath}`,
);
