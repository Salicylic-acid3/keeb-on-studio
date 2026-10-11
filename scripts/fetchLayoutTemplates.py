#!/usr/bin/env python3
"""Collects each keyboard's layout and default keymap for the layout
editor's templates, into src/layoutEditor/data/keyboards.json.

QMK: reads the keyboards listed in src/lib/firmwareDownloads.ts and, from
the vial-qmk fork on GitHub, each one's vial.json (`layouts.keymap`, the
KLE drawing with matrix positions), keyboard.json (which matrix position
each LAYOUT argument is) and keymap.c (layer 0, as keycode names by matrix
position; the multi-os keymap the released firmware is built from when
there is one).

ZMK: the base layer's bindings of each keyboard's .keymap, in key order.

Rerun when a keyboard is added or its vial.json changes:

    python3 scripts/fetchLayoutTemplates.py
"""
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "Salicylic-acid3/vial-qmk"
BRANCHES = ["vial", "keebon-os", "stm32g0-support"]
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


def layer0(keymap_c):
    """(layout macro, arguments) of the first layer in a keymap.c."""
    text = strip_comments(keymap_c)
    m = re.search(r"\[\s*\w+\s*\]\s*=\s*(LAYOUT\w*)\s*\(", text)
    if not m:
        return None
    depth, i = 1, m.end()
    while depth and i < len(text):
        depth += {"(": 1, ")": -1}.get(text[i], 0)
        i += 1
    return m.group(1), split_args(text[m.end() : i - 1])


def qmk_keycodes(branch, asset, paths):
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
        found = layer0(get(raw + keymap))
        if not found:
            continue
        macro, args = found
        layout = layouts.get(macro) or next(iter(layouts.values()), None)
        if layout and len(layout["layout"]) == len(args):
            return {f"{k['matrix'][0]},{k['matrix'][1]}": code for k, code in zip(layout["layout"], args)}
    return None


def zmk_bindings(repo, path):
    text = strip_comments(get(f"https://raw.githubusercontent.com/{repo}/HEAD/{path}"))
    m = re.search(r"keymap\s*\{.*?bindings\s*=\s*<(.*?)>", text, flags=re.S)
    return [" ".join(b.split()) for b in m.group(1).split("&") if b.strip()]


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
        keycodes = qmk_keycodes(found[0], asset, trees[found[0]])
        out.append(
            {
                "id": asset,
                "name": name,
                "series": series or name,
                "keymap": vial["layouts"]["keymap"],
                "keycodes": keycodes or {},
            }
        )
        print(f"{asset}: {found[0]}/{found[1].split('/')[-2]}, {len(keycodes or {})} keycodes")
    target = ROOT / "src/layoutEditor/data/keyboards.json"
    zmk = {board: zmk_bindings(*source) for board, source in ZMK.items()}
    for board, bindings in zmk.items():
        print(f"{board}: {len(bindings)} bindings")
    out = {"qmk": out, "zmk": zmk}
    target.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(out['qmk'])} + {len(zmk)} keyboards -> {target.relative_to(ROOT)}")
    if missing:
        print("no vial.json found for:", ", ".join(missing))


if __name__ == "__main__":
    main()
