import { readCapSetup } from "../capSetup";
import {
  layoutLink,
  linkedLayoutId,
  readGalleryLayout,
} from "../galleryClient";
import { projectFileText } from "../project";
import { sampleProject } from "../sample";

describe("layouts from the gallery", () => {
  it("opens what was published, keycap choices included", () => {
    const project = { ...sampleProject(), name: "Mine" };
    const caps = readCapSetup({
      switchType: "mx",
      sets: [{ kitId: "premium", count: 1 }],
      colours: { premium: "kirisame" },
    })!;
    const sent = {
      file: JSON.parse(projectFileText(project, caps)),
      description: "hello",
      card: {},
    };
    expect(readGalleryLayout(sent)).toEqual({
      project,
      caps,
      description: "hello",
    });
  });

  it("refuses an answer that is not a layout", () => {
    expect(readGalleryLayout(null)).toBeNull();
    expect(readGalleryLayout({ file: { format: "other" } })).toBeNull();
    expect(
      readGalleryLayout({ file: { format: "keebon-layout", project: {} } }),
    ).toBeNull();
  });

  it("reads the id out of a shared link and nothing else", () => {
    const id = "98208267639999-id000001";
    expect(linkedLayoutId(new URL(layoutLink(id)).search)).toBe(id);
    expect(linkedLayoutId("?g=../../etc")).toBeNull();
    expect(linkedLayoutId("")).toBeNull();
  });
});
