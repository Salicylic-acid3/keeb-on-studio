/**
 * Does this binding's parameters fit the behavior's metadata?
 *
 * This exists because of a bug that shipped. The bottom keyboard wrote a bare
 * HID usage id — 0x1A for W — where &kp wants the full usage with its page,
 * 0x0007001A. Real hardware refused every write; the demo transport accepted
 * every one of them, because it checked the layer and the key position and
 * then stored whatever it was handed. So the tests passed, the demo keyboard
 * worked perfectly, and the only place the feature was broken was on the
 * keyboards it was written for.
 *
 * A demo that accepts more than a keyboard does is not a lenient demo, it is a
 * misleading one. This closes that gap by applying the same rule the firmware
 * applies: ZMK's zmk_behavior_check_params_for_metadata, in app/src/behavior.c.
 *
 * Where the rule is unclear it says yes. A demo that refuses something real
 * firmware would accept is a worse failure than this one — it would send
 * someone looking for a bug in their keyboard.
 */
import type {
  BehaviorBindingParametersSet,
  BehaviorParameterValueDescription,
} from "@zmkfirmware/zmk-studio-ts-client/lib/behaviors";

/** HID usage pages ZMK will take in a binding parameter. */
const USAGE_PAGE_KEYBOARD = 0x07;
const USAGE_PAGE_CONSUMER = 0x0c;

/**
 * The page of a usage value.
 *
 * Bits 24 and up are implicit modifiers — LC(A) and friends — and are not part
 * of the page, so they are masked off first.
 */
function usagePage(value: number): number {
  return (value & 0x00ffffff) >>> 16;
}

function usageId(value: number): number {
  return value & 0xffff;
}

/** Does one parameter match one of the values the behavior will take there? */
function matchesValue(
  description: BehaviorParameterValueDescription,
  value: number,
): boolean {
  if (description.nil !== undefined) return value === 0;
  if (description.constant !== undefined) return value === description.constant;
  if (description.range !== undefined) {
    return value >= description.range.min && value <= description.range.max;
  }
  if (description.hidUsage !== undefined) {
    // Zero is not a usage. ZMK rejects it here rather than treating it as
    // "unset", and so does this.
    if (value === 0) return false;
    const page = usagePage(value);
    const id = usageId(value);
    if (page === USAGE_PAGE_KEYBOARD) {
      return id <= description.hidUsage.keyboardMax;
    }
    if (page === USAGE_PAGE_CONSUMER) {
      return id <= description.hidUsage.consumerMax;
    }
    return false;
  }
  // layerId, and anything this build of the protocol does not know about.
  // Layer bounds are the keymap's business, not the parameter's, and an
  // unrecognised description is not grounds for refusing a write.
  return true;
}

/** A parameter with no descriptions at all must be absent, i.e. zero. */
function matchesSlot(
  descriptions: BehaviorParameterValueDescription[],
  value: number,
): boolean {
  if (descriptions.length === 0) return value === 0;
  return descriptions.some((description) => matchesValue(description, value));
}

/**
 * True when the firmware would accept these parameters for this behavior.
 *
 * @param metadata the behavior's parameter sets. A behavior with no sets — a
 *   transparent or a none — takes no parameters at all, so both must be zero.
 */
export function bindingParamsValid(
  metadata: BehaviorBindingParametersSet[] | undefined,
  param1: number,
  param2: number,
): boolean {
  if (!metadata || metadata.length === 0) {
    return param1 === 0 && param2 === 0;
  }
  // Any one set matching is enough: the sets are alternatives, which is how a
  // behavior takes either a key or a layer in the same slot.
  return metadata.some(
    (set) =>
      matchesSlot(set.param1 ?? [], param1) &&
      matchesSlot(set.param2 ?? [], param2),
  );
}
