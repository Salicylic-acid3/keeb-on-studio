/**
 * UF2 files and drives, for "Update firmware": check a downloaded .uf2 is
 * whole and meant for this chip before it goes anywhere, and check a drive
 * the person picked is the bootloader before anything is written to it.
 * (microsoft/uf2: 512-byte blocks, magic numbers at the start and end.)
 */
const MAGIC_START0 = 0x0a324655;
const MAGIC_START1 = 0x9e5d5157;
const MAGIC_END = 0x0ab16f30;
const FLAG_FAMILY_ID = 0x00002000;

export type Uf2Check =
  | { ok: true; blocks: number }
  | { ok: false; reason: "not-uf2" | "wrong-chip" };

export function checkUf2(bytes: Uint8Array, family: number): Uf2Check {
  if (bytes.length === 0 || bytes.length % 512 !== 0)
    return { ok: false, reason: "not-uf2" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const blocks = bytes.length / 512;
  for (let i = 0; i < blocks; i++) {
    const o = i * 512;
    if (
      view.getUint32(o, true) !== MAGIC_START0 ||
      view.getUint32(o + 4, true) !== MAGIC_START1 ||
      view.getUint32(o + 508, true) !== MAGIC_END
    ) {
      return { ok: false, reason: "not-uf2" };
    }
    const flags = view.getUint32(o + 8, true);
    if (!(flags & FLAG_FAMILY_ID) || view.getUint32(o + 28, true) !== family) {
      return { ok: false, reason: "wrong-chip" };
    }
  }
  return { ok: true, blocks };
}

/** The Board-ID line of a bootloader drive's INFO_UF2.TXT. */
export function boardIdOf(infoUf2: string): string | null {
  const m = /^Board-ID:\s*(.+?)\s*$/m.exec(infoUf2);
  return m ? m[1] : null;
}
