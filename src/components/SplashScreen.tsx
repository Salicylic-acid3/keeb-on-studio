import { motion } from "framer-motion";
import {
  IconAccessPoint,
  IconPlugConnected,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { useState, useCallback, type ReactNode } from "react";
import type { ConnectionMethod } from "./DeviceConnection";
import { ConnectionNoticeDialog } from "./ConnectionNoticeDialog";
import { hasAcceptedNotice } from "../lib/connectionNoticeStorage";
import { BLE_CONNECTION_ENABLED } from "../lib/connectionMethods";
import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "../hooks/useLanguage";
import { getCurrentVersion } from "../i18n/releaseNotes";
import { KikkoField } from "./brand/KikkoField";
import { NorenRule } from "./brand/NorenRule";

interface SplashScreenProps {
  onConnect: (method: ConnectionMethod) => void;
  isConnecting: boolean;
  error: string | null;
  /** Navigate to the standalone release notes page. */
  onShowReleaseNotes: () => void;
  /**
   * True when the last attempt was refused for not being one of this
   * workshop's keyboards. Shown as an explanation with a pointer to DYA Studio
   * rather than as a connection error, because nothing went wrong — the app
   * simply does not drive that keyboard, and never connected to it.
   */
  unsupportedDevice: boolean;
}

function LoadingDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-electric)]"
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Slash line component for disabled state
function DisabledSlash({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className={`w-[70px] h-[2px] ${color} rotate-45 rounded-full`} />
    </div>
  );
}

/**
 * A connect button: hexagon frame, conventional glyph.
 *
 * The hexagon is ours to style; the symbol inside is not. USB's trident and a
 * radiating-wave mark are what people navigate by, so redrawing them to match
 * the brand would cost more in recognition than it gains in consistency. The
 * clip-path sits on layers inside the button rather than the button itself,
 * so the focus ring is not clipped away with it.
 */
function ConnectButton({
  accent,
  icon,
  label,
  title,
  onClick,
  disabled,
}: {
  /** CSS variable name for this connection's accent colour. */
  accent: string;
  icon: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="group relative h-[94px] w-[84px] transition-transform disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-electric)]"
    >
      {/* border, then inset fill: a hexagon outline without a stroke path */}
      <div
        className="hex-clip absolute inset-0 opacity-[0.42]"
        style={{ background: `var(${accent})` }}
      />
      <div className="hex-clip absolute inset-[2px] bg-[var(--color-surface)]" />
      <div
        className="hex-clip absolute inset-[2px] opacity-[0.13] transition-opacity group-enabled:group-hover:opacity-25"
        style={{ background: `var(${accent})` }}
      />
      <span
        className="relative flex items-center justify-center"
        style={{ color: `var(${accent})` }}
      >
        {icon}
      </span>
      {disabled && <DisabledSlash color={`bg-[var(${accent})]`} />}
    </button>
  );
}

export function SplashScreen({
  onConnect,
  isConnecting,
  error,
  onShowReleaseNotes,
  unsupportedDevice,
}: SplashScreenProps) {
  const { t } = useLanguage();
  const version = getCurrentVersion();
  // Dialog state
  const [showNotice, setShowNotice] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<ConnectionMethod | null>(
    null,
  );

  const handleConnectClick = useCallback(
    (method: ConnectionMethod) => {
      // Demo mode doesn't need the notice
      if (method === "demo") {
        onConnect(method);
        return;
      }

      // Check if user has already accepted the notice
      if (hasAcceptedNotice(method)) {
        onConnect(method);
        return;
      }

      // Show notice dialog
      setPendingMethod(method);
      setShowNotice(true);
    },
    [onConnect],
  );

  const handleAgree = useCallback(() => {
    setShowNotice(false);
    if (pendingMethod) {
      onConnect(pendingMethod);
      setPendingMethod(null);
    }
  }, [pendingMethod, onConnect]);

  const handleCancel = useCallback(() => {
    setShowNotice(false);
    setPendingMethod(null);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-bg)]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <KikkoField />
      <div className="absolute right-6 top-6 z-20">
        <LanguageToggle />
      </div>

      {/* The card is the shop entrance: noren across the top, mark below. */}
      <motion.div
        className="relative z-10 w-[520px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_50px_-22px_rgba(28,35,51,0.28)] dark:shadow-[0_18px_50px_-20px_rgba(0,0,0,0.6)]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <NorenRule />
        <div className="flex flex-col items-center gap-7 px-14 pb-11 pt-11">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="h-[104px] w-[104px]"
          />
          <div className="text-center">
            <h1 className="text-[33px] font-light text-[var(--color-text)]">
              <span className="font-medium text-[var(--color-brand)]">
                Keeb-On!
              </span>{" "}
              Studio
            </h1>
            <p className="mt-2 text-[11px] uppercase tracking-[0.32em] text-[var(--color-text-muted)]">
              Salicylic_acid3 Keyboards
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
              {t("Connect")}
            </p>
            <div className="flex gap-[22px]">
              <ConnectButton
                accent="--color-electric"
                icon={<IconPlugConnected size={30} strokeWidth={1.6} />}
                label={t("Connect via USB")}
                title={t("Connect via USB")}
                onClick={() => handleConnectClick("serial")}
                disabled={isConnecting}
              />
              {/* Bluetooth is not offered — see connectionMethods.ts. Left as
                  a condition rather than deleted so the path can come back in
                  one line if the firmware ever makes it worth having. */}
              {BLE_CONNECTION_ENABLED && (
                <ConnectButton
                  accent="--color-neon"
                  icon={<IconAccessPoint size={30} strokeWidth={1.6} />}
                  label={t("Connect via Bluetooth")}
                  title={t("Connect via Bluetooth")}
                  onClick={() => handleConnectClick("ble")}
                  disabled={isConnecting}
                />
              )}
              <ConnectButton
                accent="--color-cyber"
                icon={<IconDeviceDesktop size={30} strokeWidth={1.6} />}
                label={t("Try Demo Mode")}
                title={t("Try Demo Mode (no device required)")}
                onClick={() => handleConnectClick("demo")}
                disabled={isConnecting}
              />
            </div>
          </div>
        </div>
      </motion.div>
      {/* Loading indicator */}
      {isConnecting && (
        <motion.div
          className="flex gap-1 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <LoadingDots />
        </motion.div>
      )}

      {/* Unsupported keyboard: not a failure, so explain and redirect. */}
      {unsupportedDevice && (
        <motion.div
          className="mt-4 max-w-md px-4 py-3 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/40"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm font-medium text-[var(--color-text)]">
            {t("That is not a keyboard Keeb-On! Studio can configure.")}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {t(
              "Keeb-On! Studio is specialized for the keyboards Salicylic_acid3 develops. For any other ZMK keyboard, please use the upstream DYA Studio.",
            )}
          </p>
          <a
            href="https://studio.dya.cormoran.works/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
          >
            studio.dya.cormoran.works
          </a>
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          className="mt-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-red-500">{error}</p>
        </motion.div>
      )}

      {/* Tagline */}
      <motion.p
        className="absolute bottom-12 text-xs font-light tracking-wider text-[var(--color-text-muted)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {t("Keeb-On! Studio is maintained by")}
        <a
          href="https://x.com/Salicylic_acid3"
          target="_blank"
          rel="noopener noreferrer"
          className="underline mx-1"
        >
          @Salicylic_acid3
        </a>
        <br />
        {t("Forked from DYA Studio by")}
        <a
          href="https://x.com/cormoran707"
          target="_blank"
          rel="noopener noreferrer"
          className="underline mx-1"
        >
          @cormoran707
        </a>
        <br />
        {t("Special thanks to")}
        <a
          href="https://zmk.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline mx-1"
        >
          {t("ZMK community")}
        </a>
        .
      </motion.p>

      {/* Standalone documentation links */}
      <motion.div
        className="absolute bottom-5 flex items-center gap-4 text-xs font-light tracking-wider text-[var(--color-text-muted)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        <button
          onClick={onShowReleaseNotes}
          className="hover:text-[var(--color-electric)] transition-colors underline"
        >
          {version
            ? t("Release notes ({{version}})", { version })
            : t("Release notes")}
        </button>
      </motion.div>

      {/* Connection Notice Dialog */}
      <ConnectionNoticeDialog
        open={showNotice}
        method={pendingMethod}
        onAgree={handleAgree}
        onCancel={handleCancel}
      />
    </motion.div>
  );
}
