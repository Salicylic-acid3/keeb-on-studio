#!/usr/bin/env python3
"""
Practice sentences from the blog (SPEC §6.4).

Reads the explanatory articles listed below from salicylic-acid3.hatenablog.com,
keeps sentences of a readable length that carry no product names, URLs, code
or quotations, adds each one's reading in kana (Sudachi), and writes
src/practice/data/texts.ja.json. The author reviews the file: readings that
Sudachi got wrong are fixed by hand there, and the "reviewed" flag records it.

    pip install sudachipy sudachidict_core
    python3 scripts/practice_texts.py

Entries already in the file keep their (possibly corrected) reading and
flags; only new sentences are added, and sentences no longer extracted are
left alone.
"""
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

from sudachipy import dictionary, tokenizer

BLOG = "https://salicylic-acid3.hatenablog.com/entry/"
ARTICLES = [
    "keebon-studio-manual",
    "layer-introduction",
    "be30ortho-keymap-guide",
    "go40-custom-guide",
    "goforty-introduction",
    "gofortysplit-introduction",
    "go40v2-introduction",
    "clickboard-introduction",
    "sonshi-introduction",
    "split-keeb-notes",
    "salicylic-naming",
    "japanese-layout",
    "self-made-keyboard-faq",
    "switches-review-3",
    "tool-lubrication",
    "macbook_impression",
    "keyboard-quantizer-review",
    "kle-introduction",
    "vial-manual",
    "remap-manual",
    "tips-meetup",
    "room-introduction",
    "libertouch-interview",
    "looking-back-2025",
]
OUT = Path(__file__).resolve().parent.parent / "src/practice/data/texts.ja.json"
MIN, MAX = 24, 72
PER_ARTICLE = 14

LATIN = re.compile(r"[A-Za-zＡ-Ｚａ-ｚ]")
BAD = re.compile(r"[「」『』【】《》〈〉\[\]()（）※→←↑↓…：:;＠@#＃/／\\｜|＊*＋+=＝<>＜＞〜~^]")
URL = re.compile(r"https?://|www\.")


def fetch(slug: str) -> str:
    with urllib.request.urlopen(BLOG + slug, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def body_text(page: str) -> str:
    m = re.search(r'<div class="entry-content[^"]*"[^>]*>(.*?)<div class="entry-footer', page, re.S)
    body = m.group(1) if m else page
    # Quotations, code, tables, captions and footnotes are not sentences to type.
    for tag in ("blockquote", "pre", "code", "table", "figure", "figcaption", "script", "style", "h1", "h2", "h3", "h4", "ul", "ol", "iframe"):
        body = re.sub(rf"<{tag}\b.*?</{tag}>", "\n", body, flags=re.S | re.I)
    body = re.sub(r"<br\s*/?>|</p>|</div>", "\n", body, flags=re.I)
    body = re.sub(r"<[^>]+>", "", body)
    return html.unescape(body)


def sentences(text: str):
    for line in text.splitlines():
        line = line.strip().replace("　", " ")
        if not line or URL.search(line):
            continue
        for s in re.split(r"(?<=[。！？!?])", line):
            s = s.strip()
            if not s:
                continue
            if not (MIN <= len(s) <= MAX):
                continue
            if LATIN.search(s) or BAD.search(s) or URL.search(s):
                continue
            if not re.search(r"[ぁ-ん]", s):
                continue
            # Half sentences and lists are not worth typing.
            if s[0] in "、。・ー" or s.endswith("、"):
                continue
            yield s


KANJI = re.compile(r"[一-龯々〆ヵヶ]")
# Readings the dictionary gets wrong for this blog's voice.
OVERRIDE = {"私": "わたし"}


def to_hiragana(text: str) -> str:
    return re.sub(r"[ァ-ヶ]", lambda m: chr(ord(m.group(0)) - 0x60), text)


def reading(tok, s: str) -> str:
    out = []
    for m in tok.tokenize(s, tokenizer.Tokenizer.SplitMode.C):
        surface = m.surface()
        # Only words with kanji need a reading; digits are typed as digits,
        # kana and punctuation as themselves.
        if surface in OVERRIDE:
            out.append(OVERRIDE[surface])
        elif KANJI.search(surface) and m.reading_form():
            out.append(to_hiragana(m.reading_form()))
        else:
            out.append(surface)
    return "".join(out)


def tags(s: str):
    out = ["base"]
    # Comma and period are on every keyboard; the long-vowel mark (typed as
    # a hyphen) and the rest may not be.
    if re.search(r"[！？!?ー\-]", s):
        out.append("symbols")
    if re.search(r"[0-9０-９]", s):
        out.append("digits")
    return out


def main() -> int:
    existing = {}
    if OUT.exists():
        for e in json.loads(OUT.read_text("utf-8")):
            existing[e["display"]] = e
    tok = dictionary.Dictionary(dict="core").tokenizer()
    entries = list(existing.values())
    seen = set(existing)
    for slug in ARTICLES:
        try:
            page = fetch(slug)
        except Exception as err:  # noqa: BLE001
            print(f"skip {slug}: {err}", file=sys.stderr)
            continue
        n = 0
        for s in sentences(body_text(page)):
            if s in seen or n >= PER_ARTICLE:
                continue
            seen.add(s)
            n += 1
            entries.append(
                {
                    "id": f"{slug}-{n}",
                    "display": s,
                    "kana": reading(tok, s),
                    "tags": tags(s),
                    "source": slug,
                    "reviewed": False,
                }
            )
        print(f"{slug}: {n}", file=sys.stderr)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"{len(entries)} sentences -> {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
