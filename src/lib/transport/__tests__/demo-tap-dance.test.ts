/**
 * Tap dance in demo mode, end to end through the settings handler.
 *
 * Demo mode is the only place someone can try tap dance before owning a
 * keyboard, which is the decision it exists to help with -- so the paths
 * tested here are the ones a person actually walks: open a fresh slot, add
 * the first tap, add another, take one back.
 *
 * Growing an array is worth testing rather than assuming. An array is stored
 * as one setting per active element, so a slot holding nothing lists nothing,
 * and every element carries the array's length -- which means appending has
 * to invent a row from a bare reference and then re-stamp the rows that were
 * already there.
 */
import { CustomSettingsHandler } from "../demo-custom-settings";
import { createTapDanceSettings } from "../demo-tap-dance";
import {
  Notification,
  Request,
  SettingWriteMode,
  type Setting,
} from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

const SETTINGS_SUBSYSTEM = 1;
const TAP_DANCE_SUBSYSTEM = 16;

function handlerWithTapDance() {
  return new CustomSettingsHandler(
    SETTINGS_SUBSYSTEM,
    createTapDanceSettings(TAP_DANCE_SUBSYSTEM),
  );
}

/** Everything the tap dance subsystem would list, as the app would see it. */
function listTapDance(handler: CustomSettingsHandler): Promise<Setting[]> {
  const listed: Setting[] = [];
  handler.notify((payload) => {
    const setting = Notification.decode(payload).setting?.setting;
    if (setting) listed.push(setting);
  });
  handler.process(
    Request.create({
      listSettings: {
        scope: {
          customSubsystemIndex: TAP_DANCE_SUBSYSTEM,
          source: 0xffffffff,
        },
      },
    }),
  );
  return new Promise((resolve) => setTimeout(() => resolve(listed), 250));
}

function tapsRef(slot: number) {
  return {
    customSubsystemIndex: TAP_DANCE_SUBSYSTEM,
    key: `tap_dance${slot}/taps`,
    source: 0,
  };
}

function pushTap(
  handler: CustomSettingsHandler,
  slot: number,
  behaviorId: number,
) {
  return handler.process(
    Request.create({
      pushBackArray: {
        setting: tapsRef(slot),
        value: { behaviorValue: { behaviorId, param1: 0, param2: 0 } },
        mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
      },
    }),
  );
}

function popTap(handler: CustomSettingsHandler, slot: number) {
  return handler.process(
    Request.create({
      popBackArray: {
        setting: tapsRef(slot),
        mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
      },
    }),
  );
}

function elementsOf(listed: Setting[], slot: number) {
  return listed
    .filter((s) => s.key === `tap_dance${slot}/taps`)
    .sort(
      (a, b) =>
        (a.value?.arrayValue?.index ?? 0) - (b.value?.arrayValue?.index ?? 0),
    );
}

describe("tap dance in demo mode", () => {
  it("gives every slot a term, including the ones holding no taps", async () => {
    // The term is how a slot with an empty taps array announces that it
    // exists at all; without it a fresh slot would be invisible.
    const listed = await listTapDance(handlerWithTapDance());
    const terms = listed.filter((s) => /^tap_dance\d+\/term$/.test(s.key));
    expect(terms).toHaveLength(4);
  });

  it("lists no taps setting for a slot that holds none", async () => {
    const listed = await listTapDance(handlerWithTapDance());
    expect(elementsOf(listed, 2)).toHaveLength(0);
  });

  it("publishes the capacity as its own setting", async () => {
    // An element's `size` is the current length, so the ceiling has to come
    // from somewhere else or the app can never tell a full slot from a
    // roomy one.
    const listed = await listTapDance(handlerWithTapDance());
    const max = listed.find((s) => s.key === "max_taps");
    expect(max?.value?.int32Value).toBe(3);
  });

  it("adds the first tap to an empty slot", async () => {
    const handler = handlerWithTapDance();
    expect(pushTap(handler, 3, 10).error).toBeUndefined();

    const taps = elementsOf(await listTapDance(handler), 3);
    expect(taps).toHaveLength(1);
    expect(taps[0].value?.arrayValue?.index).toBe(0);
    expect(taps[0].value?.arrayValue?.size).toBe(1);
    expect(taps[0].value?.arrayValue?.value?.behaviorValue?.behaviorId).toBe(
      10,
    );
  });

  it("re-stamps the length onto the taps that were already there", async () => {
    // Every element carries the array's length. Leaving the older rows at
    // the old number gives one array two lengths, and whichever row the app
    // reads first wins.
    const handler = handlerWithTapDance();
    pushTap(handler, 1, 11);

    const taps = elementsOf(await listTapDance(handler), 1);
    expect(taps).toHaveLength(2);
    expect(taps.map((t) => t.value?.arrayValue?.size)).toEqual([2, 2]);
    expect(taps.map((t) => t.value?.arrayValue?.index)).toEqual([0, 1]);
  });

  it("takes the last tap back", async () => {
    const handler = handlerWithTapDance();
    expect(popTap(handler, 0).error).toBeUndefined();

    const taps = elementsOf(await listTapDance(handler), 0);
    expect(taps).toHaveLength(1);
    expect(taps[0].value?.arrayValue?.size).toBe(1);
  });

  it("refuses to shorten a slot that is already empty", () => {
    expect(popTap(handlerWithTapDance(), 3).error).toBeDefined();
  });

  it("keeps tap dance out of the demo's own settings section", async () => {
    // The rows live in this handler but belong to another subsystem, so a
    // scoped list for the demo's sample settings must not pick them up.
    const handler = handlerWithTapDance();
    const listed: Setting[] = [];
    handler.notify((payload) => {
      const setting = Notification.decode(payload).setting?.setting;
      if (setting) listed.push(setting);
    });
    handler.process(
      Request.create({
        listSettings: {
          scope: {
            customSubsystemIndex: SETTINGS_SUBSYSTEM,
            source: 0xffffffff,
          },
        },
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(listed.some((s) => s.key.startsWith("tap_dance"))).toBe(false);
  });
});
