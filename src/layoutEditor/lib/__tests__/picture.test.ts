import { pictureFrame } from "../picture";
import { sampleProject } from "../sample";
import { templateProject } from "../edit";

describe("the layout as a picture", () => {
  it("has room for every key, the name and the credit line", () => {
    const project = { ...sampleProject(), name: "My board" };
    const frame = pictureFrame(project)!;
    expect(frame.titleY).not.toBeNull();
    expect(frame.width).toBeGreaterThan(12 * frame.unit);
    expect(frame.creditY).toBeLessThan(frame.height);
    expect(frame.titleY!).toBeLessThan(frame.originY);
  });

  it("leaves out the title line of an unnamed layout and shrinks a big one to fit", () => {
    expect(pictureFrame(templateProject("ortho40"))!.titleY).toBeNull();
    const wide = templateProject("ortho40");
    wide.keys = wide.keys.map((k, i) => (i === 0 ? { ...k, cx: 60 } : k));
    const frame = pictureFrame(wide)!;
    expect(Math.max(frame.width, frame.height)).toBeLessThanOrEqual(2400);
  });

  it("makes nothing of an empty layout", () => {
    expect(pictureFrame(templateProject("empty"))).toBeNull();
  });
});
