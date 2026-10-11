import { templateProject } from "../edit";
import {
  capFitsKey,
  compareSets,
  defaultRows,
  fitCaps,
  missingBySize,
  normalLabel,
  pileCaps,
  poolOf,
} from "../fit";
import { allKits, capsFromKle, kitById, kitsFor } from "../kits";
import { importKle } from "../kle";
import type { LayoutProject } from "../model";
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
    const fit = fitCaps(p, [{ kitId: "standard", count: 1 }], ["R1", "R1"]);
    expect(fit.counts).toMatchObject({ ok: 2, missing: 1 });
    expect(missingBySize(fit.missing)).toEqual([
      { w: 9, h: 1, iso: false, convex: false, count: 1 },
    ]);
    for (const k of p.keys.slice(0, 2)) {
      expect(fit.placed.get(k.id)!.cap.cap.blank).toBe(true);
    }
  });

  it("falls back to a blank cap, then to another legend", () => {
    // Standard has no "Fn2"; it has plain blank 1u caps for the bottom row.
    const p = importKle([["Fn2"]]);
    const one = fitCaps(p, [{ kitId: "standard", count: 1 }], ["R1"]);
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

describe("convex caps", () => {
  const low = [{ kitId: "lowprofile", count: 1 }];
  const standard = [{ kitId: "standard", count: 1 }];

  it("are the only caps a key marked convex takes", () => {
    const p = importKle([["", "a"]]);
    const marked = {
      ...p,
      keys: [{ ...p.keys[0], convex: true }, p.keys[1]],
    };
    const fit = fitCaps(marked, low, ["R1"]);
    expect(fit.placed.get(p.keys[0].id)!.cap.cap.convex).toBe(true);
    // The plain key next to it gets its own plain "a".
    expect(fit.placed.get(p.keys[1].id)!.cap.cap).toMatchObject({
      main: "a",
      convex: false,
    });
    const plain = poolOf(low).find((c) => !c.cap.convex && c.cap.w === 1)!;
    expect(capFitsKey(plain.cap, marked.keys[0])).toBe(false);
  });

  it("go on any key of their length, whatever the row", () => {
    // Standard's convex 2u is a bottom-row cap in the file; a 2u key on the
    // top row can still take it, and it is not "off row" there.
    const p = importKle([[{ w: 2 }, "x"]]);
    const convex = poolOf(standard).find((c) => c.cap.convex && c.cap.w === 2)!;
    expect(capFitsKey(convex.cap, p.keys[0])).toBe(true);
    const byHand = fitCaps(
      p,
      standard,
      ["R4"],
      new Map([[p.keys[0].id, convex.id]]),
    );
    expect(byHand.placed.get(p.keys[0].id)).toMatchObject({
      offRow: false,
      pinned: true,
    });
    expect(byHand.placed.get(p.keys[0].id)!.cap.id).toBe(convex.id);
  });

  it("are left for last on plain keys", () => {
    // A 2u key on the top row: the plain R4 2u cap goes on before the
    // convex 2u would.
    const p = importKle([[{ w: 2 }, ""]]);
    const fit = fitCaps(p, standard, ["R4"]);
    expect(fit.placed.get(p.keys[0].id)!.cap.cap.convex).toBe(false);
    // On the home row there is no plain 2u; the convex one covers it.
    const home = fitCaps(p, standard, ["R2"]);
    expect(home.placed.get(p.keys[0].id)!.cap.cap.convex).toBe(true);
  });

  it("are counted as their own shape when short", () => {
    const p = importKle([[{ w: 9 }, ""]]);
    const marked = { ...p, keys: [{ ...p.keys[0], convex: true }] };
    expect(missingBySize(fitCaps(marked, low, ["R1"]).missing)).toEqual([
      { w: 9, h: 1, iso: false, convex: true, count: 1 },
    ]);
  });
});

describe("pileCaps", () => {
  it("sorts spare caps by row, then length, then shape", () => {
    const piles = pileCaps(poolOf([{ kitId: "standard", count: 1 }]));
    const names = piles.map(
      (p) => `${p.row ?? "-"} ${p.w}x${p.h}${p.iso ? " iso" : ""}`,
    );
    expect(names.slice(0, 3)).toEqual(["R4 1x1", "R4 2x1", "R3 1x1"]);
    expect(names[names.length - 1].startsWith("-")).toBe(true);
    expect(piles.reduce((n, p) => n + p.caps.length, 0)).toBe(185);
    // Each pile is one row, one size, one shape.
    for (const pile of piles) {
      for (const { cap } of pile.caps) {
        expect([cap.row, cap.w, cap.h, cap.convex]).toEqual([
          pile.row,
          pile.w,
          pile.h,
          pile.convex,
        ]);
      }
    }
  });

  it("keeps convex caps in a pile of their own", () => {
    const piles = pileCaps(poolOf([{ kitId: "lowprofile", count: 1 }]));
    const oneU = piles.filter((p) => p.w === 1 && p.h === 1);
    expect(oneU.map((p) => p.convex)).toEqual([false, true]);
  });
});

describe("switches and comparison", () => {
  it("offers only the sets that go on the chosen switches", () => {
    const ids = (type: Parameters<typeof kitsFor>[0]) =>
      kitsFor(type).map((k) => k.id);
    expect(ids("mx")).toEqual(["standard", "premium", "lowprofile", "goforty"]);
    expect(ids("lowprofile")).toEqual(["lowprofile", "goforty"]);
    expect(ids("click")).toEqual(["clickprofile"]);
  });

  it("compares one of each set given", () => {
    const p = sampleProject();
    const table = compareSets(p, rowsFor(p), kitsFor("lowprofile"));
    expect(table.map((r) => r.kit.id)).toEqual(["lowprofile", "goforty"]);
    for (const row of table) {
      const { ok, blank, sub, missing } = row.counts;
      expect(ok + blank + sub + missing).toBe(38);
    }
  });
});

describe("upright keys", () => {
  const upright = (): LayoutProject => ({
    name: "",
    groups: [],
    keys: [
      {
        id: "tall",
        cx: 0.5,
        cy: 0.625,
        w: 1,
        h: 1.25,
        angle: 0,
        legends: Array(12).fill(""),
      },
    ],
  });

  it("take the wide cap of their size turned round, from a set with uniform rows", () => {
    const fit = fitCaps(
      upright(),
      [{ kitId: "clickprofile", count: 1 }],
      ["R1"],
    );
    const placed = fit.placed.get("tall")!;
    expect(placed.cap.cap.w).toBe(1.25);
    expect(placed.cap.cap.h).toBe(1);
    expect(placed.turned).toBe(true);
    expect(capFitsKey(placed.cap.cap, upright().keys[0])).toBe(true);
  });

  it("are not given a turned cap from a set sculpted by row", () => {
    const fit = fitCaps(upright(), [{ kitId: "premium", count: 1 }], ["R1"]);
    expect(fit.placed.has("tall")).toBe(false);
  });

  it("leave ordinary keys untouched: nothing is turned", () => {
    const fit = fitCaps(
      sampleProject(),
      [{ kitId: "lowprofile", count: 1 }],
      ["R4", "R3", "R2", "R1"],
    );
    expect([...fit.placed.values()].some((p) => p.turned)).toBe(false);
  });
});
