/**
 * The printed keymap: one page per layer.
 *
 * The keymap tab shows one layer at a time, which is right for editing and
 * wrong for a reference sheet — what you want on paper is every layer, so this
 * renders them all.
 *
 * It exists only while the browser is preparing to print (see usePrintMode).
 * Keeping it in the DOM the rest of the time would mean another full keyboard
 * per layer sitting behind `display: none`, each with its own resize observer,
 * on the heaviest screen in the app -- and every layer name and module label
 * duplicated for anything that reads the page.
 *
 * It reuses KeyboardLayout rather than drawing its own keys: a printed sheet
 * that disagreed with the editor about what a key does would be worse than no
 * sheet at all. The interactive props are stubbed out, since nothing on paper
 * can be clicked.
 *
 * It goes into a portal on <body> so the print stylesheet can hide everything
 * else with one rule. Left where it is rendered, the sheet sits several
 * layers deep in the app, and hiding its siblings would mean naming every
 * ancestor between here and the page shell.
 */
import { createPortal } from "react-dom";
import { KeyboardLayout } from "./KeyboardLayout";
import { usePrintMode } from "../hooks/usePrintMode";
import type {
  PhysicalLayout,
  Layer,
  BehaviorBinding,
  BehaviorDefinition,
} from "../hooks/useKeymap";
import type { PhysicalLayoutModulePresentation } from "../hooks/usePhysicalLayoutModules";
import type { KeyboardLayoutType } from "../lib/keyboardLayouts";
import { useLanguage } from "../hooks/useLanguage";
import { pseudoKeyPositionsFor } from "../lib/trackpad/gestures";

interface KeymapPrintSheetProps {
  layout: PhysicalLayout;
  layers: Layer[];
  behaviors: Map<number, BehaviorDefinition>;
  keyboardLayout?: KeyboardLayoutType;
  modules?: PhysicalLayoutModulePresentation[];
  runtimeMacros?: Array<{ slot: number; name?: string }>;
  /** Shown in the corner of every page, so a loose sheet is identifiable. */
  deviceName?: string;
}

const noop = () => {};
const never = () => false;
const noBinding = (): BehaviorBinding | null => null;

export function KeymapPrintSheet({
  layout,
  layers,
  behaviors,
  keyboardLayout,
  modules = [],
  runtimeMacros,
  deviceName,
}: KeymapPrintSheetProps) {
  const { t } = useLanguage();
  const isPrinting = usePrintMode();
  const printedOn = new Date().toLocaleDateString();

  // Derived here rather than passed in, so a printed sheet and the board on
  // screen can never disagree about which positions are real keys.
  const hiddenKeys = pseudoKeyPositionsFor(layout.name, layout.keys.length);

  if (!isPrinting) return null;

  return createPortal(
    <div className="keymap-print-portal" aria-hidden="true">
      {layers.map((layer, index) => (
        <section className="keymap-print-page" key={layer.id}>
          <header className="keymap-print-header">
            <h2>{layer.name || t("Layer {{id}}", { id: index })}</h2>
            <span>
              {[deviceName, layout.name, printedOn].filter(Boolean).join(" · ")}
            </span>
          </header>
          <div className="keymap-print-board">
            <KeyboardLayout
              layout={layout}
              layer={layer}
              layers={layers}
              behaviors={behaviors}
              selectedKey={null}
              onKeyClick={noop}
              onKeyReset={noop}
              isBindingModified={never}
              getOriginalBinding={noBinding}
              keyboardLayout={keyboardLayout}
              modules={modules}
              hiddenKeys={hiddenKeys}
              runtimeMacros={runtimeMacros}
              ariaLabel={t("Keyboard layout for {{layer}}", {
                layer: layer.name || t("Layer {{id}}", { id: index }),
              })}
            />
          </div>
        </section>
      ))}
    </div>,
    document.body,
  );
}
