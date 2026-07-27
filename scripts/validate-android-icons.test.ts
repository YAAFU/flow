import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ANDROID_ICON_DIMENSIONS,
  readPngDimensions,
  validateAndroidIcons,
} from "./validate-android-icons.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Android launcher icon validation", () => {
  it("keeps Android-standard launcher and foreground dimensions", () => {
    expect(ANDROID_ICON_DIMENSIONS).toEqual({
      mdpi: { launcher: 48, foreground: 108 },
      hdpi: { launcher: 72, foreground: 162 },
      xhdpi: { launcher: 96, foreground: 216 },
      xxhdpi: { launcher: 144, foreground: 324 },
      xxxhdpi: { launcher: 192, foreground: 432 },
    });
  });

  it("accepts the committed official Flow icon resources", async () => {
    await expect(validateAndroidIcons()).resolves.toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects a corrupt PNG with a useful error", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "flow-android-icon-"),
    );
    temporaryDirectories.push(directory);
    const filename = path.join(directory, "broken.png");
    await writeFile(filename, "not a png");

    await expect(readPngDimensions(filename)).rejects.toThrow(
      "Not a valid PNG",
    );
  });
});
