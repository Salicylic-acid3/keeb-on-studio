/**
 * The case that matters is the first one: a bare keycode where a full HID
 * usage belongs. That is the bug this file was written to stop from hiding in
 * demo mode a second time.
 *
 * The other half of the job is not over-refusing. A demo stricter than the
 * firmware sends someone hunting a fault in a keyboard that is fine, so
 * anything this cannot judge is allowed through deliberately.
 */
import { bindingParamsValid } from "../bindingParams";
import type { BehaviorBindingParametersSet } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

const key: BehaviorBindingParametersSet[] = [
  {
    param1: [
      { name: "Key", hidUsage: { keyboardMax: 255, consumerMax: 4095 } },
    ],
    param2: [],
  },
];

const layerThenKey: BehaviorBindingParametersSet[] = [
  {
    param1: [{ name: "Layer", layerId: {} }],
    param2: [
      { name: "Key", hidUsage: { keyboardMax: 255, consumerMax: 4095 } },
    ],
  },
];

describe("checking a binding's parameters the way the firmware does", () => {
  it("refuses a keycode with no usage page", () => {
    // 0x1A is W's usage id. On its own it is page 0, which is not a page ZMK
    // takes — this is exactly what the bottom keyboard was writing, and
    // exactly what the demo used to accept.
    expect(bindingParamsValid(key, 0x1a, 0)).toBe(false);
  });

  it("accepts the same key once its page is there", () => {
    expect(bindingParamsValid(key, 0x0007001a, 0)).toBe(true);
  });

  it("accepts a consumer key", () => {
    expect(bindingParamsValid(key, 0x000c00b5, 0)).toBe(true); // next track
  });

  it("accepts a key carrying implicit modifiers", () => {
    // LC(A): the modifier lives in bits 24+ and is not part of the page.
    expect(bindingParamsValid(key, 0x01070004, 0)).toBe(true);
  });

  it("refuses a usage id past what the behavior takes", () => {
    expect(
      bindingParamsValid(
        [
          {
            param1: [
              { name: "Key", hidUsage: { keyboardMax: 10, consumerMax: 0 } },
            ],
            param2: [],
          },
        ],
        0x0007001a,
        0,
      ),
    ).toBe(false);
  });

  it("refuses zero where a usage belongs", () => {
    expect(bindingParamsValid(key, 0, 0)).toBe(false);
  });

  it("refuses a second parameter the behavior does not have", () => {
    // A key press takes one. Writing something into param2 means the caller
    // thinks it is talking to a different behavior.
    expect(bindingParamsValid(key, 0x0007001a, 4)).toBe(false);
  });

  it("takes a layer in the slot that wants one", () => {
    // Layer bounds belong to the keymap, so any layer number passes here.
    expect(bindingParamsValid(layerThenKey, 2, 0x0007001a)).toBe(true);
  });

  it("wants both parameters of a two-parameter behavior", () => {
    expect(bindingParamsValid(layerThenKey, 2, 0x1a)).toBe(false);
  });

  it("lets a behavior with no parameters take none", () => {
    // Transparent and none. Anything else in a parameter is a mistake.
    expect(bindingParamsValid([], 0, 0)).toBe(true);
    expect(bindingParamsValid(undefined, 0, 0)).toBe(true);
    expect(bindingParamsValid([], 0x0007001a, 0)).toBe(false);
  });

  it("matches any one of the alternative sets", () => {
    const either: BehaviorBindingParametersSet[] = [
      { param1: [{ name: "Layer", layerId: {} }], param2: [] },
      {
        param1: [
          { name: "Key", hidUsage: { keyboardMax: 255, consumerMax: 4095 } },
        ],
        param2: [],
      },
    ];
    expect(bindingParamsValid(either, 0x0007001a, 0)).toBe(true);
    expect(bindingParamsValid(either, 3, 0)).toBe(true);
  });

  it("allows a description it does not understand", () => {
    // Being stricter than the firmware would send someone looking for a fault
    // in a keyboard that is working.
    expect(
      bindingParamsValid(
        [{ param1: [{ name: "Mystery" }], param2: [] }],
        99,
        0,
      ),
    ).toBe(true);
  });
});
