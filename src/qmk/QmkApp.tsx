/**
 * The QMK (Vial) half of Keeb-On! Studio. Mounted at /qmk by App.tsx. Shares
 * the top page, theme, language and keycap drawing with the ZMK half; owns
 * its own connection (WebHID), keymap model and tabs.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconDeviceDesktop, IconKeyboard } from "@tabler/icons-react";
import { SplashScreen } from "../components/SplashScreen";
import { AppLayout } from "../layouts/AppLayout";
import { TabNavigation, type TabItem } from "../components/TabNavigation";
import type { ConnectionMethod } from "../components/DeviceConnection";
import { useLanguage } from "../hooks/useLanguage";
import { trackPageView } from "../lib/analytics";
import { QMK_PATH, type Firmware } from "../lib/firmware";
import { QMK_MODELS } from "./lib/models";
import { useVialKeyboard } from "./hooks/useVialKeyboard";
import {
  isWebHidAvailable,
  requestWebHidTransport,
} from "./lib/vial/transport";
import { QmkKeymapPage } from "./pages/QmkKeymapPage";
import { QmkOsPage } from "./pages/QmkOsPage";

interface QmkAppProps {
  /** Replace the URL and let the ZMK side take over. */
  onFirmwareChange: (firmware: Firmware) => void;
  onShowReleaseNotes: () => void;
  onShowAbout: () => void;
  onShowDownloads: () => void;
}

const TAB_IDS = ["keymap", "os"] as const;
type TabId = (typeof TAB_IDS)[number];

function tabFromPathname(pathname: string): TabId {
  const rest = pathname
    .slice(QMK_PATH.length)
    .replace(/^\/+/, "")
    .split("/")[0];
  return (TAB_IDS as readonly string[]).includes(rest)
    ? (rest as TabId)
    : "keymap";
}

export function QmkApp({
  onFirmwareChange,
  onShowReleaseNotes,
  onShowAbout,
  onShowDownloads,
}: QmkAppProps) {
  const { t } = useLanguage();
  const keyboard = useVialKeyboard();
  const [connectHint, setConnectHint] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(() =>
    tabFromPathname(window.location.pathname),
  );

  useEffect(() => {
    const onPop = () => setTab(tabFromPathname(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigateTab = useCallback((id: string) => {
    const next = (TAB_IDS as readonly string[]).includes(id)
      ? (id as TabId)
      : "keymap";
    const path = next === "keymap" ? QMK_PATH : `${QMK_PATH}/${next}`;
    if (window.location.pathname !== path)
      window.history.pushState(null, "", path);
    setTab(next);
    trackPageView(`QMK ${next}`, path);
  }, []);

  const onConnect = useCallback(
    async (method: ConnectionMethod) => {
      setConnectHint(null);
      if (method === "demo") {
        await keyboard.connectDemo().catch(() => undefined);
        return;
      }
      if (!isWebHidAvailable()) {
        setConnectHint(
          t(
            "This browser has no WebHID. Chrome or Edge on a computer can connect.",
          ),
        );
        return;
      }
      try {
        const transport = await requestWebHidTransport();
        if (!transport) {
          setConnectHint(
            t(
              "No keyboard picked. If yours was not in the list, it may be a ZMK keyboard: switch to ZMK at the top right.",
            ),
          );
          return;
        }
        await keyboard.connect(transport, "hid");
      } catch {
        // The hook already holds the error message.
      }
    },
    [keyboard, t],
  );

  const tabs = useMemo<TabItem[]>(() => {
    const items: TabItem[] = [
      {
        id: "keymap",
        label: t("Keymap"),
        icon: <IconKeyboard size={18} />,
        content: <QmkKeymapPage keyboard={keyboard} />,
      },
    ];
    if (keyboard.os) {
      items.push({
        id: "os",
        label: t("OS"),
        icon: <IconDeviceDesktop size={18} />,
        content: <QmkOsPage keyboard={keyboard} />,
      });
    }
    return items;
  }, [keyboard, t]);

  const connected = keyboard.info !== null;
  const activeTab = tabs.some((x) => x.id === tab) ? tab : "keymap";

  return (
    <>
      <AnimatePresence>
        {!connected && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SplashScreen
              onConnect={onConnect}
              isConnecting={keyboard.isConnecting}
              error={keyboard.error}
              onShowReleaseNotes={onShowReleaseNotes}
              onShowAbout={onShowAbout}
              onShowDownloads={onShowDownloads}
              unsupportedDevice={false}
              firmware="qmk"
              onFirmwareChange={onFirmwareChange}
              supportedModels={QMK_MODELS}
              connectHint={connectHint}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {connected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-screen"
        >
          <AppLayout
            isConnected
            deviceName={keyboard.info?.productName}
            onConnect={onConnect}
            onDisconnect={() => keyboard.disconnect()}
            isConnecting={keyboard.isConnecting}
          >
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={navigateTab}
            />
          </AppLayout>
        </motion.div>
      )}
    </>
  );
}
