#!/usr/bin/env python3
"""Build src/lib/transport/demoKeymaps.json: each ZMK keyboard's default keymap.

Usage:
  python3 scripts/generateDemoKeymaps.py <firmware-root> [output.json]

<firmware-root> is the folder the firmware repositories are checked out in,
side by side:

  zmk-fork/                           (dt-bindings: keys.h, bt.h, pointing.h)
  zmk-driver-iqs9151/                 (dt-bindings: zip_dynamic_scale.h)
  zmk-keyboard-clickboard-ergotrack/
  zmk-keyboard-gofortywl-ortho/
  zmk-keyboard-bethirtywl-qaz/
  zmk-keyboard-bethirtywl-ortho/

For every keyboard in KEYBOARDS, the .keymap its firmware is built from is
run through the C preprocessor with the same dt-bindings headers the build
uses, so `&kp LG(LBKT)` or `&bt BT_NXT` comes out as the numbers the keyboard
would report over the Studio protocol. Behaviors are written by display name
(what the protocol identifies them by); the demo maps the names to its own
behavior ids when it loads the file.

The demo used to start from the keycode list in order (A, B, C ... on the
first row), which showed where the keys are and nothing about the keyboard.

Rerun when a keyboard is added or its default keymap changes. Needs `cpp`.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "lib" / "transport" / "demoKeymaps.json"

# Demo layout name (src/lib/layouts.ts `name`) -> (repository, keymap file).
KEYBOARDS = {
    "ClickBoard ErgoTrack": (
        "zmk-keyboard-clickboard-ergotrack",
        "config/clickboard_ergotrack.keymap",
    ),
    "GoFortyWL Ortho": (
        "zmk-keyboard-gofortywl-ortho",
        "config/gofortywl_ortho.keymap",
    ),
    "BeThirtyWL QAZ": (
        "zmk-keyboard-bethirtywl-qaz",
        "config/bethirtywl_qaz.keymap",
    ),
    "BeThirtyWL Ortho": (
        "zmk-keyboard-bethirtywl-ortho",
        "config/bethirtywl_ortho.keymap",
    ),
}

# Headers the preprocessor needs. The .dtsi files a keymap includes only
# define nodes, which this script does not need, so they are stubbed out;
# their behaviors' display names are read separately (behavior_names).
INCLUDE_DIRS = ["zmk-fork/app/include", "zmk-driver-iqs9151/include"]
ZMK_BEHAVIORS = "zmk-fork/app/dts/behaviors"
DT_UTIL_STUB = "#define BIT(n) (1 << (n))\n"

BEHAVIOR_NODE = re.compile(
    r"(\w+)\s*:\s*\w+\s*\{[^{}]*?display-name\s*=\s*\"([^\"]*)\"", re.S
)


def strip_comments(text):
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def behavior_names(*texts):
    """label -> display-name for every behavior node in the given sources."""
    names = {}
    for text in texts:
        for label, display in BEHAVIOR_NODE.findall(strip_comments(text)):
            names[label] = display
    return names


def preprocess(firmware, keymap_text):
    with tempfile.TemporaryDirectory() as stubs:
        stub_root = Path(stubs)
        for header in re.findall(r"#include\s*<([^>]+\.dtsi)>", keymap_text):
            path = stub_root / header
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("")
        dt_util = stub_root / "zephyr" / "dt-bindings" / "dt-util.h"
        dt_util.parent.mkdir(parents=True)
        dt_util.write_text(DT_UTIL_STUB)
        command = ["cpp", "-P", "-undef", "-nostdinc", "-x", "assembler-with-cpp"]
        for directory in [stubs] + [str(firmware / d) for d in INCLUDE_DIRS]:
            command += ["-I", directory]
        return subprocess.run(
            command + ["-"],
            input=keymap_text,
            capture_output=True,
            text=True,
            check=True,
        ).stdout


def block_after(text, start):
    """The text between the `{` at or after `start` and its matching `}`."""
    open_at = text.index("{", start)
    depth = 0
    for i in range(open_at, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[open_at + 1 : i]
    raise ValueError("unbalanced braces")


def split_params(text):
    """Whitespace-separated cells; a parenthesised expression stays whole."""
    cells, depth, current = [], 0, ""
    for ch in text:
        if ch in " \t\n" and depth == 0:
            if current:
                cells.append(current)
                current = ""
            continue
        depth += ch == "("
        depth -= ch == ")"
        current += ch
    if current:
        cells.append(current)
    return cells


def evaluate(cell):
    expression = re.sub(r"(?<=[0-9a-fA-F])[uUlL]+\b", "", cell)
    if not re.fullmatch(r"[0-9a-fA-FxX()<>|&+\-*~ \t]+", expression):
        raise ValueError(f"not a number after preprocessing: {cell!r}")
    return eval(expression, {"__builtins__": {}}) & 0xFFFFFFFF


def parse_keymap(preprocessed, names):
    marker = preprocessed.index('"zmk,keymap"')
    body = block_after(preprocessed, preprocessed.rindex("keymap", 0, marker))
    layers, reserved, used = [], 0, []
    for _label, node in re.findall(r"(\w+)\s*\{([^{}]*)\}", body):
        if re.search(r'status\s*=\s*"reserved"', node):
            reserved += 1
            continue
        bindings_text = re.search(r"(?<![\w-])bindings\s*=\s*<([^>]*)>", node, re.S)
        if not bindings_text:
            continue
        name = re.search(r'display-name\s*=\s*"([^"]*)"', node)
        bindings = []
        for chunk in bindings_text.group(1).split("&")[1:]:
            label, *rest = chunk.strip().split(None, 1)
            rest = rest[0] if rest else ""
            if label not in names:
                raise KeyError(f"no display-name known for &{label}")
            if names[label] not in used:
                used.append(names[label])
            params = [evaluate(cell) for cell in split_params(rest)]
            if len(params) > 2:
                raise ValueError(f"&{label} has {len(params)} cells")
            params += [0] * (2 - len(params))
            bindings.append([used.index(names[label])] + params)
        layers.append({"name": name.group(1) if name else "", "bindings": bindings})
    return layers, reserved, used


def git_head(repo):
    def run(*args):
        return subprocess.run(
            ["git", "-C", str(repo), *args], capture_output=True, text=True
        ).stdout.strip()

    head = run("rev-parse", "--short", "HEAD")
    return head + ("+dirty" if run("status", "--porcelain") else "")


def main():
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    firmware = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) == 3 else OUT
    standard = [p.read_text() for p in sorted((firmware / ZMK_BEHAVIORS).glob("*.dtsi"))]

    keyboards = {}
    for layout_name, (repo, keymap_path) in KEYBOARDS.items():
        source = firmware / repo / keymap_path
        if not source.exists():
            print(f"skipped {layout_name}: {source} not found", file=sys.stderr)
            continue
        raw = source.read_text()
        text = strip_comments(raw)
        names = behavior_names(*standard, raw)
        layers, reserved, used = parse_keymap(preprocess(firmware, text), names)
        counts = {len(layer["bindings"]) for layer in layers}
        if len(counts) != 1:
            raise ValueError(f"{layout_name}: layers differ in length: {counts}")
        keyboards[layout_name] = {
            "source": f"{repo}@{git_head(firmware / repo)}: {keymap_path}",
            "reservedLayers": reserved,
            "behaviors": used,
            "layers": layers,
        }
        print(
            f"{layout_name}: {len(layers)} layers x {counts.pop()} keys, "
            f"{reserved} reserved, behaviors: {', '.join(used)}"
        )

    # One line per layer: readable in a diff, and short enough to review.
    lines = ["{", '  "generatedBy": "scripts/generateDemoKeymaps.py",', '  "keyboards": {']
    for k, (layout_name, board) in enumerate(keyboards.items()):
        lines.append(f"    {json.dumps(layout_name)}: {{")
        lines.append(f'      "source": {json.dumps(board["source"])},')
        lines.append(f'      "reservedLayers": {board["reservedLayers"]},')
        lines.append(f'      "behaviors": {json.dumps(board["behaviors"])},')
        lines.append('      "layers": [')
        for i, layer in enumerate(board["layers"]):
            comma = "," if i + 1 < len(board["layers"]) else ""
            compact = json.dumps(layer, separators=(",", ":"), ensure_ascii=False)
            lines.append(f"        {compact}{comma}")
        lines.append("      ]")
        lines.append("    }" + ("," if k + 1 < len(keyboards) else ""))
    lines += ["  }", "}", ""]
    out.write_text("\n".join(lines))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
