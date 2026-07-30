import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform as transformJavaScript } from "esbuild";
import { transform as transformCss } from "lightningcss";
import postcss from "postcss";

export const NATIVE_WEBVIEW_TARGET = "chrome83";

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

export async function makeJavaScriptWebViewCompatible(source, filename = "chunk.js") {
  const result = await transformJavaScript(source, {
    loader: "js",
    sourcefile: filename,
    target: NATIVE_WEBVIEW_TARGET,
    legalComments: "inline",
    minify: false,
  });
  return result.code;
}

function commaSeparateTopLevel(value) {
  let depth = 0;
  let output = "";
  for (const character of value.trim()) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (/\s/.test(character) && depth === 0) {
      if (!output.endsWith(",")) output += ",";
    } else {
      output += character;
    }
  }
  return output;
}

export async function makeCssWebViewCompatible(source, filename = "styles.css") {
  const lowered = transformCss({
    filename,
    code: Buffer.from(source),
    minify: true,
    targets: { chrome: 83 << 16 },
  }).code.toString();

  const root = postcss.parse(lowered, { from: filename });
  root.walkAtRules("layer", (rule) => {
    if (rule.nodes?.length) {
      rule.replaceWith(...rule.nodes);
    } else {
      rule.remove();
    }
  });
  root.walkRules((rule) => {
    let usesIndividualTransform = false;
    rule.walkDecls(/^(translate|rotate|scale)$/, (declaration) => {
      usesIndividualTransform = true;
      const property = declaration.prop;
      const value =
        property === "rotate"
          ? declaration.value
          : commaSeparateTopLevel(declaration.value);
      declaration.cloneBefore({
        prop: `--flow-native-${property}`,
        value,
      });
      declaration.remove();
    });
    if (usesIndividualTransform) {
      rule.append({
        prop: "transform",
        value:
          "translate(var(--flow-native-translate,0,0)) "
          + "rotate(var(--flow-native-rotate,0deg)) "
          + "scale(var(--flow-native-scale,1,1))",
      });
    }
  });
  return root.toString();
}

export async function transformNativeAssets(exportRoot) {
  const staticRoot = path.join(exportRoot, "_next", "static");
  const files = await filesUnder(staticRoot);
  let javaScriptFiles = 0;
  let cssFiles = 0;

  for (const filename of files) {
    if (filename.endsWith(".js")) {
      const source = await readFile(filename, "utf8");
      const compatible = await makeJavaScriptWebViewCompatible(source, filename);
      await writeFile(filename, compatible, "utf8");
      javaScriptFiles += 1;
    } else if (filename.endsWith(".css")) {
      const source = await readFile(filename, "utf8");
      const compatible = await makeCssWebViewCompatible(source, filename);
      await writeFile(filename, compatible, "utf8");
      cssFiles += 1;
    }
  }

  return { javaScriptFiles, cssFiles, target: NATIVE_WEBVIEW_TARGET };
}
