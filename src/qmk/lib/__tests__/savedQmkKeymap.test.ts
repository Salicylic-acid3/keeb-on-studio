import {
  parseQmkKeymapFile,
  toQmkKeymapFile,
  vilText,
} from "../savedQmkKeymap";
import {
  parseQmkShareCode,
  qmkShareCodeFromHash,
  qmkShareUrlFor,
  toQmkShareCode,
} from "../qmkShare";

const vil = `{"version": 1, "uid": 18446744073709551615, "layout": [[["KC_A", "KC_B", -1]]], "macro": [[["text", "hi"]]], "settings": {"7": 200}}`;

describe("QMK saved keymaps", () => {
  test("a bare Vial .vil becomes a keymap named after its file, uid kept exactly", () => {
    const r = parseQmkKeymapFile(vil, {
      fallbackName: "mine",
      board: "goforty_jp",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.keymap).toMatchObject({
      name: "mine",
      board: "goforty_jp",
      uid: "18446744073709551615",
    });
    // A 64-bit uid would be rounded by JSON.parse; it is put back as written.
    expect(vilText(r.keymap)).toContain('"uid":18446744073709551615');
  });

  test("our own file round-trips; unknown boards and junk are refused", () => {
    const r = parseQmkKeymapFile(vil, { fallbackName: "x", board: "eztenkey" });
    if (!r.ok) throw new Error();
    const again = parseQmkKeymapFile(
      JSON.stringify(toQmkKeymapFile({ ...r.keymap, name: "温泉" })),
    );
    expect(again).toMatchObject({
      ok: true,
      keymap: { name: "温泉", board: "eztenkey", uid: r.keymap.uid },
    });
    expect(parseQmkKeymapFile(vil, { board: "ergotrack" })).toMatchObject({
      ok: false,
      reason: "unsupported-board",
    });
    expect(parseQmkKeymapFile("{")).toMatchObject({
      ok: false,
      reason: "not-json",
    });
    expect(
      parseQmkKeymapFile('{"layout": [[["' + "x".repeat(100) + '"]]]}', {
        board: "eztenkey",
      }),
    ).toMatchObject({ ok: false });
  });

  test("links carry the keymap in the fragment and read back the same", async () => {
    const r = parseQmkKeymapFile(vil, {
      fallbackName: "share me",
      board: "goforty_us",
    });
    if (!r.ok) throw new Error();
    const url = qmkShareUrlFor(
      await toQmkShareCode(r.keymap),
      "https://keeb-on.studio/qmk",
    );
    expect(url.startsWith("https://keeb-on.studio/qmk#q=")).toBe(true);
    const back = await parseQmkShareCode(
      qmkShareCodeFromHash(new URL(url).hash)!,
    );
    expect(back).toEqual({ ok: true, keymap: r.keymap });
    expect(await parseQmkShareCode("!!!")).toMatchObject({
      ok: false,
      reason: "not-a-share-code",
    });
  });
});
