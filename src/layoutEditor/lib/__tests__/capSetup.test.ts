import { readCapSetup } from "../capSetup";
import { projectFileText, readCapSetupText, readLayoutText } from "../project";
import { sampleProject } from "../sample";

describe("the saved keycap setup", () => {
  it("comes back as it was saved", () => {
    const setup = {
      switchType: "mx" as const,
      sets: [{ kitId: "premium", count: 2 }],
      colours: { premium: "reflex-blue" },
      rows: { 1: "R3" },
      pins: [
        ["k1", "premium/0/5"],
        ["k2", null],
      ] as Array<[string, string | null]>,
    };
    expect(readCapSetup(JSON.parse(JSON.stringify(setup)))).toEqual(setup);
  });

  it("drops what is no longer valid and refuses what is not a setup", () => {
    expect(readCapSetup(null)).toBeNull();
    expect(readCapSetup([1, 2])).toBeNull();
    expect(
      readCapSetup({
        switchType: "optical",
        sets: [
          { kitId: "gone", count: 1 },
          { kitId: "premium", count: 99 },
          { kitId: "goforty", count: 1 },
        ],
        colours: { gone: "x", goforty: 3 },
        rows: { a: "R1", 2: "top" },
        pins: [["k1"], [1, "x"], ["k3", "goforty/0/1"]],
      }),
    ).toEqual({
      switchType: null,
      sets: [{ kitId: "goforty", count: 1 }],
      colours: {},
      rows: {},
      pins: [["k3", "goforty/0/1"]],
    });
  });

  it("travels in the project file, which still reads without one", () => {
    const project = sampleProject();
    const setup = readCapSetup({
      switchType: "lowprofile",
      sets: [{ kitId: "lowprofile", count: 1 }],
    })!;
    const text = projectFileText(project, setup);
    expect(readLayoutText(text)).toEqual(project);
    expect(readCapSetupText(text)).toEqual(setup);
    expect(readCapSetupText(projectFileText(project))).toBeNull();
    expect(readCapSetupText('[["a"]]')).toBeNull();
  });
});
