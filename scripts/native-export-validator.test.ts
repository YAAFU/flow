import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  REQUIRED_NATIVE_ROUTES,
  REQUIRED_NATIVE_RSC_ALIASES,
  validateNativeExport,
} from "./native-export-validator.mjs";
import { createNativeStartupHtml } from "./native-startup.mjs";

const temporaryDirectories: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "flow-native-export-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "_next", "static"), { recursive: true });
  await writeFile(path.join(root, "_next", "static", "app.js"), "console.log(1)");
  for (const route of REQUIRED_NATIVE_ROUTES) {
    const filename = path.join(root, route);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(
      filename,
      '<!doctype html><script src="/_next/static/app.js"></script>',
    );
  }
  for (const alias of REQUIRED_NATIVE_RSC_ALIASES) {
    const filename = path.join(root, alias);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, "flow-rsc");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("native export validation", () => {
  it("accepts required routes when every referenced local asset exists", async () => {
    const root = await fixture();
    await expect(validateNativeExport(root)).resolves.toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("fails before sync when a chunk is missing or empty", async () => {
    const root = await fixture();
    await rm(path.join(root, "_next", "static", "app.js"));
    const result = await validateNativeExport(root);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("missing"))).toBe(true);
  });

  it("rejects JavaScript and CSS that the minimum native WebView cannot parse", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "_next", "static", "app.js"),
      "let value; value ??= 1;",
    );
    await writeFile(
      path.join(root, "_next", "static", "app.css"),
      "@layer utilities { .card { display: block } }",
    );

    const result = await validateNativeExport(root);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unsupported logical assignment"),
        expect.stringContaining("unsupported cascade layers"),
      ]),
    );
  });

  it("targets the exported login file instead of Capacitor's route fallback", () => {
    const html = createNativeStartupHtml();
    expect(html).toContain('content="0;url=/login/index.html"');
    expect(html).toContain('href="/login/index.html"');
    expect(html).not.toContain('url=./login/');
    expect(html).not.toContain('url=/login/"');
    expect(html).toContain("กำลังเปิด Flow");
    expect(html).not.toContain("<body></body>");
  });
});
