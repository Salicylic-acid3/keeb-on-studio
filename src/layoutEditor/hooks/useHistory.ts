/** A value with undo and redo: every commit remembers the one before. */
import { useCallback, useState } from "react";

const LIMIT = 200;

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initial: () => T) {
  const [state, setState] = useState<History<T>>(() => ({
    past: [],
    present: initial(),
    future: [],
  }));

  const commit = useCallback((next: T) => {
    setState((s) =>
      next === s.present
        ? s
        : {
            past: [...s.past, s.present].slice(-LIMIT),
            present: next,
            future: [],
          },
    );
  }, []);

  const undo = useCallback(() => {
    setState((s) =>
      s.past.length === 0
        ? s
        : {
            past: s.past.slice(0, -1),
            present: s.past[s.past.length - 1],
            future: [s.present, ...s.future],
          },
    );
  }, []);

  const redo = useCallback(() => {
    setState((s) =>
      s.future.length === 0
        ? s
        : {
            past: [...s.past, s.present],
            present: s.future[0],
            future: s.future.slice(1),
          },
    );
  }, []);

  return {
    value: state.present,
    commit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
