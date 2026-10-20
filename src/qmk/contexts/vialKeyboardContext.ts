import { createContext } from "react";
import type { UseVialKeyboard } from "../hooks/useVialKeyboard";

/** The app's one Vial keyboard, provided by VialKeyboardProvider. */
export const VialKeyboardContext = createContext<UseVialKeyboard | null>(null);
