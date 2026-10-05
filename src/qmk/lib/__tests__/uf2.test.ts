import { boardIdOf, checkUf2 } from "../uf2";

function block(family: number, magicOk = true): Uint8Array {
  const b = new Uint8Array(512);
  const v = new DataView(b.buffer);
  v.setUint32(0, magicOk ? 0x0a324655 : 1, true);
  v.setUint32(4, 0x9e5d5157, true);
  v.setUint32(8, 0x2000, true);
  v.setUint32(28, family, true);
  v.setUint32(508, 0x0ab16f30, true);
  return b;
}
const join = (...bs: Uint8Array[]) => {
  const out = new Uint8Array(bs.length * 512);
  bs.forEach((b, i) => out.set(b, i * 512));
  return out;
};

describe("UF2", () => {
  test("a whole file for the right chip passes; others do not", () => {
    expect(
      checkUf2(join(block(0x300f5633), block(0x300f5633)), 0x300f5633),
    ).toEqual({ ok: true, blocks: 2 });
    expect(checkUf2(join(block(0xe48bff56)), 0x300f5633)).toEqual({
      ok: false,
      reason: "wrong-chip",
    });
    expect(checkUf2(join(block(0x300f5633, false)), 0x300f5633)).toEqual({
      ok: false,
      reason: "not-uf2",
    });
    expect(checkUf2(new Uint8Array(100), 0x300f5633)).toEqual({
      ok: false,
      reason: "not-uf2",
    });
  });
  test("drive identity from INFO_UF2.TXT", () => {
    expect(
      boardIdOf(
        "UF2 Bootloader v3.0\r\nModel: Raspberry Pi RP2\r\nBoard-ID: RPI-RP2\r\n",
      ),
    ).toBe("RPI-RP2");
    expect(
      boardIdOf(
        "TinyUF2 Bootloader 0.x\nModel: x\nBoard-ID: STM32G0B1-Keeb-On\n",
      ),
    ).toBe("STM32G0B1-Keeb-On");
    expect(boardIdOf("nothing")).toBeNull();
  });
});
