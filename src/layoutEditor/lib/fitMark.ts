/** What the keycap check says about a key, as the canvas draws it. */
export interface FitMark {
  status: "ok" | "blank" | "sub" | "missing";
  /** The legend of the cap on the key (empty for a blank cap or none). */
  main: string;
  sub: string;
  /** The cap is made for another row. */
  offRow: boolean;
  /** Put there by hand. */
  pinned: boolean;
}

export const FIT_COLORS: Record<FitMark["status"], string> = {
  ok: "#2f9e6a",
  blank: "#3d6fac",
  sub: "#e08a00",
  missing: "#e5484d",
};
