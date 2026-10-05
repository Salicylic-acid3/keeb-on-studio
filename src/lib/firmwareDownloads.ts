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
 * publishes each keyboard's multi-os build as `<keyboard folder>.uf2`.
 * The asset names are the folder names, so a renamed folder needs renaming
 * here too.
 *
 * Every board takes a .uf2 copied onto a drive: RP2040 boards show up as
 * RPI-RP2 (their boot ROM), STM32G0 boards as KEEBONBOOT (the TinyUF2
 * bootloader, see vial-qmk bootloaders/). STM32G0 boards made before that
 * bootloader have none yet: they install it once over the chip's own DFU,
 * or keep taking `<keyboard folder>-dfu.bin` that way.
 */
export const QMK_FIRMWARE_REPO = "Salicylic-acid3/vial-qmk";

export type QmkChip = "rp2040" | "stm32g0";

export interface QmkFirmware {
  /** Product name, shown as-is. */
  name: string;
  /** keyboards/salicylic_acid3/<asset> */
  asset: string;
  ext: FirmwareExt;
  /** The product line it belongs to, for the top page's short list. */
  series: string;
  chip: QmkChip;
}

/** TinyUF2 for the STM32G0 boards, published with every release. */
export const QMK_G0_BOOTLOADER_ASSET = "tinyuf2-stm32g0b1";

/** UF2 family ids (microsoft/uf2 uf2families): what each bootloader takes. */
export const UF2_FAMILY: Record<QmkChip, number> = {
  rp2040: 0xe48bff56,
  stm32g0: 0x300f5633,
};

/** The Board-ID line of each bootloader drive's INFO_UF2.TXT. */
export const UF2_BOARD_ID: Record<QmkChip, string> = {
  rp2040: "RPI-RP2",
  stm32g0: "STM32G0B1-Keeb-On",
};

/** The drive name each bootloader shows. */
export const UF2_DRIVE_NAME: Record<QmkChip, string> = {
  rp2040: "RPI-RP2",
  stm32g0: "KEEBONBOOT",
};

const rp = (name: string, asset: string, series = name): QmkFirmware => ({
  name,
  asset,
  ext: "uf2",
  series,
  chip: "rp2040",
});
const g0 = (name: string, asset: string, series = name): QmkFirmware => ({
  name,
  asset,
  ext: "uf2",
  series,
  chip: "stm32g0",
});

export const QMK_FIRMWARE: QmkFirmware[] = [
  rp("AtEighty JP", "ateighty_jp", "AtEighty"),
  rp("AtEighty US", "ateighty_us", "AtEighty"),
  rp("BeThirty Ortho", "bethirty_ortho", "BeThirty"),
  rp("BeThirty QAZ", "bethirty_qaz", "BeThirty"),
  rp("ClickBoard CyberMini", "clickboard_cybermini"),
  rp("ClickBoard ErgoMini", "clickboard_ergomini"),
  rp("ClickBoard Ortho", "clickboard_ortho"),
  g0("ClickBoard Tenkey", "clickboard_tenkey"),
  g0("EzTenkey", "eztenkey"),
  g0("EzTenkeyMX", "eztenkey_mx"),
  rp("Focus40 JP", "focus40_jp", "Focus40"),
  rp("Focus40 Ortho", "focus40_ortho", "Focus40"),
  rp("Focus60 EN", "focus60_en", "Focus60"),
  rp("GoForty JP", "goforty_jp", "GoForty"),
  rp("GoForty Ortho", "goforty_ortho", "GoForty"),
  rp("GoForty RS", "goforty_rs", "GoForty"),
  rp("GoForty US", "goforty_us", "GoForty"),
  rp("InSixty EN", "insixty_en", "InSixty"),
  rp("InSixty JP", "insixty_jp", "InSixty"),
  rp("InSixty MX JP", "insixty_mxjp", "InSixty"),
  rp("Tenkey of Tenkey", "tenkey_of_tenkey"),
  rp("ToSeventy JP", "toseventy_jp", "ToSeventy"),
  rp("ToSeventy Ortho", "toseventy_ortho", "ToSeventy"),
  rp("ToSeventy US", "toseventy_us", "ToSeventy"),
  rp("WzTwenty", "wztwenty", "WzTwenty"),
  g0("WzTwenty STM", "wztwenty_stm", "WzTwenty"),
];

/** The firmware for a keyboard, by its vial.json name (= folder name). */
export function qmkFirmwareFor(board: string): QmkFirmware | undefined {
  return QMK_FIRMWARE.find((f) => f.asset === board);
}

/** Every file the release has that the app may fetch (see worker /api/firmware). */
export function qmkReleaseFileNames(): string[] {
  return [
    ...QMK_FIRMWARE.map((f) => `${f.asset}.${f.ext}`),
    ...QMK_FIRMWARE.filter((f) => f.chip === "stm32g0").map(
      (f) => `${f.asset}-dfu.bin`,
    ),
    `${QMK_G0_BOOTLOADER_ASSET}.bin`,
  ];
}

/** The repository's releases page, for changelogs and older versions. */
export function firmwareReleasesUrl(repo: string): string {
  return `https://github.com/${repo}/releases`;
}

/**
 * The QMK product lines, for the line under the top page's switch: derived
 * from the list above, so a keyboard added there shows up here as well.
 */
export const QMK_SERIES: string[] = [
  ...new Set(QMK_FIRMWARE.map((f) => f.series)),
];
