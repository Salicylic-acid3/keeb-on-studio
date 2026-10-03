/**
 * Choose what a key does. Four ways in:
 *
 *  - the picture of a keyboard (JIS or US, from the Settings layout), the
 *    same one the ZMK side uses, so ￥ and ろ are where a person expects;
 *  - layer keys for the layers of the block being edited;
 *  - modifiers: Ctrl+key combos, mod-tap, one-shot;
 *  - a list of the rest (media, mouse, system, tap dance, macros), and a
 *    text box that takes QMK notation for anything else.
 */
import { useMemo, useState } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { getKeyLayout, isSpacer, ROW_UNITS } from "../../lib/keyLayout";
import { getKeycodeByCode } from "../../lib/keycodes";
import {
  mapToLayout,
  type KeyboardLayoutType,
} from "../../lib/keyboardLayouts";
import {
  decodeKeycode,
  encodeKeycode,
  keycodeByName,
  keycodeToText,
  parseKeycode,
  MOD_LALT,
  MOD_LCTL,
  MOD_LGUI,
  MOD_LSFT,
  MOD_RIGHT,
  type LayerOp,
} from "../lib/keycodes/qmkKeycode";
import { qmkKeycodeLabel } from "../lib/keycodes/qmkLabels";

export interface QmkKeycodePickerProps {
  current: number;
  /** Layers offered for MO/LT/...: the block being edited. */
  layers: number[];
  tapDanceCount: number;
  macroCount: number;
  keyboardLayout?: KeyboardLayoutType;
  onSelect(code: number): void;
}

type Section = "keys" | "layers" | "mods" | "more";

const LAYER_OPS: Array<{ op: LayerOp; hint: string }> = [
  { op: "MO", hint: "Layer while held" },
  { op: "TG", hint: "Toggle layer" },
  { op: "TO", hint: "Switch to layer" },
  { op: "TT", hint: "Hold for layer, tap several times to toggle" },
  { op: "OSL", hint: "Layer for the next key" },
  { op: "DF", hint: "Make this the default layer" },
];

const MOD_BITS: Array<{ bit: number; label: string }> = [
  { bit: MOD_LCTL, label: "Ctrl" },
  { bit: MOD_LSFT, label: "Shift" },
  { bit: MOD_LALT, label: "Alt" },
  { bit: MOD_LGUI, label: "GUI" },
];

const MORE_GROUPS: Array<{ title: string; names: string[] }> = [
  { title: "Nothing", names: ["KC_NO", "KC_TRNS"] },
  {
    title: "Media",
    names: [
      "KC_MUTE",
      "KC_VOLU",
      "KC_VOLD",
      "KC_MPLY",
      "KC_MSTP",
      "KC_MPRV",
      "KC_MNXT",
      "KC_BRIU",
      "KC_BRID",
    ],
  },
  {
    title: "Mouse",
    names: [
      "MS_UP",
      "MS_DOWN",
      "MS_LEFT",
      "MS_RGHT",
      "MS_BTN1",
      "MS_BTN2",
      "MS_BTN3",
      "MS_WHLU",
      "MS_WHLD",
      "MS_WHLL",
      "MS_WHLR",
      "MS_ACL0",
      "MS_ACL1",
      "MS_ACL2",
    ],
  },
  {
    title: "Japanese input",
    names: [
      "KC_LNG1",
      "KC_LNG2",
      "KC_INT1",
      "KC_INT2",
      "KC_INT3",
      "KC_INT4",
      "KC_INT5",
    ],
  },
  {
    title: "System",
    names: ["KC_PWR", "KC_SLEP", "KC_WAKE", "QK_BOOT", "QK_RBT", "EE_CLR"],
  },
];

function KeyButton({
  label,
  title,
  active,
  onClick,
  widthUnits,
}: {
  label: string;
  title?: string;
  active?: boolean;
  onClick(): void;
  widthUnits?: number;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      style={
        widthUnits
          ? { flexBasis: `${(widthUnits / ROW_UNITS) * 100}%` }
          : undefined
      }
      className={`h-9 min-w-[2.25rem] px-1 rounded-md border text-xs font-medium truncate transition-colors ${
        active
          ? "bg-[var(--color-electric)]/20 border-[var(--color-electric)] text-[var(--color-text)]"
          : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-electric)]/60"
      }`}
    >
      {label || "—"}
    </button>
  );
}

export function QmkKeycodePicker({
  current,
  layers,
  tapDanceCount,
  macroCount,
  keyboardLayout,
  onSelect,
}: QmkKeycodePickerProps) {
  const { t } = useLanguage();
  const [section, setSection] = useState<Section>("keys");
  const [text, setText] = useState("");
  const decoded = useMemo(() => decodeKeycode(current), [current]);
  const [modMask, setModMask] = useState(() =>
    "mods" in decoded ? decoded.mods & 0x0f : 0,
  );
  const [modRight, setModRight] = useState(() =>
    "mods" in decoded ? (decoded.mods & MOD_RIGHT) !== 0 : false,
  );
  const [modMode, setModMode] = useState<"hold" | "tap">(
    decoded.kind === "modTap" ? "tap" : "hold",
  );
  const [ltLayer, setLtLayer] = useState<number | null>(
    decoded.kind === "layerTap" ? decoded.layer : null,
  );

  const rows = useMemo(() => getKeyLayout(keyboardLayout), [keyboardLayout]);
  const mods = modMask | (modRight ? MOD_RIGHT : 0);

  const chooseBasic = (code: number) => {
    if (section === "mods" && mods) {
      onSelect(
        encodeKeycode(
          modMode === "tap"
            ? { kind: "modTap", mods, code }
            : { kind: "mods", mods, code },
        ),
      );
      return;
    }
    if (section === "layers" && ltLayer !== null) {
      onSelect(encodeKeycode({ kind: "layerTap", layer: ltLayer, code }));
      return;
    }
    onSelect(code);
  };

  const parsed = parseKeycode(text);
  const sections: Array<{ id: Section; label: string }> = [
    { id: "keys", label: t("Keys") },
    { id: "layers", label: t("Layers") },
    { id: "mods", label: t("Modifiers") },
    { id: "more", label: t("More") },
  ];

  const picture = (
    <div className="flex flex-col gap-1">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((item, ii) => {
            if (isSpacer(item)) {
              return (
                <div
                  key={ii}
                  style={{ flexBasis: `${(item.w / ROW_UNITS) * 100}%` }}
                />
              );
            }
            const def = getKeycodeByCode(item.code);
            const label = def
              ? mapToLayout(def, keyboardLayout).displayName
              : "";
            return (
              <KeyButton
                key={ii}
                label={label}
                title={def ? mapToLayout(def, keyboardLayout).name : undefined}
                widthUnits={item.w ?? 1}
                active={decoded.kind === "basic" && decoded.code === item.code}
                onClick={() => chooseBasic(item.code)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              section === s.id
                ? "bg-[var(--color-electric)] text-white border-[var(--color-electric)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-electric)]/60"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[var(--color-text-muted)] font-mono">
          {keycodeToText(current)}
        </span>
      </div>

      {section === "keys" && picture}

      {section === "layers" && (
        <div className="flex flex-col gap-3">
          {LAYER_OPS.map(({ op, hint }) => (
            <div key={op} className="flex items-center gap-2">
              <span
                className="w-10 text-xs font-mono text-[var(--color-text-muted)]"
                title={t(hint)}
              >
                {op}
              </span>
              {layers.map((layer) => (
                <KeyButton
                  key={layer}
                  label={`${op} ${layer}`}
                  title={`${t(hint)}: ${op}(${layer})`}
                  active={
                    decoded.kind === "layer" &&
                    decoded.op === op &&
                    decoded.layer === layer
                  }
                  onClick={() =>
                    onSelect(encodeKeycode({ kind: "layer", op, layer }))
                  }
                />
              ))}
            </div>
          ))}
          <div className="border-t border-[var(--color-border)] pt-3">
            <p className="text-xs text-[var(--color-text-secondary)] mb-2">
              {t(
                "Layer while held, key when tapped (LT): pick the layer, then the key.",
              )}
            </p>
            <div className="flex items-center gap-2 mb-2">
              {layers.map((layer) => (
                <KeyButton
                  key={layer}
                  label={`LT ${layer}`}
                  active={ltLayer === layer}
                  onClick={() => setLtLayer(ltLayer === layer ? null : layer)}
                />
              ))}
            </div>
            {ltLayer !== null && picture}
          </div>
        </div>
      )}

      {section === "mods" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {MOD_BITS.map(({ bit, label }) => (
              <KeyButton
                key={bit}
                label={label}
                active={(modMask & bit) !== 0}
                onClick={() => setModMask(modMask ^ bit)}
              />
            ))}
            <KeyButton
              label={t("Right side")}
              active={modRight}
              onClick={() => setModRight(!modRight)}
            />
            <span className="mx-2 text-[var(--color-text-muted)]">|</span>
            <KeyButton
              label={t("Modifier + key")}
              title={t("Press the key with the modifier held, e.g. Ctrl+C")}
              active={modMode === "hold"}
              onClick={() => setModMode("hold")}
            />
            <KeyButton
              label={t("Modifier on hold, key on tap")}
              title={t("Mod-tap: the modifier while held, the key when tapped")}
              active={modMode === "tap"}
              onClick={() => setModMode("tap")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {t("Modifier alone")}:
            </span>
            {[
              ["KC_LCTL", "Ctrl"],
              ["KC_LSFT", "Shift"],
              ["KC_LALT", "Alt"],
              ["KC_LGUI", "GUI"],
              ["KC_RCTL", "RCtrl"],
              ["KC_RSFT", "RShift"],
              ["KC_RALT", "RAlt"],
              ["KC_RGUI", "RGUI"],
            ].map(([name, label]) => (
              <KeyButton
                key={name}
                label={label}
                title={name}
                active={
                  decoded.kind === "basic" &&
                  decoded.code === keycodeByName(name)
                }
                onClick={() => onSelect(keycodeByName(name)!)}
              />
            ))}
            <KeyButton
              label={
                t("One-shot") +
                (mods
                  ? ` (${keycodeToText(encodeKeycode({ kind: "oneShotMod", mods }))})`
                  : "")
              }
              title={t("Modifier applies to the next key only")}
              active={decoded.kind === "oneShotMod"}
              onClick={() =>
                mods && onSelect(encodeKeycode({ kind: "oneShotMod", mods }))
              }
            />
          </div>
          {mods ? (
            picture
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("Choose a modifier above, then the key.")}
            </p>
          )}
        </div>
      )}

      {section === "more" && (
        <div className="flex flex-col gap-3">
          {MORE_GROUPS.map((group) => (
            <div
              key={group.title}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="w-28 text-xs text-[var(--color-text-secondary)]">
                {t(group.title)}
              </span>
              {group.names.map((name) => {
                const code = keycodeByName(name);
                if (code === undefined) return null;
                const label = qmkKeycodeLabel(code, keyboardLayout);
                return (
                  <KeyButton
                    key={name}
                    label={
                      name === "KC_NO"
                        ? t("None")
                        : name === "KC_TRNS"
                          ? t("Transparent")
                          : label.short
                    }
                    title={name}
                    active={current === code}
                    onClick={() => onSelect(code)}
                  />
                );
              })}
            </div>
          ))}
          {tapDanceCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-[var(--color-text-secondary)]">
                {t("Tap dance")}
              </span>
              {Array.from({ length: Math.min(tapDanceCount, 16) }, (_, i) => (
                <KeyButton
                  key={i}
                  label={`TD ${i}`}
                  active={decoded.kind === "tapDance" && decoded.index === i}
                  onClick={() =>
                    onSelect(encodeKeycode({ kind: "tapDance", index: i }))
                  }
                />
              ))}
            </div>
          )}
          {macroCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-[var(--color-text-secondary)]">
                {t("Macro")}
              </span>
              {Array.from({ length: Math.min(macroCount, 16) }, (_, i) => (
                <KeyButton
                  key={i}
                  label={`M${i}`}
                  active={decoded.kind === "macro" && decoded.index === i}
                  onClick={() =>
                    onSelect(encodeKeycode({ kind: "macro", index: i }))
                  }
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("QMK notation, e.g. LT(1,KC_SPC) or LCTL(KC_C)")}
              className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-mono text-[var(--color-text)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && parsed !== undefined) {
                  onSelect(parsed);
                  setText("");
                }
              }}
            />
            <button
              type="button"
              className="btn-electric text-sm"
              disabled={parsed === undefined}
              onClick={() => {
                if (parsed !== undefined) {
                  onSelect(parsed);
                  setText("");
                }
              }}
            >
              {t("Set")}
            </button>
          </div>
          {text && parsed === undefined && (
            <p className="text-xs text-[var(--color-warning)]">
              {t("Not a keycode Keeb-On! Studio can read.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
