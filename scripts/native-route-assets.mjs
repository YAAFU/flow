import { copyFile, readdir } from "node:fs/promises";
import path from "node:path";

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(filename));
    if (entry.isFile()) files.push(filename);
  }
  return files;
}

export async function createNativeRouteAssetAliases(exportRoot) {
  const routes = await readdir(exportRoot, { withFileTypes: true });
  let aliases = 0;

  for (const route of routes) {
    if (!route.isDirectory() || route.name === "_next") continue;
    const routeRoot = path.join(exportRoot, route.name);
    const routeEntries = await readdir(routeRoot, { withFileTypes: true });
    for (const entry of routeEntries) {
      if (!entry.isDirectory() || !entry.name.startsWith("__next.")) continue;
      const directory = path.join(routeRoot, entry.name);
      for (const source of await filesUnder(directory)) {
        if (!source.endsWith(".txt")) continue;
        const suffix = path.relative(directory, source).split(path.sep).join(".");
        const alias = path.join(routeRoot, `${entry.name}.${suffix}`);
        await copyFile(source, alias);
        aliases += 1;
      }
    }
  }

  return aliases;
}
