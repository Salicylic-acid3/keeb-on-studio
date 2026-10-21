/**
 * The About page, reachable before a keyboard is connected: what the app
 * does, which keyboards it is for, and the Q&A.
 *
 * Someone who arrived without a keyboard -- deciding whether to buy one, or
 * sent here by a link -- can read it from the top screen's guide. ZMK and
 * QMK have a page each (/about and /qmk/about), switched the same way as
 * the top page and the downloads (ZMK / QMK at the top right): the two
 * kinds of keyboard differ in what the app can do for them and in which
 * keyboards are supported.
 */
import { FirmwareToggle } from "../components/FirmwareToggle";
import { StandaloneFrame } from "../components/StandaloneFrame";
import type { Firmware } from "../lib/firmware";
import { QmkAboutContent } from "../qmk/pages/QmkAboutContent";
import { HomePage } from "./HomePage";

export const ABOUT_PATH = "/about";
/** The QMK (Vial) keyboards' About page. */
export const QMK_ABOUT_PATH = "/qmk/about";

export function AboutPage({
  onBack,
  firmware = "zmk",
  onFirmwareChange,
  onShowDownloads,
}: {
  onBack: () => void;
  firmware?: Firmware;
  onFirmwareChange?: (firmware: Firmware) => void;
  /** Opens the QMK firmware downloads (the QMK page links to them). */
  onShowDownloads?: () => void;
}) {
  const toggle = onFirmwareChange ? (
    <FirmwareToggle value={firmware} onChange={onFirmwareChange} />
  ) : undefined;
  return (
    <StandaloneFrame onBack={onBack}>
      {firmware === "qmk" ? (
        <QmkAboutContent
          headerAside={toggle}
          onShowDownloads={onShowDownloads}
        />
      ) : (
        <HomePage headerAside={toggle} />
      )}
    </StandaloneFrame>
  );
}
