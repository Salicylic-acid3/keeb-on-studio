/**
 * What the editor can do, in the order someone meets it. The texts are
 * translation keys; they say what each thing does for the layout, not how
 * it is built.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useLanguage } from "../../hooks/useLanguage";

const HELP: Array<{ title: string; lines: string[] }> = [
  {
    title: "Making a layout",
    lines: [
      "Start from New layout: an empty one, a common shape, or one of the supported keyboards with its legends and matrix numbers filled in.",
      "Tap a key to select it; drag it to move it. Keys snap to the grid (0.25u, 0.125u or 0.0625u) and to the corners of their neighbours.",
      "Drag on an empty spot to select every key in the box, or turn on Select several to add keys one tap at a time.",
      "The panel changes the selected keys: width and height, ISO / JIS Enter, add beside, duplicate, mirror, delete.",
      "Keys that overlap turn red. Stop at keys keeps a key you drag from going into another.",
    ],
  },
  {
    title: "Turning keys",
    lines: [
      "With Pivot and handle on, the selection shows its pivot and a handle. Drag the handle to turn; drag the pivot to put it where the keys should turn around.",
      "The pivot snaps to key corners and centres, so a thumb cluster can swing around the corner where it meets the next key.",
      "Pivot to touching corner moves the pivot to where the selection meets a neighbour. Move clear of overlap pushes the selection out of the keys it overlaps.",
    ],
  },
  {
    title: "Legends and matrix numbers",
    lines: [
      "Legend, Matrix and Both at the top switch what the keys show. An export carries what is on screen.",
      "Double-click a key to type its legend. Enter moves on to the next key, so a row can be filled without leaving the keyboard.",
      "With Type what you press on, pressing a key on your own keyboard writes that key's legend (US or JIS) and moves on.",
      "On the Matrix layer, keys without a number show a faint suggestion. Take them all at once, or renumber everything from the layout.",
    ],
  },
  {
    title: "Checking keycaps",
    lines: [
      "Keycap check tells whether a keycap set covers the layout. Choose the switches first; only the sets that go on them are offered.",
      "Add a set and the caps go onto the keys. The outline shows the result: green for the right legend, blue for a blank cap, orange for another legend, red for no cap.",
      "Where a design is on file, pick the colourway under the set to see the caps as they are printed.",
      "Caps left over line up under the layout by row, length and shape. Select a key and tap a cap to put it on; the selection moves to the next key.",
      "Sets whose rows have different shapes list the layout's rows on the panel; change a row there if it was counted wrongly.",
    ],
  },
  {
    title: "Saving and sharing",
    lines: [
      "The layout and the keycap choices are kept in this browser. A Project file carries everything to another device.",
      "Export gives Keyboard Layout Editor data and the layouts.keymap rows for VIA and Vial. Import reads the same, and vial.json files.",
      "Save picture makes a PNG of the layout as on screen, keycaps included when the keycap check is on.",
      "Gallery publishes the layout for anyone to open and gives a link to it. This browser can delete what it published.",
    ],
  },
];

export function HelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-2xl max-h-[90dvh] overflow-auto bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-5"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] mb-3">
            {t("How to use the layout editor")}
          </Dialog.Title>
          {HELP.map((section) => (
            <section key={section.title} className="mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-1.5">
                {t(section.title)}
              </h3>
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {section.lines.map((line) => (
                  <li key={line}>{t(line)}</li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="btn-ghost border border-[var(--color-border)] flex items-center justify-center gap-2 text-sm min-h-11"
              >
                {t("Close")}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
