/**
 * Trackpad gestures, as keys.
 *
 * ErgoTrack's firmware does not emit a keystroke for a swipe or a pinch
 * directly. It presses a key position that no switch sits under — nine of
 * them, drawn in a row below the board — and lets the keymap decide what that
 * means. The reason is per-OS switching: a position is resolved through the
 * layer stack, so Alt Base can give the same pinch a different modifier
 * without a rebuild.
 *
 * The cost is that the gestures show up in the keymap editor as unlabeled keys
 * sitting under the board with nothing to say what they are. This file is what
 * turns them back into gestures.
 *
 * Two things are deliberately not claimed here:
 *
 * The four swipe positions are two pairs, one per axis of the *sensor*, and
 * every input chain on this keyboard starts with INPUT_TRANSFORM_XY_SWAP — so
 * the sensor's x-axis swipe is the vertical one on screen. Which end of each
 * axis is which, though, is decided by how the sensor is mounted. The two pads
 * used to disagree: the left one carries the same part fitted the other way
 * round, and a swipe on it came out backwards on both axes. The firmware now
 * flips the left pad's classification back
 * (CONFIG_INPUT_IQS9151_3F_SWIPE_INVERT_X/Y), so a gesture sends the same
 * position whichever pad it was made on.
 *
 * What is still not claimed is which end of each pair is which on screen. The
 * UI says "A" and "B" and lets the live key view settle it, because a confident
 * "up" that turns out to be "down" is worse than a label that admits it.
 *
 * The positions themselves are the shipped keymap's, so they go stale if the
 * layout changes. That is what the key count is for: if the layout the keyboard
 * reports is not the one these numbers were written against, the gestures are
 * not shown at all rather than pointed at whatever now sits there.
 */

/** One gesture, and the key position the firmware presses for it. */
export interface TrackpadGesture {
  /** Key position in the keymap. */
  position: number;
  /** What the fingers do. A translation key. */
  label: string;
  /** A second line under the label. A translation key. */
  detail: string;
  /**
   * True when the key is held down for the whole gesture rather than tapped
   * once. It decides whether a modifier belongs here: a held key with a
   * modifier on it turns the gesture's scroll into a zoom, and a tapped one
   * cannot.
   */
  held: boolean;
}

interface GestureSet {
  /**
   * How many keys the physical layout had when these positions were written.
   * A layout of any other size is a layout these numbers do not describe.
   */
  keyCount: number;
  /**
   * The first position with no switch under it. Everything from here to the
   * end of the layout is a pseudo-key: the gestures, plus any the firmware
   * reserved and has not used.
   *
   * The keymap editor draws the physical layout, and the firmware reports
   * these as part of it, so they arrive as a row of keys under the board that
   * nothing can press. Now that the gestures have a proper editor, the board
   * hides them — including the reserved ones, which never had anything behind
   * them at all.
   */
  pseudoKeysFrom: number;
  gestures: TrackpadGesture[];
}

/** Keyed by the physical layout's display name, lower-cased. */
const GESTURE_SETS: Record<string, GestureSet> = {
  // boards/shields/clickboard_ergotrack/clickboard_ergotrack_right.overlay:
  //   trackpad_gestures -> &tp_to_pos 72..76 (BTN_7, BTN_3..BTN_6)
  //                        &tp_to_pos 79, 80 (BTN_SIDE, BTN_EXTRA)
  //   dual_pad          -> &tp_to_pos 77
  //
  // 78 is the one position not listed: it is bound to &none — a two-handed
  // trigger that was tried and dropped — and an editable row for a key nothing
  // presses is just a trap. It stays hidden on the board with the rest.
  "clickboard ergotrack": {
    keyCount: 81,
    // 72..80: the gestures below, plus 78. All hidden on the keymap board.
    pseudoKeysFrom: 72,
    gestures: [
      {
        position: 72,
        label: "Pinch, two fingers on one pad",
        detail:
          "Held down for as long as the pinch lasts. A modifier here is what turns the pinch into a zoom, because the pinch itself sends wheel scroll.",
        held: true,
      },
      {
        position: 73,
        label: "Three-finger swipe, vertical A",
        detail: "Tapped once when the swipe is recognised.",
        held: false,
      },
      {
        position: 74,
        label: "Three-finger swipe, vertical B",
        detail: "Tapped once when the swipe is recognised.",
        held: false,
      },
      {
        position: 75,
        label: "Three-finger swipe, horizontal A",
        detail: "Tapped once when the swipe is recognised.",
        held: false,
      },
      {
        position: 76,
        label: "Three-finger swipe, horizontal B",
        detail: "Tapped once when the swipe is recognised.",
        held: false,
      },
      {
        position: 77,
        label: "Zoom, one finger on each pad",
        detail:
          "Held down for as long as the zoom lasts. This is the modifier the two-handed zoom holds while it scrolls.",
        held: true,
      },
      {
        position: 79,
        label: "Two-finger swipe, horizontal A",
        detail:
          "Tapped once when the swipe is recognised. Browser back and forward are the usual pair. Enabling this costs two-finger horizontal scroll — a sideways movement cannot both scroll at once and be held back long enough to be recognised as a swipe.",
        held: false,
      },
      {
        position: 80,
        label: "Two-finger swipe, horizontal B",
        detail: "The other direction of the same gesture.",
        held: false,
      },
    ],
  },
};

/**
 * The gestures this layout has, or an empty list.
 *
 * Empty means "say nothing": either a keyboard whose gestures we do not know,
 * or one whose layout no longer matches the positions recorded for it. Both
 * are reasons to leave the keymap editor as the only way in, rather than to
 * offer an editor pointed at the wrong keys.
 */
export function trackpadGesturesFor(
  layoutName: string | undefined | null,
  keyCount: number | undefined,
): TrackpadGesture[] {
  return gestureSetFor(layoutName, keyCount)?.gestures ?? [];
}

/**
 * The positions on this layout that no switch sits under.
 *
 * The keymap editor hides these: they are the gestures, which now have their
 * own editor, and the firmware's reserved spares, which have never had
 * anything behind them. Both used to be drawn as ordinary keys under the
 * board, which is an invitation to bind something to a key nobody can press.
 *
 * Empty for a keyboard or layout that has not been checked, and empty is the
 * safe answer: every position stays visible and the editor behaves as before.
 */
export function pseudoKeyPositionsFor(
  layoutName: string | undefined | null,
  keyCount: number | undefined,
): ReadonlySet<number> {
  const set = gestureSetFor(layoutName, keyCount);
  if (!set) return EMPTY;
  const positions = new Set<number>();
  for (let position = set.pseudoKeysFrom; position < set.keyCount; position++) {
    positions.add(position);
  }
  return positions;
}

const EMPTY: ReadonlySet<number> = new Set();

function gestureSetFor(
  layoutName: string | undefined | null,
  keyCount: number | undefined,
): GestureSet | undefined {
  if (!layoutName || keyCount === undefined) return undefined;
  const set = GESTURE_SETS[layoutName.trim().toLowerCase()];
  if (!set || set.keyCount !== keyCount) return undefined;
  return set;
}
