import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const OFFICIAL_ICON_SHA256 =
  "8118ad94559c50dd3be795cef7ac6a782ec90545c10f74863db11746e38b7eca";

export const ANDROID_ICON_DIMENSIONS = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 },
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export async function readPngDimensions(filename) {
  const buffer = await readFile(filename);
  if (
    buffer.length < 24
    || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    || buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`Not a valid PNG: ${filename}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function validateAndroidIcons(root = process.cwd()) {
  const errors = [];
  const resources = path.join(
    root,
    "android",
    "app",
    "src",
    "main",
    "res",
  );
  const source = path.join(
    root,
    "assets",
    "mobile",
    "flow-app-icon-1024.png",
  );

  try {
    const sourceInfo = await readPngDimensions(source);
    if (sourceInfo.width !== 1024 || sourceInfo.height !== 1024) {
      errors.push(
        `Official source icon must be 1024x1024, got `
          + `${sourceInfo.width}x${sourceInfo.height}.`,
      );
    }
    if (sourceInfo.sha256 !== OFFICIAL_ICON_SHA256) {
      errors.push(
        `Official source icon SHA-256 mismatch: ${sourceInfo.sha256}.`,
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const [density, dimensions] of Object.entries(
    ANDROID_ICON_DIMENSIONS,
  )) {
    const directory = path.join(resources, `mipmap-${density}`);
    for (const [filename, expectedSize] of [
      ["ic_launcher.png", dimensions.launcher],
      ["ic_launcher_round.png", dimensions.launcher],
      ["ic_launcher_foreground.png", dimensions.foreground],
    ]) {
      const icon = path.join(directory, filename);
      try {
        const info = await readPngDimensions(icon);
        if (info.bytes <= 24) {
          errors.push(`${icon} is empty.`);
        }
        if (info.width !== expectedSize || info.height !== expectedSize) {
          errors.push(
            `${icon} must be ${expectedSize}x${expectedSize}, got `
              + `${info.width}x${info.height}.`,
          );
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const manifestPath = path.join(
    root,
    "android",
    "app",
    "src",
    "main",
    "AndroidManifest.xml",
  );
  try {
    const manifest = await readFile(manifestPath, "utf8");
    if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) {
      errors.push("AndroidManifest.xml must reference @mipmap/ic_launcher.");
    }
    if (
      !manifest.includes(
        'android:roundIcon="@mipmap/ic_launcher_round"',
      )
    ) {
      errors.push(
        "AndroidManifest.xml must reference @mipmap/ic_launcher_round.",
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const filename of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const adaptivePath = path.join(
      resources,
      "mipmap-anydpi-v26",
      filename,
    );
    try {
      const adaptive = await readFile(adaptivePath, "utf8");
      if (
        !adaptive.includes(
          'android:drawable="@color/ic_launcher_background"',
        )
        || !adaptive.includes(
          'android:drawable="@mipmap/ic_launcher_foreground"',
        )
      ) {
        errors.push(
          `${filename} must reference the Flow adaptive background and foreground.`,
        );
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const background = await readFile(
      path.join(resources, "values", "ic_launcher_background.xml"),
      "utf8",
    );
    if (!background.toUpperCase().includes("#111111")) {
      errors.push("Adaptive launcher background must be #111111.");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const obsolete of [
    path.join(resources, "drawable", "ic_launcher_background.xml"),
    path.join(resources, "drawable-v24", "ic_launcher_foreground.xml"),
  ]) {
    try {
      await access(obsolete);
      const info = await stat(obsolete);
      if (info.isFile()) {
        errors.push(`Default Capacitor icon resource is still present: ${obsolete}`);
      }
    } catch {
      // Expected: generated Flow mipmaps replace the Capacitor vector assets.
    }
  }

  return { ok: errors.length === 0, errors };
}

const isCli =
  process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const result = await validateAndroidIcons();
  if (!result.ok) {
    throw new Error(
      `Android launcher icon validation failed:\n- ${result.errors.join("\n- ")}`,
    );
  }
  console.log(
    `Android launcher icons valid: `
      + `${Object.keys(ANDROID_ICON_DIMENSIONS).length} density buckets.`,
  );
}
