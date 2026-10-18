#!/usr/bin/env python3
"""Collects each keyboard's layout and default keymap for the layout
editor's templates, into src/layoutEditor/data/keyboards.json.

QMK: reads the keyboards listed in src/lib/firmwareDownloads.ts and, from
the vial-qmk fork on GitHub, each one's vial.json (`layouts.keymap`, the
KLE drawing with matrix positions), keyboard.json (which matrix position
each LAYOUT argument is) and keymap.c (every layer, as keycode names by
matrix position: `keycodes` is layer 0, `layers` the rest; the multi-os
keymap the released firmware is built from when there is one).

ZMK: every layer's bindings of each keyboard's .keymap, in key order
(`zmk` is the base layer, `zmkLayers` the rest).

Rerun when a keyboard is added or its vial.json changes:

    python3 scripts/fetchLayoutTemplates.py
"""
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "Salicylic-acid3/vial-qmk"
# keebon-os first: the released firmware is built from it, and the other
# branches can hold an older vial.json (ClickBoard ErgoMini had a plain grid
# there while keebon-os has the real layout).
BRANCHES = ["keebon-os", "vial", "stm32g0-support"]
KEYMAPS = ["vial", "multi-os"]
KEYCODE_KEYMAPS = ["multi-os", "vial", "default"]
ZMK = {
    "clickboard_ergotrack": ("Salicylic-acid3/zmk-keyboard-clickboard-ergotrack", "config/clickboard_ergotrack.keymap"),
    "goforty_max_ortho": ("Salicylic-acid3/zmk-keyboard-gofortymax-ortho", "config/goforty_max.keymap"),
}


def get(url):
    with urllib.request.urlopen(url, timeout=30) as res:
        return res.read().decode("utf-8")


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
    """[(layout macro, arguments)] of every layer in a keymap.c, in order."""
    text = strip_comments(keymap_c)
    out = []
    for m in re.finditer(r"\[\s*\w+\s*\]\s*=\s*(LAYOUT\w*)\s*\(", text):
        depth, i = 1, m.end()
        while depth and i < len(text):
            depth += {"(": 1, ")": -1}.get(text[i], 0)
            i += 1
        out.append((m.group(1), split_args(text[m.end() : i - 1])))
    return out


def layer0(keymap_c):
    """(layout macro, arguments) of the first layer in a keymap.c."""
    layers = layers_of(keymap_c)
    return layers[0] if layers else None


def qmk_keycodes(branch, asset, paths):
    """Every layer of the default keymap as keycode names by "row,col",
    or None. Layer 0 is the base; the key test reads the rest."""
    base = f"keyboards/salicylic_acid3/{asset}"
    info = next((f"{base}/{n}" for n in ("keyboard.json", "info.json") if f"{base}/{n}" in paths), None)
    if not info:
        return None
    raw = f"https://raw.githubusercontent.com/{REPO}/{branch}/"
    layouts = json.loads(get(raw + info)).get("layouts", {})
    # The first keymap whose layer 0 has an argument for every key.
    for name in KEYCODE_KEYMAPS:
        keymap = f"{base}/keymaps/{name}/keymap.c"
        if keymap not in paths:
            continue
        found = layers_of(get(raw + keymap))
        if not found:
            continue
        macro, args = found[0]
        layout = layouts.get(macro) or next(iter(layouts.values()), None)
        if layout and len(layout["layout"]) == len(args):
            return [
                {f"{k['matrix'][0]},{k['matrix'][1]}": code for k, code in zip(layout["layout"], layer_args)}
                for layer_macro, layer_args in found
                if len(layer_args) == len(args)
            ]
    return None


def zmk_layers(repo, path):
    """Every layer's bindings of a ZMK keymap, in order, without "&"."""
    text = strip_comments(get(f"https://raw.githubusercontent.com/{repo}/HEAD/{path}"))
    keymap = re.search(r"keymap\s*\{(.*)", text, flags=re.S).group(1)
    return [
        [" ".join(b.split()) for b in m.group(1).split("&") if b.strip()]
        for m in re.finditer(r"bindings\s*=\s*<(.*?)>", keymap, flags=re.S)
    ]


def main():
    source = (ROOT / "src/lib/firmwareDownloads.ts").read_text(encoding="utf-8")
    boards = re.findall(r'\b(?:rp|g0)\("([^"]+)",\s*"([^"]+)"(?:,\s*"([^"]+)")?\)', source)
    trees = {}
    for branch in BRANCHES:
        tree = json.loads(get(f"https://api.github.com/repos/{REPO}/git/trees/{branch}?recursive=1"))
        trees[branch] = {t["path"] for t in tree["tree"]}
    out, missing = [], []
    for name, asset, series in boards:
        found = None
        for branch in BRANCHES:
            for keymap in KEYMAPS:
                path = f"keyboards/salicylic_acid3/{asset}/keymaps/{keymap}/vial.json"
                if path in trees[branch]:
                    found = (branch, path)
                    break
            if found:
                break
        if not found:
            missing.append(asset)
            continue
        vial = json.loads(get(f"https://raw.githubusercontent.com/{REPO}/{found[0]}/{found[1]}"))
        layers = qmk_keycodes(found[0], asset, trees[found[0]]) or []
        out.append(
            {
                "id": asset,
                "name": name,
                "series": series or name,
                "keymap": vial["layouts"]["keymap"],
                "keycodes": layers[0] if layers else {},
                "layers": layers[1:],
            }
        )
        print(f"{asset}: {found[0]}/{found[1].split('/')[-2]}, {len(layers[0]) if layers else 0} keycodes, {len(layers)} layers")
    target = ROOT / "src/layoutEditor/data/keyboards.json"
    zmk_all = {board: zmk_layers(*source) for board, source in ZMK.items()}
    zmk = {board: layers[0] for board, layers in zmk_all.items()}
    zmk_upper = {board: layers[1:] for board, layers in zmk_all.items()}
    for board, layers in zmk_all.items():
        print(f"{board}: {len(layers[0])} bindings, {len(layers)} layers")
    out = {"qmk": out, "zmk": zmk, "zmkLayers": zmk_upper}
    target.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(out['qmk'])} + {len(zmk)} keyboards -> {target.relative_to(ROOT)}")
    if missing:
        print("no vial.json found for:", ", ".join(missing))


if __name__ == "__main__":
    main()
