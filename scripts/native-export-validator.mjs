import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_NATIVE_ROUTES = [
  "index.html",
  "login/index.html",
  "guide/index.html",
  "app/index.html",
];
export const REQUIRED_NATIVE_RSC_ALIASES = [
  "login/__next.login.__PAGE__.txt",
  "guide/__next.guide.__PAGE__.txt",
  "app/__next.app.__PAGE__.txt",
  "policy/__next.policy.__PAGE__.txt",
];

const REFERENCE_PATTERN =
  /<(?:script|link)\b[^>]*(?:src|href)=["']([^"'#]+)["'][^>]*>/gi;

function localReference(reference) {
  return (
    !reference.startsWith("data:") &&
    !reference.startsWith("http:") &&
    !reference.startsWith("https:") &&
    !reference.startsWith("//")
  );
}

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

export function resolveExportReference(exportRoot, htmlFile, reference) {
  const withoutQuery = decodeURIComponent(reference.split("?")[0]);
  const relative = withoutQuery.startsWith("/")
    ? withoutQuery.slice(1)
    : path.join(path.dirname(path.relative(exportRoot, htmlFile)), withoutQuery);
  return path.resolve(exportRoot, relative);
}

export async function validateNativeExport(exportRoot) {
  const root = path.resolve(exportRoot);
  const errors = [];
  let checkedAssets = 0;

  for (const route of REQUIRED_NATIVE_ROUTES) {
    const htmlFile = path.join(root, route);
    let html;
    try {
      html = await readFile(htmlFile, "utf8");
      if (!html.trim()) errors.push(`${route}: HTML is empty`);
    } catch {
      errors.push(`${route}: required route is missing`);
      continue;
    }

    for (const match of html.matchAll(REFERENCE_PATTERN)) {
      const reference = match[1];
      if (!localReference(reference)) continue;
      const asset = resolveExportReference(root, htmlFile, reference);
      if (!asset.startsWith(`${root}${path.sep}`) && asset !== root) {
        errors.push(`${route}: asset escapes export root (${reference})`);
        continue;
      }
      checkedAssets += 1;
      try {
        const details = await stat(asset);
        if (!details.isFile()) {
          errors.push(`${route}: referenced asset is not a file (${reference})`);
        } else if (details.size === 0) {
          errors.push(`${route}: referenced asset is empty (${reference})`);
        }
      } catch {
        errors.push(`${route}: referenced asset is missing (${reference})`);
      }
    }
  }

  for (const alias of REQUIRED_NATIVE_RSC_ALIASES) {
    try {
      const details = await stat(path.join(root, alias));
      if (!details.isFile() || details.size === 0) {
        errors.push(`${alias}: required route asset alias is empty`);
      }
    } catch {
      errors.push(`${alias}: required route asset alias is missing`);
    }
  }

  try {
    const nextStaticRoot = path.join(root, "_next", "static");
    const nextStatic = await stat(nextStaticRoot);
    if (!nextStatic.isDirectory()) errors.push("_next/static is not a directory");
    const staticFiles = await filesUnder(nextStaticRoot);
    for (const filename of staticFiles) {
      if (!filename.endsWith(".js") && !filename.endsWith(".css")) continue;
      const source = await readFile(filename, "utf8");
      const relative = path.relative(root, filename);
      if (filename.endsWith(".js") && source.includes("??=")) {
        errors.push(`${relative}: contains unsupported logical assignment`);
      }
      if (filename.endsWith(".css") && /@layer(?:\s|{)/.test(source)) {
        errors.push(`${relative}: contains unsupported cascade layers`);
      }
    }
  } catch {
    errors.push("_next/static is missing");
  }

  if (checkedAssets === 0) {
    errors.push("no local script or stylesheet references were found");
  }

  return { ok: errors.length === 0, errors, checkedAssets };
}
