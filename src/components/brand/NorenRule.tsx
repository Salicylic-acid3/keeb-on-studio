/**
 * 暖簾 (noren): the split cloth banner hung at a shop's entrance.
 *
 * Three panels in the brand's colours, run flush along the top edge of a card
 * so the card reads as a doorway you pass under. It is the app's one piece of
 * decoration that carries all three accents at once, which makes it a useful
 * marker for "this is the way in" -- the connect card, and later the active
 * tab.
 */

interface NorenRuleProps {
  /** Height in pixels. Thin for a tab marker, thicker over a card. */
  height?: number;
  className?: string;
}

export function NorenRule({ height = 10, className = "" }: NorenRuleProps) {
  return (
    <div
      className={`flex gap-[2px] ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <div className="flex-1 bg-[var(--color-electric)]" />
      <div className="flex-1 bg-[var(--color-neon)]" />
      <div className="flex-1 bg-[var(--color-cyber)]" />
    </div>
  );
}
