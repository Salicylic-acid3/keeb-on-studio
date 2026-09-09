import {
  FIRMWARE_BOARDS,
  firmwareDownloadUrl,
  firmwareReleasesUrl,
} from "../firmwareDownloads";
import { SUPPORTED_DEVICE_NAMES } from "../supportedDevices";

describe("firmwareDownloadUrl", () => {
  it("builds GitHub's latest-release permalink", () => {
    // This exact shape is the reason the page needs no GitHub API call.
    expect(firmwareDownloadUrl("owner/repo", "thing")).toBe(
      "https://github.com/owner/repo/releases/latest/download/thing.uf2",
    );
  });

  it("points at the releases page for changelogs", () => {
    expect(firmwareReleasesUrl("owner/repo")).toBe(
      "https://github.com/owner/repo/releases",
    );
  });
});

describe("FIRMWARE_BOARDS", () => {
  it("covers every keyboard the app will connect to", () => {
    // A supported keyboard with no download entry would leave its owner with
    // no way to get firmware from the app.
    expect(FIRMWARE_BOARDS).toHaveLength(SUPPORTED_DEVICE_NAMES.length);
  });

  it("names each repository as owner/repo", () => {
    for (const board of FIRMWARE_BOARDS) {
      expect(board.repo).toMatch(/^[\w.-]+\/[\w.-]+$/);
    }
  });

  it("gives every board something to flash besides the recovery image", () => {
    for (const board of FIRMWARE_BOARDS) {
      expect(board.files.some((file) => !file.recovery)).toBe(true);
    }
  });

  it("offers a settings reset for every board", () => {
    // It is the escape hatch when pairings or stored settings go bad.
    for (const board of FIRMWARE_BOARDS) {
      expect(board.files.some((file) => file.recovery)).toBe(true);
    }
  });

  it("gives a split keyboard one image per half", () => {
    for (const board of FIRMWARE_BOARDS.filter((b) => b.split)) {
      expect(board.files.filter((file) => !file.recovery)).toHaveLength(2);
    }
  });

  it("uses asset names that are unique within a board", () => {
    // The asset name is the release filename; a duplicate would mean one of
    // the download links silently fetches the wrong image.
    for (const board of FIRMWARE_BOARDS) {
      const assets = board.files.map((file) => file.asset);
      expect(new Set(assets).size).toBe(assets.length);
    }
  });

  it("uses asset names that can appear in a URL unescaped", () => {
    for (const board of FIRMWARE_BOARDS) {
      for (const file of board.files) {
        expect(file.asset).toMatch(/^[\w-]+$/);
      }
    }
  });
});
