/**
 * A right-column settings card for a few QMK Settings, in the look of the
 * ZMK side's "Combo Global Settings" card (components/macroCombo/
 * GlobalSettingsCards.tsx). Opened from a gear on the matching list.
 */
import { IconSettings } from "@tabler/icons-react";
import * as Switch from "@radix-ui/react-switch";
import { StatusDot } from "../../components/EditStatusIndicator";
import { useLanguage } from "../../hooks/useLanguage";
import {
  readField,
  writeField,
  type QmkSettingField,
} from "../lib/qmkSettings";

interface Props {
  title: string;
  fields: QmkSettingField[];
  values: Record<number, number>;
  saved: Record<number, number>;
  onChange: (qsid: number, value: number) => void;
}

export function QmkSettingsCard({
  title,
  fields,
  values,
  saved,
  onChange,
}: Props) {
  const { t } = useLanguage();
  return (
    <section className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <IconSettings
          size={16}
          className="text-[var(--color-electric)] flex-shrink-0"
        />
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t(title)}
        </h2>
      </div>
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)]">
          {t(
            "These apply to the whole keyboard. Nothing is written until you Save.",
          )}
        </p>
        {fields.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("This keyboard's firmware has none of these settings.")}
          </p>
        )}
        {fields.map((f) => {
          const value = readField(f, values);
          const modified = readField(f, saved) !== value;
          return f.kind === "number" ? (
            <label key={`${f.qsid}`} className="block">
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                {t(f.label)}
                {modified && <StatusDot status="unsaved" />}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                  value={value as number}
                  onChange={(e) =>
                    onChange(
                      f.qsid,
                      writeField(f, values, Number(e.target.value)),
                    )
                  }
                />
                {f.unit && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {f.unit}
                  </span>
                )}
              </div>
              {f.hint && (
                <span className="block mt-1 text-xs text-[var(--color-text-muted)]">
                  {t(f.hint)}
                </span>
              )}
            </label>
          ) : (
            <div
              key={`${f.qsid}-${f.bit ?? "x"}`}
              className="flex items-start justify-between gap-3"
            >
              <div>
                <span className="flex items-center gap-1.5 text-sm text-[var(--color-text)]">
                  {t(f.label)}
                  {modified && <StatusDot status="unsaved" />}
                </span>
                {f.hint && (
                  <span className="block mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {t(f.hint)}
                  </span>
                )}
              </div>
              <Switch.Root
                checked={value as boolean}
                onCheckedChange={(on) =>
                  onChange(f.qsid, writeField(f, values, on))
                }
                aria-label={t(f.label)}
                className="mt-0.5 w-8 h-4 shrink-0 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors"
              >
                <Switch.Thumb className="block w-3 h-3 rounded-full transition-transform data-[state=checked]:translate-x-4 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
              </Switch.Root>
            </div>
          );
        })}
      </div>
    </section>
  );
}
