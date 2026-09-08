import { motion } from "framer-motion";
import { IconBluetooth, IconUsb, IconDeviceDesktop } from "@tabler/icons-react";
import { useState, useCallback } from "react";
import type { ConnectionMethod } from "./DeviceConnection";
import { ConnectionNoticeDialog } from "./ConnectionNoticeDialog";
import { hasAcceptedNotice } from "../lib/connectionNoticeStorage";
import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "../hooks/useLanguage";
import { getCurrentVersion } from "../i18n/releaseNotes";

interface SplashScreenProps {
  onConnect: (method: ConnectionMethod) => void;
  isConnecting: boolean;
  error: string | null;
  /** Navigate to the standalone release notes page. */
  onShowReleaseNotes: () => void;
  /**
   * Keyboard we hung up on because Keeb-On! Studio does not support it, or
   * `null`. Shown as an explanation with a pointer to DYA Studio rather than
   * as a connection error, because nothing actually went wrong.
   */
  unsupportedDevice: string | null;
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
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-cyber opacity-30" />
      <div className="absolute right-6 top-6 z-20">
        <LanguageToggle />
      </div>

      {/* Animated rings */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full border border-[var(--color-electric)]/20"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full border border-[var(--color-electric)]/10"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full border border-[var(--color-electric)]/5"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
      />

      {/* Content container */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      >
        {/* Brand name */}
        <motion.div
          className="flex flex-col items-center gap-2 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <h1 className="text-4xl font-light tracking-[0.15em] text-[var(--color-text)]">
            Keeb-On!
          </h1>
          <p className="text-sm font-light tracking-[0.2em] text-[var(--color-text-muted)] uppercase">
            Studio
          </p>
        </motion.div>

        {/* Connection section */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 2 }}
        >
          {/* Connect label */}
          <p className="text-sm font-light tracking-wider text-[var(--color-text-secondary)] text-center uppercase">
            {t("Connect")}
          </p>

          {/* Connection buttons */}
          <div className="flex flex-col items-center gap-4">
            {/* Device connection buttons */}
            <div className="flex gap-6">
              <button
                onClick={() => handleConnectClick("serial")}
                disabled={isConnecting}
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed border-[var(--color-electric)] bg-[var(--color-electric)]/10 hover:bg-[var(--color-electric)]/20 hover:border-[var(--color-electric)] hover:shadow-[0_0_20px_rgba(173,0,45,0.3)]"
                aria-label={t("Connect via USB")}
                title={t("Connect via USB")}
              >
                <IconUsb
                  size={28}
                  className="text-[var(--color-electric)] relative z-10"
                  strokeWidth={1.5}
                />
                {isConnecting && (
                  <DisabledSlash color="bg-[var(--color-electric)]" />
                )}
              </button>
              <button
                onClick={() => handleConnectClick("ble")}
                disabled={isConnecting}
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed border-[var(--color-neon)] bg-[var(--color-neon)]/10 hover:bg-[var(--color-neon)]/20 hover:border-[var(--color-neon)] hover:shadow-[0_0_20px_rgba(201,162,39,0.3)]"
                aria-label={t("Connect via Bluetooth")}
                title={t("Connect via Bluetooth")}
              >
                <IconBluetooth
                  size={28}
                  className="text-[var(--color-neon)] relative z-10"
                  strokeWidth={1.5}
                />
                {isConnecting && (
                  <DisabledSlash color="bg-[var(--color-neon)]" />
                )}
              </button>
              <button
                onClick={() => handleConnectClick("demo")}
                disabled={isConnecting}
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed border-[var(--color-cyber)] bg-[var(--color-cyber)]/10 hover:bg-[var(--color-cyber)]/20 hover:border-[var(--color-cyber)] hover:shadow-[0_0_20px_rgba(61,111,172,0.3)]"
                aria-label={t("Try Demo Mode")}
                title={t("Try Demo Mode (no device required)")}
              >
                <IconDeviceDesktop
                  size={28}
                  className="text-[var(--color-cyber)] relative z-10"
                  strokeWidth={1.5}
                />
                {isConnecting && (
                  <DisabledSlash color="bg-[var(--color-cyber)]" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
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
            {t("{{name}} is not a keyboard that Keeb-On! Studio supports.", {
              name: unsupportedDevice,
            })}
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
