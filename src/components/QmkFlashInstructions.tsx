/**
 * How to flash the QMK (Vial) keyboards: every one takes a .uf2 copied onto
 * a drive. RP2040 boards show RPI-RP2 (their boot ROM); STM32G0 boards show
 * KEEBONBOOT (the TinyUF2 bootloader). Keeb-On! Studio can do all of it from
 * the Settings tab; this is the by-hand way.
 */
import { useLanguage } from "../hooks/useLanguage";

export function QmkFlashInstructions() {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <ol className="list-outside list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-muted)]">
        <li>{t("Download the .uf2 file for your keyboard below.")}</li>
        <li>
          {t(
            "Put the keyboard in its bootloader. It appears as a USB drive: RPI-RP2, or KEEBONBOOT on ClickBoard Tenkey, EzTenkey, EzTenkeyMX and WzTwenty STM.",
          )}
          <ul className="mt-1 list-outside list-disc space-y-1 pl-5">
            <li>
              {t(
                "Hold the top-left key while plugging in, or press a key set to Bootloader (QK_BOOT).",
              )}
            </li>
            <li>
              {t(
                "RP2040 keyboards: double-tapping the reset switch works too.",
              )}
            </li>
          </ul>
        </li>
        <li>
          {t(
            "Copy the .uf2 file onto that drive. The keyboard writes it and restarts on its own, and the drive disappears — that is normal, not an error.",
          )}
        </li>
      </ol>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "Or let Keeb-On! Studio do it: connect the keyboard on the QMK side and use Update firmware on the Settings tab.",
        )}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "These are the Keeb-On! Studio builds: Vial with the OS switching. They also work with Vial itself.",
        )}
      </p>
    </div>
  );
}
