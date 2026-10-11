import { readCapSetup } from "../capSetup";
import {
  PROJECT_FILE,
  authorizeUrl,
  gistEntries,
  gistPayload,
  layoutFromFiles,
  returnedCode,
} from "../gists";
import { exportKle } from "../kle";
import { projectFileText, rowsToJson } from "../project";
import { sampleProject } from "../sample";

const CAPS = readCapSetup({})!;

describe("layouts in Gists", () => {
  it("lists the Gists that hold a layout, KLE's and this editor's", () => {
    const entries = gistEntries([
      {
        id: "a1",
        description: "My 40%",
        updated_at: "2026-10-01T00:00:00Z",
        public: true,
        html_url: "https://gist.github.com/u/a1",
        files: { "my-40.kbd.json": {} },
      },
      { id: "b2", description: "", files: { "notes.md": {} } },
      {
        id: "c3",
        description: "",
        public: false,
        files: { "thing.kbd.json": {}, [PROJECT_FILE]: {} },
      },
      null,
    ]);
    expect(entries.map((e) => [e.id, e.name, e.full, e.public])).toEqual([
      ["a1", "My 40%", false, true],
      ["c3", "thing", true, false],
    ]);
  });

  it("opens KLE's own file, named after the Gist when the data has no name", () => {
    const kle = rowsToJson(
      exportKle({ ...sampleProject(), name: "" }, "legend"),
    );
    const opened = layoutFromFiles({ "x.kbd.json": kle }, "From KLE")!;
    expect(opened.project.name).toBe("From KLE");
    expect(opened.project.keys).toHaveLength(sampleProject().keys.length);
    expect(opened.caps).toBeNull();
    expect(opened.kleFile).toBe("x.kbd.json");
  });

  it("prefers the project file, which keeps matrix numbers and keycaps", () => {
    const project = { ...sampleProject(), name: "Mine" };
    project.keys[0] = { ...project.keys[0], matrix: { row: 3, col: 4 } };
    const caps = readCapSetup({
      switchType: "mx",
      sets: [{ kitId: "premium", count: 1 }],
    })!;
    const payload = gistPayload(project, caps, null);
    const files = Object.fromEntries(
      Object.entries(payload.files).map(([n, f]) => [n, f!.content]),
    );
    expect(Object.keys(files).sort()).toEqual(["Mine.kbd.json", PROJECT_FILE]);
    const opened = layoutFromFiles(files, "")!;
    expect(opened.project).toEqual(project);
    expect(opened.caps).toEqual(caps);
    // The KLE file alone still opens (in KLE, or here without the other).
    expect(
      layoutFromFiles({ "Mine.kbd.json": files["Mine.kbd.json"] }, "")!.project
        .keys,
    ).toHaveLength(project.keys.length);
  });

  it("removes the old KLE file when the layout was renamed", () => {
    const project = { ...sampleProject(), name: "New name" };
    const payload = gistPayload(project, CAPS, "Old.kbd.json");
    expect(payload.description).toBe("New name");
    expect(payload.files["Old.kbd.json"]).toBeNull();
    expect(payload.files["New-name.kbd.json"]).not.toBeNull();
    expect(
      "New-name.kbd.json" in
        gistPayload(project, CAPS, "New-name.kbd.json").files,
    ).toBe(true);
    expect(
      Object.values(gistPayload(project, CAPS, "New-name.kbd.json").files),
    ).not.toContain(null);
  });

  it("makes nothing of files that are not layouts", () => {
    expect(layoutFromFiles({ "x.kbd.json": "not json" }, "")).toBeNull();
    expect(layoutFromFiles({ [PROJECT_FILE]: "{}" }, "")).toBeNull();
    expect(layoutFromFiles({}, "")).toBeNull();
    expect(projectFileText(sampleProject())).toContain("keebon-layout");
  });

  it("asks GitHub for Gists only, and takes back only its own return trip", () => {
    const url = new URL(authorizeUrl("id1", "st4te", "https://x.test/layout"));
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("scope")).toBe("gist");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.test/layout");
    expect(returnedCode("?code=abc&state=st4te", "st4te")).toBe("abc");
    expect(returnedCode("?code=abc&state=other", "st4te")).toBeNull();
    expect(returnedCode("?code=abc&state=st4te", null)).toBeNull();
    expect(returnedCode("?g=123", "st4te")).toBeNull();
  });
});
