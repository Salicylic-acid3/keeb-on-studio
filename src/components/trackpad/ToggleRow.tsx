/**
 * One boolean trackpad setting as a labelled switch.
 *
 * Shared by the pinch and scale sections, the way NumberRow is for the
 * integer settings.
 */
import * as Switch from "@radix-ui/react-switch";
import { InfoTip } from "../InfoTip";
import { useLanguage } from "../../hooks/useLanguage";

export function ToggleRow({
  label,
  info,
  checked,
  disagree = false,
  disabled,
  onCheckedChange,
}: {
  label: string;
  info: string;
  checked: boolean;
  /** The two halves hold different values; flipping the switch writes both. */
  disagree?: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <span className="truncate">{label}</span>
          <InfoTip text={info} />
        </span>
        {disagree && (
          <span className="text-xs text-[var(--color-warning)]">
            {t("The halves differ. Flip the switch to write both.")}
          </span>
        )}
      </span>
      <Switch.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="relative h-5 w-9 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors data-[state=checked]:border-[var(--color-electric)] data-[state=checked]:bg-[var(--color-electric)]/30 disabled:opacity-50"
      >
        <Switch.Thumb className="block h-3.5 w-3.5 translate-x-[2px] rounded-full bg-[var(--color-text-muted)] transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-[var(--color-electric)]" />
      </Switch.Root>
    </div>
  );
}
