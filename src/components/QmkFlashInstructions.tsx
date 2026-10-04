/**
 * How to flash the QMK (Vial) keyboards: .uf2 boards the same way as the
 * ZMK ones (a drive appears, copy the file), .bin boards over DFU.
 */
import { useLanguage } from "../hooks/useLanguage";

export function QmkFlashInstructions() {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
          {t("Keyboards with a .uf2 file")}
        </h3>
        <ol className="list-outside list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-muted)]">
          <li>{t("Download the .uf2 file for your keyboard below.")}</li>
          <li>
            {t(
              "Double-tap the reset switch, or press a key set to Bootloader (QK_BOOT). The keyboard appears as a USB drive named RPI-RP2.",
            )}
          </li>
          <li>
            {t(
              "Copy the .uf2 file onto that drive. The keyboard writes it and restarts on its own, and the drive disappears — that is normal, not an error.",
            )}
          </li>
        </ol>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
          {t("Keyboards with a .bin file")}
        </h3>
        <ol className="list-outside list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-muted)]">
          <li>{t("Download the .bin file for your keyboard below.")}</li>
          <li>
            {t(
              "Press a key set to Bootloader (QK_BOOT), or hold the BOOT switch while plugging in. The keyboard switches to firmware update mode (DFU).",
            )}
          </li>
          <li>
            {t(
              "Write the .bin file with QMK Toolbox: open the file, then press Flash.",
            )}
          </li>
        </ol>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "These are the Keeb-On! Studio builds: Vial with the OS switching. They also work with Vial itself.",
        )}
      </p>
    </div>
  );
}
