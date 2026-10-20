/**
 * One Vial keyboard for the whole app. The connection used to live inside
 * QmkApp, so leaving /qmk dropped it (and left the HID device open); kept
 * above the route switch it survives moving to /practice and back, and
 * the unlock prompt is drawn once, here, wherever the unlock is started.
 */
import { useContext, type ReactNode } from "react";
import { KeyboardLayoutContext } from "../contexts/KeyboardLayoutContext";
import { QmkUnlockDialog } from "./components/QmkUnlockDialog";
import { VialKeyboardContext } from "./contexts/vialKeyboardContext";
import { useVialKeyboard } from "./hooks/useVialKeyboard";
import { qmkKeyLabel } from "./lib/keyLabel";
import { qmkBehaviors } from "./lib/zmkBridge";

export function VialKeyboardProvider({ children }: { children: ReactNode }) {
  const keyboard = useVialKeyboard();
  const { layout: keyboardLayout } = useContext(KeyboardLayoutContext);
  return (
    <VialKeyboardContext.Provider value={keyboard}>
      {children}
      {keyboard.unlock && (
        <QmkUnlockDialog
          open
          keyNames={keyboard.unlock.keys.map((k) =>
            qmkKeyLabel(keyboard.keymap?.[0]?.[k.row]?.[k.col] ?? 0, {
              behaviors: qmkBehaviors({ tapDanceCount: 0, macroCount: 0 }),
              layers: [],
              keyboardLayout,
            }),
          )}
          progress={keyboard.unlock.progress}
          onCancel={keyboard.cancelUnlock}
        />
      )}
    </VialKeyboardContext.Provider>
  );
}
