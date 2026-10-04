/**
 * The Firmware tab, reachable before a keyboard is connected.
 *
 * The splash screen does not offer the .uf2 files directly: the list of
 * keyboards will keep growing, and a row of download buttons per keyboard
 * would crowd the front page. It offers this page instead, which is the
 * same Firmware tab -- every keyboard, the flash steps, the recovery
 * firmware -- on its own path, so it can also be linked to directly.
 */
import { StandaloneFrame } from "../components/StandaloneFrame";
import { FirmwarePage } from "./FirmwarePage";
import type { Firmware } from "../lib/firmware";

export const DOWNLOADS_PATH = "/downloads";
/** The QMK (Vial) keyboards' firmware: its own page, like the QMK side. */
export const QMK_DOWNLOADS_PATH = "/qmk/downloads";

export function DownloadsPage({
  onBack,
  firmware = "zmk",
  onFirmwareChange,
}: {
  onBack: () => void;
  firmware?: Firmware;
  onFirmwareChange?: (firmware: Firmware) => void;
}) {
  return (
    <StandaloneFrame onBack={onBack}>
      <FirmwarePage firmware={firmware} onFirmwareChange={onFirmwareChange} />
    </StandaloneFrame>
  );
}
