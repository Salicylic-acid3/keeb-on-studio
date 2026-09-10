/**
 * What to do about a key the diagnostics flagged.
 *
 * The panel above finds chatter and stops there, which is a strange place to
 * stop: it names a problem and offers nothing. This says what to do, in the
 * order worth doing it.
 *
 * It also has to answer a question the screen otherwise raises and dodges --
 * why is there no "debounce" slider here? Because ZMK fixes debounce when the
 * firmware is built (CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS / _RELEASE_MS, or the
 * devicetree `debounce-press-ms`), and the kscan RPC is read-only apart from
 * clearing the counters. Nothing on this screen could write it even if there
 * were a control for it. Saying so is better than leaving the user hunting for
 * a setting that does not exist.
 *
 * Written for the person holding the keyboard, not the person who builds the
 * firmware, so it names no Kconfig symbols -- only what they can actually do.
 */
import { IconBolt } from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";

const DISCORD_URL = "https://discord.gg/y5CNqgEsNg";

export function ChatterGuidance() {
  const { t } = useLanguage();

  const steps = [
    {
      title: t("Reset the statistics, then use the keyboard for a while."),
      body: t(
        "These counts cover every press since the counters were last cleared, so one bad spell — a loose connector, a knock in a bag — stays in the numbers forever. A key that is not flagged again after a reset was never chattering.",
      ),
    },
    {
      title: t("Then look at the switch itself."),
      body: t(
        "A key that keeps being flagged is nearly always the switch: dust, wear, or a dry solder joint. Cleaning or replacing that one switch fixes most of it.",
      ),
    },
    {
      title: t("If it survives both, it needs new firmware."),
      body: t(
        "How long the keyboard ignores a switch after it moves is fixed when the firmware is built, so it cannot be changed from this screen. Report the key and these numbers, and a build with a longer wait can be published — you would then update from the Firmware tab.",
      ),
    },
  ];

  return (
    <div className="mt-4 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-border)]/30">
      <div className="flex items-center gap-2 mb-3">
        <IconBolt size={16} className="text-[var(--color-electric)]" />
        <h4 className="text-sm font-medium text-[var(--color-text)]">
          {t("What to do about chatter")}
        </h4>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/15 text-[var(--color-electric)] text-[10px] font-medium flex items-center justify-center mt-0.5">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text)]">{step.title}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
        {/* Said plainly, because the alternative is someone asking for a
            longer wait and being surprised by the cost of it. */}
        {t(
          "A longer wait delays every key on the keyboard, not just the faulty one, which is why it is the last step rather than the first.",
        )}{" "}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-electric)] hover:underline"
        >
          {t("Report it on Discord")}
        </a>
      </p>
    </div>
  );
}
