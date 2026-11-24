import { useState, useEffect, useCallback, useRef } from "react";
import { useCustomSubsystem, useLockAwareCall } from "./useCustomSubsystem";
import {
  Request,
  Response,
  StateResponse,
} from "../proto/cormoran/default_layer/default_layer";
import { LAYER_OS_DETECTION, endpointsToFollowOs } from "../lib/osDetection";

// Subsystem identifier for the ZMK default-layer custom protocol.
// This matches the identifier registered in the zmk-feature-default-layer module.
export const DEFAULT_LAYER_SUBSYSTEM_IDENTIFIER = "cormoran__default_layer";
const SUBSYSTEM_IDENTIFIER = DEFAULT_LAYER_SUBSYSTEM_IDENTIFIER;

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

export interface UseDefaultLayerReturn {
  isAvailable: boolean;
  state: StateResponse | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  setEndpointLayer: (endpointIndex: number, value: number) => Promise<void>;
  setOsLayer: (os: number, value: number) => Promise<void>;
}

export function useDefaultLayer(): UseDefaultLayerReturn {
  const {
    subsystem,
    ready,
    call: gatedCall,
  } = useCustomSubsystem(SUBSYSTEM_IDENTIFIER, CODEC);
  const [state, setState] = useState<StateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Map a lock/cancel rejection from the gate to the shared "device is locked"
  // message (rendered via t()); other outcomes pass through unchanged.
  const call = useLockAwareCall(gatedCall, setError);

  const load = useCallback(async () => {
    if (!ready) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await call(Request.create({ getState: {} }));

      if (resp) {
        if (resp.state) {
          setState(resp.state);
        } else if (resp.error) {
          setError(resp.error.message);
        }
      }
    } catch (err) {
      console.error("Failed to load default layer state:", err);
      setError(
        `Failed to load default layer state: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  const setEndpointLayer = useCallback(
    async (endpointIndex: number, value: number) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({ setEndpointLayer: { endpointIndex, value } }),
        );

        if (resp) {
          if (resp.state) {
            // Response contains the full refreshed state - use it directly.
            setState(resp.state);
          } else if (resp.error) {
            setError(resp.error.message);
          }
        }
      } catch (err) {
        console.error("Failed to set endpoint default layer:", err);
        setError(
          `Failed to set endpoint default layer: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call],
  );

  const setOsLayer = useCallback(
    async (os: number, value: number) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(Request.create({ setOsLayer: { os, value } }));

        if (resp) {
          if (resp.state) {
            // Response contains the full refreshed state - use it directly.
            setState(resp.state);
          } else if (resp.error) {
            setError(resp.error.message);
          }
        }
      } catch (err) {
        console.error("Failed to set per-OS default layer:", err);
        setError(
          `Failed to set per-OS default layer: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call],
  );

  // Once any OS has a layer of its own, make every unset endpoint really
  // follow OS detection (see endpointsToFollowOs): the page shows them that
  // way, and that is what someone setting "Windows -> Alt" expects. Written
  // with the raw call so it doesn't show up as a change of the user's.
  const followingRef = useRef(false);
  useEffect(() => {
    const pending = endpointsToFollowOs(state);
    if (!ready || pending.length === 0 || followingRef.current) return;
    followingRef.current = true;
    void (async () => {
      try {
        let latest: StateResponse | null = null;
        for (const endpointIndex of pending) {
          const resp = await call(
            Request.create({
              setEndpointLayer: { endpointIndex, value: LAYER_OS_DETECTION },
            }),
          );
          if (resp?.error) {
            console.warn(
              `Could not make endpoint ${endpointIndex} follow OS detection:`,
              resp.error.message,
            );
            return;
          }
          if (resp?.state) latest = resp.state;
        }
        if (latest) setState(latest);
      } catch (err) {
        console.warn("Could not make endpoints follow OS detection:", err);
      } finally {
        followingRef.current = false;
      }
    })();
  }, [ready, state, call]);

  // Load state when connection or subsystem changes.
  useEffect(() => {
    if (ready) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return {
    isAvailable: subsystem !== null,
    state,
    isLoading,
    error,
    load,
    setEndpointLayer,
    setOsLayer,
  };
}
