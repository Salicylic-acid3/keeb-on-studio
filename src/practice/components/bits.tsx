/** Small pieces the practice pages share. */
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactNode } from "react";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-[var(--color-cyber)]/40 bg-[var(--color-cyber)]/10 px-4 py-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
      <IconInfoCircle
        size={16}
        className="mt-px flex-shrink-0 text-[var(--color-cyber)]"
      />
      <span>{children}</span>
    </p>
  );
}

export function Legend({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3.5 w-3.5 rounded border"
        style={{
          borderColor: color,
          background: `color-mix(in srgb, ${color} 25%, var(--color-surface-elevated))`,
        }}
      />
      {children}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 px-3 py-2">
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-0.5 text-xl tabular-nums text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

export const SELECT_CLASS =
  "h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]";
