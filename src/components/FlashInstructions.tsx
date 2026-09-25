/**
 * How to flash a .uf2: the same four steps wherever firmware is offered.
 *
 * Shown on the Firmware tab and on the splash screen's guide, so someone who
 * downloaded firmware before ever connecting gets the same instructions as
 * someone who found it inside the app. One component, so the two never drift.
 */
import { useLanguage } from "../hooks/useLanguage";

export function FlashInstructions({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <div className={className}>
      <ol className="list-outside list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-muted)]">
        <li>{t("Download the .uf2 file for your keyboard below.")}</li>
        <li>
          {t(
            "Connect the keyboard over USB and double-tap its reset switch. It restarts into the bootloader and appears as a USB drive.",
          )}
        </li>
        <li>
          {t(
            "Copy the .uf2 file onto that drive. The keyboard writes it and restarts on its own, and the drive disappears — that is normal, not an error.",
          )}
        </li>
        <li>
          {t(
            "On a split keyboard, repeat for the other half: each half runs its own firmware.",
          )}
        </li>
      </ol>
      <p className="mt-4 text-xs text-[var(--color-text-muted)]">
        {t(
          "If Bluetooth misbehaves after an update, unpair the keyboard on the host and pair it again.",
        )}
      </p>
    </div>
  );
}
