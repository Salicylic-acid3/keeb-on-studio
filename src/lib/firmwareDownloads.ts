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
export function firmwareDownloadUrl(repo: string, asset: string): string {
  return `https://github.com/${repo}/releases/latest/download/${asset}.uf2`;
}

/** The repository's releases page, for changelogs and older versions. */
export function firmwareReleasesUrl(repo: string): string {
  return `https://github.com/${repo}/releases`;
}
