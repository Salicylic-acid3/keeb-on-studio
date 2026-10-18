import { useContext } from "react";
import { VialKeyboardContext } from "../contexts/vialKeyboardContext";
import type { UseVialKeyboard } from "./useVialKeyboard";

/** The app's one Vial keyboard; throws outside VialKeyboardProvider. */
export function useVialKeyboardContext(): UseVialKeyboard {
  const keyboard = useContext(VialKeyboardContext);
  if (!keyboard)
    throw new Error("useVialKeyboardContext needs a VialKeyboardProvider");
  return keyboard;
}
