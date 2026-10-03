import { layerGroups, relayerKeycode } from "../osBlocks";
import { parseKeycode, keycodeToText } from "../keycodes/qmkKeycode";
import type { VialDefinition } from "../vial/definition";

const definition = {
  keebOn: {
    osProtocol: 1,
    osBlocks: [
      { id: "A", layers: [0, 1, 2, 3] },
      { id: "B", layers: [4, 5, 6, 7] },
      { id: "C", layers: [8, 9, 10, 11] },
    ],
  },
} as unknown as VialDefinition;

const os = {
  protocol: 1,
  detectedOs: 3,
  mode: 0,
  activeBlock: 1,
  blocks: [0, 1, 0, 0] as [number, number, number, number],
  layersPerBlock: 4,
  blockCount: 3,
  previewBlock: null,
};

describe("osBlocks", () => {
  test("groups layers by block and names the OSes using each", () => {
    const groups = layerGroups(definition, 12, os);
    expect(groups.map((g) => g.targets)).toEqual([
      ["windows", "linux", "other"],
      ["macos"],
      [],
    ]);
    expect(groups[2].layers).toEqual([8, 9, 10, 11]);
  });

  test("falls back to a flat list without the module", () => {
    const groups = layerGroups(definition, 12, null);
    expect(groups).toHaveLength(1);
    expect(groups[0].layers).toHaveLength(12);
  });

  test("renumbers layer keys when copying between blocks", () => {
    const [a, b] = layerGroups(definition, 12, os);
    const moved = (text: string) =>
      keycodeToText(relayerKeycode(parseKeycode(text)!, a, b));
    expect(moved("MO(1)")).toBe("MO(5)");
    expect(moved("LT(3,KC_SPC)")).toBe("LT(7,KC_SPC)");
    expect(moved("TG(2)")).toBe("TG(6)");
    expect(moved("LM(1,MOD_LCTL)")).toBe("LM(5,MOD_LCTL)");
    expect(moved("KC_A")).toBe("KC_A");
    expect(moved("MO(9)")).toBe("MO(9)"); // outside the source block
  });
});
