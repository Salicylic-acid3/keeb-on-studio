import { templateProject } from "../edit";
import {
  compareSets,
  defaultRows,
  fitCaps,
  missingBySize,
  normalLabel,
  poolOf,
  suggestSets,
} from "../fit";
import { allKits, capsFromKle, kitById } from "../kits";
import { importKle } from "../kle";
import { readingRows } from "../order";
import { sampleProject } from "../sample";

const rowsFor = (p: ReturnType<typeof importKle>) =>
  defaultRows(readingRows(p.keys).length);

describe("kits", () => {
  it("reads every set's caps", () => {
    const counts = Object.fromEntries(
      allKits().map((k) => [k.id, k.caps.length]),
    );
    expect(counts).toEqual({
      standard: 185,
      premium: 189,
      lowprofile: 193,
      goforty: 80,
      clickprofile: 52,
    });
  });

  it("takes rows from the R labels on sculpted sets only", () => {
    const standard = kitById("standard")!;
    const q = standard.caps.find((c) => c.main === "Q")!;
    const a = standard.caps.find((c) => c.main === "A")!;
    const esc = standard.caps.find((c) => c.main === "Esc")!;
    expect([q.row, a.row, esc.row]).toEqual(["R3", "R2", "R4"]);
    expect(kitById("lowprofile")!.caps.every((c) => !c.row)).toBe(true);
  });

  it("lets an unlabelled line take the row of the caps above it", () => {
    const premium = kitById("premium")!;
    // "0" sits on the second line of the JP block, under R4 caps.
    const zero = premium.caps.find((c) => c.main === "0" && c.sub === "");
    expect(zero?.row).toBe("R4");
  });

  it("reads legends, size notes, blanks and shapes", () => {
    const caps = capsFromKle(
      [
        [{ a: 2, w: 1.5 }, "Tab\n\n\n\n\n1.5", { a: 4 }, "!\n1"],
        [{ a: 3 }, "\n\n\n\n\n1c", { w: 1.25, w2: 1.75, l: true }, "Caps"],
        [{ w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, "Enter"],
      ],
      false,
    );
    expect(caps[0]).toMatchObject({ main: "Tab", w: 1.5, blank: false });
    expect(caps[1]).toMatchObject({ main: "1", sub: "!" });
    expect(caps[2]).toMatchObject({ blank: true, convex: true });
    expect(caps[3]).toMatchObject({ main: "Caps", w: 1.75 });
    expect(caps[4]).toMatchObject({ shape: "iso" });
  });
});

describe("normalLabel", () => {
  it("sees through spelling", () => {
    expect(normalLabel("Back Space")).toBe(normalLabel("BS"));
    expect(normalLabel("Control")).toBe(normalLabel("ctrl"));
    expect(normalLabel("Caps Lock")).toBe(normalLabel("Caps"));
    expect(normalLabel("Space")).toBe("");
    expect(normalLabel("Q")).toBe("q");
  });
});

describe("defaultRows", () => {
  it("counts up from the bottom", () => {
    expect(defaultRows(5)).toEqual(["R4", "R3", "R2", "R1", "R1"]);
    expect(defaultRows(4)).toEqual(["R3", "R2", "R1", "R1"]);
    expect(defaultRows(6)).toEqual(["R4", "R4", "R3", "R2", "R1", "R1"]);
  });
});

describe("fitCaps", () => {
  it("covers a 60% ANSI board from one Standard set, legends and rows right", () => {
    const p = templateProject("ansi60");
    const fit = fitCaps(p, [{ kitId: "standard", count: 1 }], rowsFor(p));
    expect(fit.counts.missing).toBe(0);
    const q = p.keys.find((k) => k.legends[0] === "Q")!;
    const placed = fit.placed.get(q.id)!;
    expect(placed.cap.cap).toMatchObject({ main: "Q", row: "R3" });
    expect(placed.status).toBe("ok");
    expect(placed.offRow).toBe(false);
    // Nothing is used twice and nothing is lost.
    const used = new Set([...fit.placed.values()].map((x) => x.cap.id));
    expect(used.size).toBe(fit.placed.size);
    expect(fit.spare.length + used.size).toBe(185);
  });

  it("prefers the homing caps for F and J", () => {
    const p = templateProject("ansi60");
    const fit = fitCaps(p, [{ kitId: "lowprofile", count: 1 }], rowsFor(p));
    const f = p.keys.find((k) => k.legends[0] === "F")!;
    const g = p.keys.find((k) => k.legends[0] === "G")!;
    expect(fit.placed.get(f.id)!.cap.cap.nub).toBe(true);
    expect(fit.placed.get(g.id)!.cap.cap.nub).toBe(false);
  });

  it("gives blank keys blank caps and reports what is short", () => {
    const p = importKle([
      ["", ""],
      [{ w: 9 }, "x"],
    ]);
    const fit = fitCaps(p, [{ kitId: "goforty", count: 1 }], ["R2", "R1"]);
    expect(fit.counts).toMatchObject({ ok: 2, missing: 1 });
    expect(missingBySize(fit.missing)).toEqual([{ size: "9u", count: 1 }]);
    for (const k of p.keys.slice(0, 2)) {
      expect(fit.placed.get(k.id)!.cap.cap.blank).toBe(true);
    }
  });

  it("falls back to a blank cap, then to another legend", () => {
    // GoForty Caps has no "Fn2"; it has blank 1u caps.
    const p = importKle([["Fn2"]]);
    const one = fitCaps(p, [{ kitId: "goforty", count: 1 }], ["R1"]);
    expect(one.counts).toMatchObject({ blank: 1 });
  });

  it("keeps a sculpted cap on its own row unless put elsewhere by hand", () => {
    const p = importKle([["Q"]]);
    const key = p.keys[0];
    // On the bottom row there is no R1 "Q": a blank R1 cap goes there.
    const auto = fitCaps(p, [{ kitId: "standard", count: 1 }], ["R1"]);
    expect(auto.placed.get(key.id)!.cap.cap.main).not.toBe("Q");
    const q = poolOf([{ kitId: "standard", count: 1 }]).find(
      (c) => c.cap.main === "Q",
    )!;
    const byHand = fitCaps(
      p,
      [{ kitId: "standard", count: 1 }],
      ["R1"],
      new Map([[key.id, q.id]]),
    );
    expect(byHand.placed.get(key.id)).toMatchObject({
      status: "ok",
      offRow: true,
      pinned: true,
    });
  });

  it("leaves a key bare when told to, and uses more sets when given", () => {
    const p = importKle([["Q", "Q"]]);
    const one = fitCaps(p, [{ kitId: "goforty", count: 1 }], ["R1"]);
    expect(one.counts.ok).toBe(1);
    const two = fitCaps(p, [{ kitId: "goforty", count: 2 }], ["R1"]);
    expect(two.counts.ok).toBe(2);
    const bare = fitCaps(
      p,
      [{ kitId: "goforty", count: 2 }],
      ["R1"],
      new Map([[p.keys[0].id, null]]),
    );
    expect(bare.counts).toMatchObject({ ok: 1, missing: 1 });
  });
});

describe("suggestions", () => {
  it("finds how many sets cover a layout one set cannot", () => {
    // Two full alphabets: one GoForty Caps has each letter once.
    const p = importKle(["QWERTYUIOP".split(""), "QWERTYUIOP".split("")]);
    const rows = rowsFor(p);
    const now = [{ kitId: "goforty", count: 1 }];
    expect(fitCaps(p, now, rows).counts.ok).toBe(10);
    const [best] = suggestSets(p, rows, now);
    expect(best.counts.missing).toBe(0);
    expect(best.counts.sub).toBe(0);
  });

  it("compares one of each set", () => {
    const p = sampleProject();
    const table = compareSets(p, rowsFor(p));
    expect(table.map((r) => r.kit.id)).toEqual([
      "standard",
      "premium",
      "lowprofile",
      "goforty",
      "clickprofile",
    ]);
    for (const row of table) {
      const { ok, blank, sub, missing } = row.counts;
      expect(ok + blank + sub + missing).toBe(38);
    }
  });
});
