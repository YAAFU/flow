// @vitest-environment node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createNativeRouteAssetAliases } from "./native-route-assets.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("native route asset aliases", () => {
  it("maps nested Next RSC assets to the filename requested by Capacitor", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "flow-native-routes-"));
    temporaryDirectories.push(root);
    const nested = path.join(root, "policy", "__next.policy");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(nested, "__PAGE__.txt"), "flow-rsc");

    await expect(createNativeRouteAssetAliases(root)).resolves.toBe(1);
    await expect(
      readFile(path.join(root, "policy", "__next.policy.__PAGE__.txt"), "utf8"),
    ).resolves.toBe("flow-rsc");
  });
});
