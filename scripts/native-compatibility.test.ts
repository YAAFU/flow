// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  makeCssWebViewCompatible,
  makeJavaScriptWebViewCompatible,
  NATIVE_WEBVIEW_TARGET,
} from "./native-compatibility.mjs";

describe("native WebView compatibility", () => {
  it("lowers logical assignment for the supported Android WebView target", async () => {
    const output = await makeJavaScriptWebViewCompatible(
      "let value; value ??= 'flow';",
    );

    expect(NATIVE_WEBVIEW_TARGET).toBe("chrome83");
    expect(output).not.toContain("??=");
    expect(output).toContain("value ?? (value = \"flow\")");
  });

  it("unwraps cascade layers and lowers modern transform properties", async () => {
    const output = await makeCssWebViewCompatible(
      "@layer utilities { .card { translate: 4px 0; color: oklch(80% .2 120); } }",
    );

    expect(output).not.toContain("@layer");
    expect(output).not.toMatch(/(?:^|[;{])translate:/);
    expect(output).toContain("transform:");
    expect(output).toContain(".card");
  });
});
