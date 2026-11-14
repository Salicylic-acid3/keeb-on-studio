/**
 * How a Mod-Tap or Layer-Tap decides between tap and hold, as the picker
 * words it.
 *
 * The keyboards this app supports ship the same hold-tap several times over:
 * at different tapping terms, and with different answers to "another key was
 * pressed while this one was down -- is that a hold?". ZMK calls the answer
 * the `flavor`. Neither travels over the Studio protocol; all a behavior
 * brings is its display name. The firmware therefore names its instances
 * "<Mod-Tap|Layer-Tap> <N>ms (<kind>)", and this module reads the name back
 * into something a person can choose between: "Hold: typing first",
 * "Hold: balanced", "Hold: hold first", each with a line saying what it does.
 *
 * What a name without brackets means is the firmware's own default, and that
 * is not the same for the two families -- nor, for plain Mod-Tap, the same
 * before and after the firmware made it typing-first (see `TYPING_FIRST_MARKER`).
 */

export type HoldTapFlavor = "tap-preferred" | "balanced" | "hold-preferred";
export type HoldTapFamily = "mod-tap" | "layer-tap";

export interface HoldTapChoice {
  family: HoldTapFamily;
  /** The firmware's name without the bracket: "Mod-Tap", "Mod-Tap 150ms". */
  baseName: string;
  /** Tapping term in ms; 200 for the plain behaviors. */
  ms: number;
  flavor: HoldTapFlavor;
  /** i18n key of the kind's name, e.g. "Hold: typing first". */
  label: string;
  /** i18n key of the one-line description; takes `{{ms}}`. */
  description: string;
  /** Sorts a family's choices: typing first, balanced, hold first; 200ms ahead. */
  sortKey: string;
}

const NAME = /^(mod-tap|layer-tap)(?:\s+(\d+)\s*ms)?(?:\s*\(([^)]*)\))?$/i;

/** ZMK's tapping-term-ms for &mt and &lt, which carry no number in their name. */
const PLAIN_MS = 200;

/**
 * The behavior whose presence says "this firmware's plain Mod-Tap is
 * typing-first". ZMK's own &mt is hold-preferred, and that is what a plain
 * "Mod-Tap" was on these keyboards too until the firmware that overrode it
 * to tap-preferred. That firmware is also the one that added this behavior,
 * and nothing else about the change is visible from here.
 */
export const TYPING_FIRST_MARKER = "Mod-Tap 200ms (Balanced)";

const KIND: Record<
  HoldTapFlavor,
  { label: string; description: string; order: number }
> = {
  "tap-preferred": {
    label: "Hold: typing first",
    description:
      "A hold only once it has been held for {{ms}} ms. Typing fast never turns it into a hold.",
    order: 0,
  },
  balanced: {
    label: "Hold: balanced",
    description:
      "A hold after {{ms}} ms, or once another key is pressed and released while it is down.",
    order: 1,
  },
  "hold-preferred": {
    label: "Hold: hold first",
    description:
      "A hold after {{ms}} ms, or the moment another key is pressed while it is down.",
    order: 2,
  },
};

function flavorFromBracket(text: string): HoldTapFlavor | null {
  const kind = text.toLowerCase();
  // "Permissive" is QMK's name for balanced, and what the first of these
  // presets was called.
  if (/balanc|permissive/.test(kind)) return "balanced";
  if (/hold/.test(kind)) return "hold-preferred";
  if (/tap|typing/.test(kind)) return "tap-preferred";
  return null;
}

const isPreset = (name: string) => {
  const match = name.match(NAME);
  return !!match && match[2] !== undefined;
};

/**
 * The choice `displayName` stands for among `allDisplayNames` (every behavior
 * the keyboard reports), or null when it is not a hold-tap this module can
 * speak for.
 *
 * Null too when the keyboard has no timing preset at all: the plain names
 * are also what QMK keyboards and stock ZMK report, and there the decision
 * is governed by settings this module knows nothing about.
 */
export function holdTapChoice(
  displayName: string,
  allDisplayNames: Iterable<string>,
): HoldTapChoice | null {
  const match = displayName.trim().match(NAME);
  if (!match) return null;

  const names = Array.from(allDisplayNames);
  if (!names.some(isPreset)) return null;

  const family = match[1].toLowerCase() as HoldTapFamily;
  const ms = match[2] !== undefined ? Number(match[2]) : PLAIN_MS;

  let flavor: HoldTapFlavor | null;
  if (match[3] !== undefined) {
    flavor = flavorFromBracket(match[3]);
    if (!flavor) return null;
  } else if (family === "layer-tap") {
    // &lt and its timing presets: ZMK's default for layer-taps.
    flavor = "tap-preferred";
  } else if (match[2] !== undefined) {
    // "Mod-Tap 150ms": the timing presets kept ZMK's default for mod-taps.
    flavor = "hold-preferred";
  } else {
    flavor = names.includes(TYPING_FIRST_MARKER)
      ? "tap-preferred"
      : "hold-preferred";
  }

  const baseName = displayName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const kind = KIND[flavor];
  return {
    family,
    baseName,
    ms,
    flavor,
    label: kind.label,
    description: kind.description,
    sortKey: [
      family,
      kind.order,
      ms === PLAIN_MS ? 0 : 1,
      String(ms).padStart(5, "0"),
      // The plain behavior ahead of a preset that happens to match it.
      match[2] === undefined ? 0 : 1,
    ].join(":"),
  };
}
