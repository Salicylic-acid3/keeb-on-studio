/**
 * Trackpad gestures, as keys.
 *
 * ErgoTrack's firmware does not emit a keystroke for a swipe or a pinch
 * directly. It presses a key position that no switch sits under — seven of
 * them, drawn in a row below the board — and lets the keymap decide what that
 * means. The reason is per-OS switching: a position is resolved through the
 * layer stack, so Alt Base can give the same pinch a different modifier
 * without a rebuild.
 *
 * The cost is that the gestures show up in the keymap editor as seven unlabeled
 * keys sitting under the board with nothing to say what they are. This file is
 * what turns them back into gestures.
 *
 * Two things are deliberately not claimed here:
 *
 * The four swipe positions are two pairs, one per axis of the *sensor*, and
 * every input chain on this keyboard starts with INPUT_TRANSFORM_XY_SWAP — so
 * the sensor's x-axis swipe is the vertical one on screen. Which end of each
 * axis is which, though, is decided by how the sensor is mounted, and the two
 * pads invert different axes (the right pad X, the left pad Y). So a swipe that
 * sends one of a pair on one pad may well send the other on the other pad. The
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
  gestures: TrackpadGesture[];
}

/** Keyed by the physical layout's display name, lower-cased. */
const GESTURE_SETS: Record<string, GestureSet> = {
  // boards/shields/clickboard_ergotrack/clickboard_ergotrack_right.overlay:
  //   trackpad_gestures -> &tp_to_pos 72..76 (BTN_7, BTN_3..BTN_6)
  //   dual_pad          -> &tp_to_pos 77
  // Position 78 is bound to &none and has no gesture behind it, so it is not
  // listed: an editable row for a key nothing presses is just a trap.
  "clickboard ergotrack": {
    keyCount: 79,
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
  if (!layoutName || keyCount === undefined) return [];
  const set = GESTURE_SETS[layoutName.trim().toLowerCase()];
  if (!set || set.keyCount !== keyCount) return [];
  return set.gestures;
}
