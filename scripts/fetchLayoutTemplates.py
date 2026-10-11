#!/usr/bin/env python3
"""Collects each QMK keyboard's layout for the layout editor's templates.

Reads the keyboards listed in src/lib/firmwareDownloads.ts, fetches each
one's vial.json from the vial-qmk fork on GitHub and writes their
`layouts.keymap` (the KLE drawing with matrix positions) to
src/layoutEditor/data/keyboards.json.

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


def get(url):
    with urllib.request.urlopen(url, timeout=30) as res:
        return res.read().decode("utf-8")


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
        out.append(
            {
                "id": asset,
                "name": name,
                "series": series or name,
                "keymap": vial["layouts"]["keymap"],
            }
        )
        print(f"{asset}: {found[0]}/{found[1].split('/')[-2]}")
    target = ROOT / "src/layoutEditor/data/keyboards.json"
    target.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(out)} keyboards -> {target.relative_to(ROOT)}")
    if missing:
        print("no vial.json found for:", ", ".join(missing))


if __name__ == "__main__":
    main()
