/**
 * Where to get firmware for the keyboards this app supports.
 *
 * The download URLs are GitHub's "latest release" permalinks
 * (`/releases/latest/download/<asset>`), which need no API call: GitHub
 * redirects them to whichever release is newest, so this list stays correct as
 * new firmware ships and the page keeps working when GitHub's API is rate
 * limited or unreachable.
 *
 * That relies on asset names staying identical between releases. They come
 * from the `artifact-name` values in each firmware repo's `build.yaml`, which
 * the ZMK build workflow uses verbatim -- so an asset renamed there must be
 * renamed here too, or the link 404s.
 */

export interface FirmwareFile {
  /**
   * Release asset name, without the extension. Also the name of the file the
   * user drops onto the bootloader drive.
   */
  asset: string;
  /** English label (a translation key); which half, or what it is for. */
  label: string;
  /** English one-liner (a translation key) shown under the label. */
  description: string;
  /**
   * True for firmware that is not part of normal use: flashed to recover a
   * keyboard rather than to run it. Shown apart so it can't be mistaken for
   * the firmware you actually want.
   */
  recovery?: boolean;
}

export interface FirmwareBoard {
  /** Product name, shown as-is. */
  name: string;
  /** `owner/repo` on GitHub. */
  repo: string;
  /** Split keyboards have to be flashed twice, once per half. */
  split: boolean;
  files: FirmwareFile[];
}

const SETTINGS_RESET: FirmwareFile = {
  asset: "settings_reset",
  label: "Settings reset",
  description:
    "Erases stored settings, including Bluetooth pairings. Flash this only to recover, then flash the normal firmware again.",
  recovery: true,
};

export const FIRMWARE_BOARDS: FirmwareBoard[] = [
  {
    name: "ClickBoard ErgoTrack",
    repo: "Salicylic-acid3/zmk-keyboard-clickboard-ergotrack",
    split: true,
    files: [
      {
        asset: "clickboard_ergotrack_left",
        label: "Left half",
        description: "Flash this to the left half.",
      },
      {
        asset: "clickboard_ergotrack_right",
        label: "Right half",
        description:
          "Flash this to the right half. This is the half that talks to Keeb-On! Studio.",
      },
      SETTINGS_RESET,
    ],
  },
  {
    name: "GoFortyMax Ortho",
    repo: "Salicylic-acid3/zmk-keyboard-gofortymax-ortho",
    split: false,
    files: [
      {
        asset: "goforty_max",
        label: "Firmware",
        description: "Flash this to the keyboard.",
      },
      SETTINGS_RESET,
    ],
  },
];

/** Permalink to `asset` in the newest release of `repo`. */
export function firmwareDownloadUrl(
  repo: string,
  asset: string,
  ext: FirmwareExt = "uf2",
): string {
  return `https://github.com/${repo}/releases/latest/download/${asset}.${ext}`;
}

export type FirmwareExt = "uf2" | "bin";

/**
 * The QMK (Vial) keyboards. All built from one repository, the vial-qmk
 * fork, whose release workflow (.github/workflows/keebon-firmware.yml)
 * publishes each keyboard's multi-os build as `<keyboard folder>.<ext>`:
 * .uf2 for RP2040 boards (drag onto the drive), .bin for STM32G0 boards
 * (written over DFU). The asset names are the folder names, so a renamed
 * folder needs renaming here too.
 */
export const QMK_FIRMWARE_REPO = "Salicylic-acid3/vial-qmk";

export interface QmkFirmware {
  /** Product name, shown as-is. */
  name: string;
  /** keyboards/salicylic_acid3/<asset> */
  asset: string;
  ext: FirmwareExt;
}

const uf2 = (name: string, asset: string): QmkFirmware => ({
  name,
  asset,
  ext: "uf2",
});
const bin = (name: string, asset: string): QmkFirmware => ({
  name,
  asset,
  ext: "bin",
});

export const QMK_FIRMWARE: QmkFirmware[] = [
  uf2("AtEighty JP", "ateighty_jp"),
  uf2("AtEighty US", "ateighty_us"),
  uf2("BeThirty Ortho", "bethirty_ortho"),
  uf2("BeThirty QAZ", "bethirty_qaz"),
  uf2("ClickBoard CyberMini", "clickboard_cybermini"),
  uf2("ClickBoard ErgoMini", "clickboard_ergomini"),
  uf2("ClickBoard Ortho", "clickboard_ortho"),
  bin("ClickBoard Tenkey", "clickboard_tenkey"),
  bin("EzTenkey", "eztenkey"),
  bin("EzTenkeyMX", "eztenkey_mx"),
  uf2("Focus40 JP", "focus40_jp"),
  uf2("Focus40 Ortho", "focus40_ortho"),
  uf2("Focus60 EN", "focus60_en"),
  uf2("GoForty JP", "goforty_jp"),
  uf2("GoForty Ortho", "goforty_ortho"),
  uf2("GoForty RS", "goforty_rs"),
  uf2("GoForty US", "goforty_us"),
  uf2("InSixty EN", "insixty_en"),
  uf2("InSixty JP", "insixty_jp"),
  uf2("InSixty MX JP", "insixty_mxjp"),
  uf2("Tenkey of Tenkey", "tenkey_of_tenkey"),
  uf2("ToSeventy JP", "toseventy_jp"),
  uf2("ToSeventy Ortho", "toseventy_ortho"),
  uf2("ToSeventy US", "toseventy_us"),
  uf2("WzTwenty", "wztwenty"),
  bin("WzTwenty STM", "wztwenty_stm"),
];

/** The repository's releases page, for changelogs and older versions. */
export function firmwareReleasesUrl(repo: string): string {
  return `https://github.com/${repo}/releases`;
}
