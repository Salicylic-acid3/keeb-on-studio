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

export const DOWNLOADS_PATH = "/downloads";

export function DownloadsPage({ onBack }: { onBack: () => void }) {
  return (
    <StandaloneFrame onBack={onBack}>
      <FirmwarePage />
    </StandaloneFrame>
  );
}
