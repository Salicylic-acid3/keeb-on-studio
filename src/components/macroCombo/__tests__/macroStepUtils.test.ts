import { nextMacroName } from "../macroStepUtils";

describe("nextMacroName", () => {
  it("names the first macro after slot 0, as the keymap shows it", () => {
    expect(nextMacroName([])).toBe("Macro 0");
  });

  it("counts up with the slots", () => {
    expect(
      nextMacroName([
        { slot: 0, name: "Macro 0" },
        { slot: 1, name: "Macro 1" },
      ]),
    ).toBe("Macro 2");
  });

  it("follows the slot, not the number of macros", () => {
    // Slot 0 was deleted: the firmware hands it out again.
    expect(
      nextMacroName([
        { slot: 1, name: "Macro 1" },
        { slot: 2, name: "Macro 2" },
      ]),
    ).toBe("Macro 0");
  });

  it("ignores how the other macros are named", () => {
    expect(
      nextMacroName([
        { slot: 0, name: "Hello" },
        { slot: 1, name: "Wait Enter" },
      ]),
    ).toBe("Macro 2");
  });

  it("moves past a name that is already taken", () => {
    // Named by the old rule: slot 0 is "Macro 1". The next macro gets slot 1,
    // but that name is in use.
    expect(nextMacroName([{ slot: 0, name: "Macro 1" }])).toBe("Macro 2");
  });
});
