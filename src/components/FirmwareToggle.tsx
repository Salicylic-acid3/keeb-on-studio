/**
 * ZMK / QMK: the two kinds of keyboard this workshop makes need different
 * connections (Web Serial for ZMK Studio, WebHID for Vial), so the top page
 * has one switch that swaps the whole entrance rather than two sets of
 * buttons. Lives at `/` for ZMK and `/qmk` for QMK so links can point at
 * either side directly.
 */
import { useLanguage } from "../hooks/useLanguage";
import type { Firmware } from "../lib/firmware";

interface FirmwareToggleProps {
  value: Firmware;
  onChange: (firmware: Firmware) => void;
  className?: string;
}

export function FirmwareToggle({
  value,
  onChange,
  className = "",
}: FirmwareToggleProps) {
  const { t } = useLanguage();
  return (
    <div
      role="group"
      aria-label={t("Keyboard firmware")}
      className={`theme-toggle language-toggle !gap-0 !p-0.5 ${className}`}
    >
      {(["zmk", "qmk"] as const).map((fw) => (
        <button
          key={fw}
          type="button"
          onClick={() => onChange(fw)}
          aria-pressed={value === fw}
          title={
            fw === "zmk"
              ? t("ZMK keyboards (wireless)")
              : t("QMK keyboards (Vial)")
          }
          className={`h-full rounded-md px-2.5 text-xs font-medium uppercase leading-none transition-colors ${
            value === fw
              ? "bg-[var(--color-electric)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          }`}
        >
          {fw}
        </button>
      ))}
    </div>
  );
}
