#!/usr/bin/env python3
"""Build src/qmk/demo/boards.json: every QMK keyboard the demo can stand in for.

Usage:
  python3 scripts/generateQmkDemoBoards.py <vial-qmk>

For each keyboard in src/lib/firmwareDownloads.ts (QMK_FIRMWARE), reads its
multi-os keymap in the vial-qmk fork -- the one the released firmware is
built from -- and writes what the demo needs to behave like that keyboard:

- the xz-compressed vial.json, as the firmware embeds it
- the matrix size and the default keymap as keycode names [layer][row][col]
- the OS blocks (KEEBON_OS_LAYERS_PER_BLOCK / KEEBON_OS_BLOCK_COUNT)
- the unlock keys (VIAL_UNLOCK_COMBO_ROWS / _COLS)
- the tap dance / combo / key override slots (config.h, else Vial's 32)

Rerun when a keyboard is added or its multi-os keymap changes.
"""
import base64
import json
import lzma
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QMK = Path(sys.argv[1]) / "keyboards" / "salicylic_acid3"
KEYMAP = "multi-os"
# Vial's default when config.h does not say (quantum/vial.h, for a keyboard
# with more than 4000 bytes of EEPROM, which every one of these has).
DEFAULT_ENTRIES = 32


def strip_comments(text):
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def split_args(text):
    """Top-level comma-separated arguments (LT(1, KC_A) stays whole)."""
    out, depth, cur = [], 0, ""
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def layers_of(keymap_c):
    """[(index, layout macro, arguments)] of every layer, in order."""
    text = strip_comments(keymap_c)
    body = text[text.index("keymaps[]") :]
    out = []
    for m in re.finditer(r"\[\s*(\w+)\s*\]\s*=\s*(LAYOUT\w*)\s*\(", body):
        depth, i = 1, m.end()
        while depth and i < len(body):
            depth += {"(": 1, ")": -1}.get(body[i], 0)
            i += 1
        out.append((m.group(1), m.group(2), split_args(body[m.end() : i - 1])))
    return out


def define(config, name):
    m = re.search(rf"#define\s+{name}\s+(.+)", strip_comments(config))
    return m.group(1).strip() if m else None


def int_list(value):
    return [int(x) for x in re.findall(r"\d+", value or "")]


def main():
    source = (ROOT / "src/lib/firmwareDownloads.ts").read_text(encoding="utf-8")
    start = source.index("export const QMK_FIRMWARE")
    boards = re.findall(
        r'\b(?:rp|g0)\("([^"]+)",\s*"([^"]+)"', source[start : source.index("];", start)]
    )
    out = {}
    for name, asset in boards:
        kb = QMK / asset
        km = kb / "keymaps" / KEYMAP
        definition = json.loads((km / "vial.json").read_text(encoding="utf-8"))
        assert definition["name"] == asset, f"{asset}: vial.json name is {definition['name']}"
        rows, cols = definition["matrix"]["rows"], definition["matrix"]["cols"]
        layouts = json.loads((kb / "keyboard.json").read_text(encoding="utf-8"))["layouts"]
        config = (km / "config.h").read_text(encoding="utf-8")

        grids = []
        for index, (label, macro, args) in enumerate(layers_of((km / "keymap.c").read_text(encoding="utf-8"))):
            assert label == str(index), f"{asset}: layer {label} out of order"
            layout = layouts.get(macro) or next(iter(layouts.values()))
            order = [tuple(k["matrix"]) for k in layout["layout"]]
            assert len(order) == len(args), f"{asset} layer {index}: {len(args)} keys, {macro} has {len(order)}"
            grid = [["KC_NO"] * cols for _ in range(rows)]
            for (r, c), code in zip(order, args):
                grid[r][c] = "KC_TRNS" if code == "_______" else ("KC_NO" if code == "XXXXXXX" else code)
            grids.append(grid)

        per_block = int(define(config, "KEEBON_OS_LAYERS_PER_BLOCK") or 4)
        blocks = int(define(config, "KEEBON_OS_BLOCK_COUNT") or 3)
        assert len(grids) == per_block * blocks, f"{asset}: {len(grids)} layers, not {blocks} x {per_block}"
        unlock_rows = int_list(define(config, "VIAL_UNLOCK_COMBO_ROWS"))
        unlock_cols = int_list(define(config, "VIAL_UNLOCK_COMBO_COLS"))
        assert len(unlock_rows) == len(unlock_cols) > 0, f"{asset}: unlock combo"
        for r, c in zip(unlock_rows, unlock_cols):
            if r >= rows or c >= cols:
                # The firmware has the same keys, so the real keyboard cannot
                # be unlocked either: say so loudly, keep the data as built.
                print(f"WARNING {asset}: unlock key ({r},{c}) is outside the {rows}x{cols} matrix")

        def entries(key):
            value = define(config, key)
            return int(value) if value else DEFAULT_ENTRIES

        out[asset] = {
            "name": name,
            "definitionXzBase64": base64.b64encode(
                lzma.compress(json.dumps(definition, separators=(",", ":")).encode("utf-8"))
            ).decode(),
            "rows": rows,
            "cols": cols,
            "keymap": grids,
            "layersPerBlock": per_block,
            "blockCount": blocks,
            "unlockKeys": [{"row": r, "col": c} for r, c in zip(unlock_rows, unlock_cols)],
            "entries": {
                "tapDance": entries("VIAL_TAP_DANCE_ENTRIES"),
                "combo": entries("VIAL_COMBO_ENTRIES"),
                "keyOverride": entries("VIAL_KEY_OVERRIDE_ENTRIES"),
            },
        }
        print(f"{asset}: {rows}x{cols}, {len(grids)} layers, unlock {list(zip(unlock_rows, unlock_cols))}")

    target = ROOT / "src/qmk/demo/boards.json"
    target.write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(out)} keyboards -> {target.relative_to(ROOT)} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
