import { cp, mkdir, rm, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { transformNativeAssets } from "./native-compatibility.mjs";
import { createNativeRouteAssetAliases } from "./native-route-assets.mjs";
import { createNativeStartupHtml } from "./native-startup.mjs";

const root = process.cwd();
const nativeOutput = path.join(root, "out-native");
const shadowRoot = path.join(root, ".native-build", "source");
const nextOutput = path.join(shadowRoot, "out");
const nextBin = path.join(
  root,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

await rm(nativeOutput, { recursive: true, force: true });
await rm(path.dirname(shadowRoot), { recursive: true, force: true });
await mkdir(shadowRoot, { recursive: true });

const sourceEntries = [
  "app",
  "components",
  "hooks",
  "lib",
  "public",
  "next.config.ts",
  "next-env.d.ts",
  "package.json",
  "postcss.config.mjs",
  "tsconfig.json",
];

for (const entry of sourceEntries) {
  await cp(path.join(root, entry), path.join(shadowRoot, entry), {
    recursive: true,
    filter(source) {
      const relative = path.relative(root, source);
      return relative !== path.join("app", "api")
        && !relative.startsWith(`${path.join("app", "api")}${path.sep}`);
    },
  });
}

try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, "build"], {
      cwd: shadowRoot,
      env: {
        ...process.env,
        FLOW_NATIVE_BUILD: "1",
        NEXT_PUBLIC_FLOW_NATIVE_BUILD: "1",
      },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`Native web export failed with exit code ${exitCode}`);
  }

  await rename(nextOutput, nativeOutput);
  const compatibility = await transformNativeAssets(nativeOutput);
  const routeAliases = await createNativeRouteAssetAliases(nativeOutput);
  await writeFile(
    path.join(nativeOutput, "index.html"),
    createNativeStartupHtml(),
    "utf8",
  );

  console.log(
    `Fresh native export created at ${nativeOutput} `
      + `(${compatibility.javaScriptFiles} JS and ${compatibility.cssFiles} CSS assets `
      + `target ${compatibility.target}; ${routeAliases} route aliases)`,
  );
} finally {
  await rm(path.dirname(shadowRoot), { recursive: true, force: true });
}
