import { formatBehaviorBinding } from "../../lib/behaviorMetadata";
import type { BehaviorDefinition } from "../../hooks/useKeymap";
import type { KeyboardLayoutType } from "../../lib/keyboardLayouts";
import { keycodeToBinding } from "./zmkBridge";
import { KC_NO } from "./keycodes/qmkKeycode";

export interface QmkKeyContext {
  behaviors: Map<number, BehaviorDefinition>;
  layers: Array<{ id: number; name: string }>;
  keyboardLayout: KeyboardLayoutType;
}

/** The text a keycap would show for this keycode, or "" for none. */
export function qmkKeyLabel(code: number, ctx: QmkKeyContext): string {
  if (code === KC_NO) return "";
  const binding = keycodeToBinding(code);
  const behavior = ctx.behaviors.get(binding.behaviorId);
  if (!behavior) return "";
  return formatBehaviorBinding(binding, behavior, {
    layers: ctx.layers,
    keyboardLayout: ctx.keyboardLayout,
  });
}
