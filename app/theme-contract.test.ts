import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Flow semantic theme contract", () => {
  const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

  it("defines semantic surfaces, text, borders, inputs, overlay, accent and danger tokens", () => {
    [
      "--flow-surface-page",
      "--flow-surface-card",
      "--flow-surface-elevated",
      "--flow-surface-muted",
      "--flow-text-primary",
      "--flow-text-secondary",
      "--flow-text-muted",
      "--flow-border-default",
      "--flow-border-strong",
      "--flow-input-background",
      "--flow-overlay-background",
      "--flow-accent",
      "--flow-accent-foreground",
      "--flow-danger",
    ].forEach((token) => expect(css).toContain(token));
  });

  it("gives native date and time controls a dark color scheme only in the dark theme", () => {
    expect(css).toContain('html[data-theme="dark"] .flow-planner-dialog');
    expect(css).toContain('input[type="date"]');
    expect(css).toContain('input[type="time"]');
    expect(css).toContain("color-scheme:dark");
  });
});
