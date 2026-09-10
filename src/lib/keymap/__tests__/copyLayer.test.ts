/**
 * Two things here are worth guarding.
 *
 * Which keys get written: each one is its own RPC round trip, so sending the
 * keys that already match turns a moment into a wait over BLE for no change
 * at all.
 *
 * How many of them destroy something: the confirmation the user sees is built
 * from that number, and a wrong one either nags about nothing or quietly eats
 * work they did on the layer.
 */
import {
  findBaseLayer,
  findTransparentBehaviorId,
  isAltBaseLayer,
  planCopyFromBase,
  type CopyableLayer,
} from "../copyLayer";
import type { BehaviorDefinition } from "../../../hooks/useKeymap";

const TRANS = 35;
const KP = 10;

function kp(code: number) {
  return { behaviorId: KP, param1: code, param2: 0 };
}
const trans = { behaviorId: TRANS, param1: 0, param2: 0 };

function layer(
  name: string,
  bindings: CopyableLayer["bindings"],
): CopyableLayer {
  return { id: 0, name, bindings };
}

describe("choosing the layers", () => {
  it("offers the copy on Alt Base and nowhere else", () => {
    expect(isAltBaseLayer({ name: "Alt Base" })).toBe(true);
    expect(isAltBaseLayer({ name: "Base" })).toBe(false);
    expect(isAltBaseLayer({ name: "Lower" })).toBe(false);
    // A symbol layer full of transparent keys is transparent on purpose.
    expect(isAltBaseLayer({ name: "" })).toBe(false);
    expect(isAltBaseLayer(null)).toBe(false);
  });

  it("copies from the layer named Base", () => {
    const layers = [{ name: "Drag" }, { name: "Base" }];
    expect(findBaseLayer(layers)?.name).toBe("Base");
  });

  it("falls back to the first layer when nothing is named Base", () => {
    // Layer names are editable, and the first layer is the base one by
    // definition — the device resolves a key there last.
    const layers = [{ name: "ベース" }, { name: "Alt Base" }];
    expect(findBaseLayer(layers)?.name).toBe("ベース");
  });

  it("finds transparent by name, since ids are device-local", () => {
    const behaviors = new Map<number, BehaviorDefinition>([
      [10, { displayName: "Key Press" } as BehaviorDefinition],
      [TRANS, { displayName: "Transparent" } as BehaviorDefinition],
    ]);
    expect(findTransparentBehaviorId(behaviors)).toBe(TRANS);
    expect(findTransparentBehaviorId(new Map())).toBeNull();
  });
});

describe("planning the copy", () => {
  it("fills a transparent layer without calling it an overwrite", () => {
    // The normal case: Alt Base as the device ships it.
    const plan = planCopyFromBase(
      layer("Base", [kp(4), kp(5), kp(6)]),
      layer("Alt Base", [trans, trans, trans]),
      TRANS,
    );

    expect(plan.writes.map((w) => w.keyPosition)).toEqual([0, 1, 2]);
    expect(plan.overwrites).toBe(0);
    expect(plan.unchanged).toBe(0);
  });

  it("leaves out keys that already match", () => {
    // Every write is a round trip. Re-sending what is already there is the
    // difference between a moment and a wait over BLE.
    const plan = planCopyFromBase(
      layer("Base", [kp(4), kp(5), kp(6)]),
      layer("Alt Base", [kp(4), trans, kp(6)]),
      TRANS,
    );

    expect(plan.writes.map((w) => w.keyPosition)).toEqual([1]);
    expect(plan.unchanged).toBe(2);
  });

  it("counts the keys the user actually configured", () => {
    // This number is what the confirmation says out loud.
    const plan = planCopyFromBase(
      layer("Base", [kp(4), kp(5), kp(6)]),
      layer("Alt Base", [trans, kp(99), kp(98)]),
      TRANS,
    );

    expect(plan.overwrites).toBe(2);
    expect(plan.writes).toHaveLength(3);
  });

  it("treats every replacement as an overwrite when transparent is unknown", () => {
    // Erring toward asking: better a confirmation nobody needed than work
    // discarded without one.
    const plan = planCopyFromBase(
      layer("Base", [kp(4), kp(5)]),
      layer("Alt Base", [trans, trans]),
      null,
    );

    expect(plan.overwrites).toBe(2);
  });

  it("stops at the shorter layer", () => {
    // Writing past the end would be rejected per key by the device, one
    // failed round trip at a time.
    const plan = planCopyFromBase(
      layer("Base", [kp(4), kp(5), kp(6)]),
      layer("Alt Base", [trans, trans]),
      TRANS,
    );

    expect(plan.writes.map((w) => w.keyPosition)).toEqual([0, 1]);
  });

  it("copies the binding's parameters, not just the behavior", () => {
    const plan = planCopyFromBase(
      layer("Base", [{ behaviorId: 29, param1: 2, param2: 0x2c }]),
      layer("Alt Base", [trans]),
      TRANS,
    );

    expect(plan.writes[0].binding).toEqual({
      behaviorId: 29,
      param1: 2,
      param2: 0x2c,
    });
  });

  it("has nothing to do when the layers already agree", () => {
    const plan = planCopyFromBase(
      layer("Base", [kp(4), kp(5)]),
      layer("Alt Base", [kp(4), kp(5)]),
      TRANS,
    );

    expect(plan.writes).toEqual([]);
    expect(plan.unchanged).toBe(2);
  });
});
