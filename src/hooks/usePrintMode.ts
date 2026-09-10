/**
 * True only while the browser is laying the page out for print.
 *
 * Lets a component render a print-only view without paying for it the rest of
 * the time -- which matters here because the print view is another full
 * keyboard per layer, each with its own resize observer.
 *
 * `beforeprint` fires for Cmd+P as well as `window.print()`, so the sheet
 * appears either way. The state update has to be flushed synchronously: the
 * browser takes its print snapshot as soon as the handler returns, and React's
 * normal batching would schedule the render for after that.
 */
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export function usePrintMode(): boolean {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const enter = () => flushSync(() => setIsPrinting(true));
    const leave = () => flushSync(() => setIsPrinting(false));

    window.addEventListener("beforeprint", enter);
    window.addEventListener("afterprint", leave);
    return () => {
      window.removeEventListener("beforeprint", enter);
      window.removeEventListener("afterprint", leave);
    };
  }, []);

  return isPrinting;
}
