import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { useZMKApp, ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { UseZMKAppOptions } from "@cormoran/zmk-studio-react-hook";
import { connect as connectBLE } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";
import {
  connect as connectUSB,
  getPairedKeebOnPorts,
  reconnectToKeebOnPort,
  UnsupportedKeyboardError,
} from "../lib/transport/usb";
import { connect as connectDemo } from "../lib/transport/demo";
import {
  resolveCustomSubsystemIdentifier,
  withLoggedNotifications,
} from "../lib/rpcLogging";
import {
  trackKeyboardConnected,
  trackConnectFailed,
  classifyConnectError,
} from "../lib/analytics";

export type ConnectionMethod = "serial" | "ble" | "demo";

/**
 * Minimum time (ms) the "reconnecting" indicator stays visible once shown,
 * even if the underlying auto-reconnect attempt resolves near-instantly.
 * Without this, a fast reconnect would flash the indicator so briefly the
 * user couldn't tell what happened.
 */
export const AUTO_RECONNECT_MIN_DISPLAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple connection context for UI components
interface ConnectionContextValue {
  isConnected: boolean;
  deviceName: string | undefined;
  onConnect: (method: ConnectionMethod) => void;
  onDisconnect: () => void;
  isLoading: boolean;
  error: string | null;
  /** True while the page-load auto-reconnect attempt is in flight. */
  isReconnecting: boolean;
  /** Cancels an in-flight page-load auto-reconnect attempt. */
  onCancelReconnect: () => void;
  /**
   * Name of the keyboard we just disconnected from because Keeb-On! Studio
   * does not support it, or `null`. Set instead of `error` so the connect
   * screen can explain the narrowed scope and point at DYA Studio, rather
   * than showing it as a connection failure.
   */
  /** True when the last attempt was refused for not being one of ours. */
  unsupportedDevice: boolean;
  /**
   * True when this session is demo mode rather than a real keyboard.
   *
   * Features that only make sense against hardware read this. Saving a keymap
   * locally is deliberately NOT one of them -- laying out a keymap before the
   * keyboard arrives is a real thing people do -- but publishing one to other
   * people is: a shared keymap should come from someone who owns the board.
   */
  isDemo: boolean;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  isConnected: false,
  deviceName: undefined,
  onConnect: () => {},
  onDisconnect: () => {},
  isLoading: false,
  error: null,
  isReconnecting: false,
  onCancelReconnect: () => {},
  unsupportedDevice: false,
  isDemo: false,
});

interface DeviceConnectionProviderProps {
  children: ReactNode;
  /**
   * Minimum time (ms) to keep the reconnecting indicator visible once it's
   * shown. Defaults to {@link AUTO_RECONNECT_MIN_DISPLAY_MS}. Overridable
   * mainly so tests don't have to wait out the real-world default.
   */
  reconnectMinDisplayMs?: number;
  /**
   * How long (ms) to wait for the device to answer the initial RPC handshake
   * before giving up. Forwarded to `useZMKApp`; defaults to the library's
   * own default (5000ms) when omitted. Without this, a paired-but-unresponsive
   * device (e.g. sitting in the bootloader) would hang the page-load
   * auto-reconnect attempt forever instead of falling back to the connect
   * screen.
   */
  connectTimeoutMs?: UseZMKAppOptions["connectTimeoutMs"];
}

export function DeviceConnectionProvider({
  children,
  reconnectMinDisplayMs = AUTO_RECONNECT_MIN_DISPLAY_MS,
  connectTimeoutMs,
}: DeviceConnectionProviderProps) {
  const zmkApp = useZMKApp({ connectTimeoutMs });
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Dev-only: log every notification pushed from the device, mirroring the RPC
  // logging that wraps outbound calls. Wrap the shared `zmkApp` once here so all
  // consumers (which read it from `ZMKAppContext`) are covered without touching
  // each `onNotification` call site. A no-op passthrough in the production build.
  const loggedZmkApp = useMemo(
    () => ({
      ...zmkApp,
      onNotification: withLoggedNotifications(zmkApp.onNotification, (index) =>
        resolveCustomSubsystemIdentifier(
          index,
          zmkApp.state.customSubsystems?.subsystems,
        ),
      ),
    }),
    [zmkApp],
  );

  // Guards against React StrictMode's double-invoke of effects triggering
  // the auto-reconnect attempt twice.
  const autoReconnectAttemptedRef = useRef(false);
  // Bridges the cancel button (outside the effect) to the in-flight attempt.
  const cancelReconnectRef = useRef<() => void>(() => {});

  // Method of the connection attempt currently in flight, used to attribute the
  // success/failure analytics event. Cleared once its outcome is reported so a
  // single attempt is never counted twice (whether the failure surfaces as a
  // thrown error or via `zmkApp.state.error`).
  const attemptedMethodRef = useRef<ConnectionMethod | null>(null);
  // Whether the current connected session's `keyboard_connected` event already
  // fired, so a later device-info refresh doesn't re-report it.
  const connectedTrackedRef = useRef(false);

  // How the *current* session was established, kept for the whole session
  // (unlike `attemptedMethodRef`, which is cleared once the attempt's outcome
  // is reported). Lets demo mode past the supported-device check, and tells
  // the rest of the app whether it is talking to hardware.
  // The page-load auto-reconnect never sets it and is always paired serial,
  // so "serial" is the right default.
  const sessionMethodRef = useRef<ConnectionMethod>("serial");
  // The ref above is what the connect path writes; this is the render-visible
  // copy, since a ref change does not re-render the consumers.
  const [sessionMethod, setSessionMethod] =
    useState<ConnectionMethod>("serial");
  // Set when we hang up on a keyboard we don't support, so the connect screen
  // can say which keyboard it was.
  const [unsupportedDevice, setUnsupportedDevice] = useState(false);
  // `zmkApp` is a fresh object each render, so the check effect below reads
  // disconnect through a ref instead of depending on it.
  const disconnectRef = useRef(zmkApp.disconnect);
  disconnectRef.current = zmkApp.disconnect;

  const reportConnectFailed = useCallback((error: unknown) => {
    const method = attemptedMethodRef.current;
    if (!method) return;
    attemptedMethodRef.current = null;
    trackConnectFailed(method, classifyConnectError(error));
  }, []);

  // Report connection outcomes exactly once per attempt. Reading them from
  // committed state (rather than only from the connect() promise) covers the
  // case where the library surfaces errors via `state.error` instead of
  // throwing.
  useEffect(() => {
    const name = zmkApp.state.deviceInfo?.name;
    if (zmkApp.isConnected && name && !connectedTrackedRef.current) {
      connectedTrackedRef.current = true;
      // Auto-reconnect is always over paired serial and leaves the ref unset.
      trackKeyboardConnected(attemptedMethodRef.current ?? "serial", name);
      attemptedMethodRef.current = null;
    }
    if (!zmkApp.isConnected) {
      connectedTrackedRef.current = false;
    }
  }, [zmkApp.isConnected, zmkApp.state.deviceInfo?.name]);

  useEffect(() => {
    if (zmkApp.state.error) {
      reportConnectFailed(zmkApp.state.error);
    }
  }, [zmkApp.state.error, reportConnectFailed]);

  useEffect(() => {
    if (autoReconnectAttemptedRef.current) return;
    autoReconnectAttemptedRef.current = true;

    // Plain mutable flag (not a ref hook) local to this one-shot attempt,
    // mirroring the library's own ZMKConnection auto-reconnect pattern.
    // Set on unmount (cleanup below) or when the user clicks "Cancel".
    const cancelledState = { current: false };
    cancelReconnectRef.current = () => {
      cancelledState.current = true;
      setIsReconnecting(false);
    };

    (async () => {
      const ports = await getPairedKeebOnPorts();
      if (ports.length === 0 || cancelledState.current) {
        // Nothing paired (or already cancelled): stay disconnected, show
        // the normal connect screen immediately.
        return;
      }

      setIsReconnecting(true);
      let transport: RpcTransport | null = null;
      try {
        // Run the reconnect attempt and the minimum-display timer in
        // parallel so the indicator never flashes shorter than intended,
        // but also never waits longer than necessary once both settle.
        // Reconnect to one of *those* ports rather than asking the library
        // for "the paired port", which knows nothing about vendor ids.
        [transport] = await Promise.all([
          reconnectToKeebOnPort(ports),
          sleep(reconnectMinDisplayMs),
        ]);

        if (cancelledState.current) {
          // User cancelled or component unmounted while we were
          // reconnecting: release the transport instead of using it.
          transport?.abortController.abort();
          return;
        }

        if (!transport) {
          // No paired port after all (race with getPairedSerialPorts
          // above) -- fall back to the normal connect screen.
          return;
        }

        await zmkApp.connect(() => Promise.resolve(transport as RpcTransport));
      } catch (error) {
        if (!cancelledState.current) {
          console.warn("Auto-reconnect to paired serial port failed:", error);
        }
      } finally {
        if (!cancelledState.current) {
          setIsReconnecting(false);
        }
      }
    })();

    return () => {
      cancelledState.current = true;
    };
    // One-shot on mount by design; reconnectMinDisplayMs/zmkApp are read
    // from the closure captured at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = useCallback(
    async (method: ConnectionMethod) => {
      let connectFn: () => Promise<RpcTransport>;
      if (method === "ble") {
        connectFn = connectBLE;
      } else if (method === "demo") {
        connectFn = connectDemo;
      } else {
        connectFn = connectUSB;
      }
      attemptedMethodRef.current = method;
      sessionMethodRef.current = method;
      setSessionMethod(method);
      // A fresh attempt clears the previous rejection so the notice doesn't
      // outlive it.
      setUnsupportedDevice(false);
      try {
        // For USB the transport is obtained here rather than inside
        // `zmkApp.connect`, so that "not one of our keyboards" stays a refusal
        // we handle. Handed to the library it becomes `state.error`, and the
        // user gets a red failure message for a keyboard that never failed —
        // it was simply never connected to.
        const transport = connectFn === connectUSB ? await connectUSB() : null;
        await zmkApp.connect(
          transport ? () => Promise.resolve(transport) : connectFn,
        );
      } catch (error) {
        // Picking a keyboard that is not one of ours is not a failure to
        // report -- nothing went wrong, the app simply does not drive it. Show
        // the explanation and the pointer to DYA Studio instead.
        if (error instanceof UnsupportedKeyboardError) {
          setUnsupportedDevice(true);
          return;
        }
        // Covers errors thrown before the library commits them to `state.error`
        // (e.g. the user dismissing the browser device picker). `reportConnectFailed`
        // dedupes against the `state.error` effect so the attempt counts once.
        reportConnectFailed(error);
        throw error;
      }
    },
    [zmkApp, reportConnectFailed],
  );

  const handleDisconnect = useCallback(() => {
    zmkApp.disconnect();
  }, [zmkApp]);

  const handleCancelReconnect = useCallback(() => {
    cancelReconnectRef.current();
    // If the cancel lands while the auto-reconnect is already awaiting the
    // RPC handshake, `zmkApp.connect()` has set `isLoading` and won't clear it
    // until the connect-timeout watchdog fires. Abort that in-flight attempt so
    // the connect screen doesn't stay stuck in the loading state; `disconnect`
    // also resets `isLoading`/`error` back to the idle disconnected state.
    zmkApp.disconnect();
  }, [zmkApp]);

  const connectionValue: ConnectionContextValue = {
    isConnected: zmkApp.isConnected,
    deviceName: zmkApp.state.deviceInfo?.name,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    isLoading: zmkApp.state.isLoading,
    error: zmkApp.state.error,
    isReconnecting,
    onCancelReconnect: handleCancelReconnect,
    unsupportedDevice,
    isDemo: zmkApp.isConnected && sessionMethod === "demo",
  };

  return (
    <ZMKAppContext.Provider value={loggedZmkApp}>
      <ConnectionContext.Provider value={connectionValue}>
        {children}
      </ConnectionContext.Provider>
    </ZMKAppContext.Provider>
  );
}

export { ConnectionContext };
