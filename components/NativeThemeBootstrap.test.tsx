import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeThemeBootstrap } from "./NativeThemeBootstrap";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NativeThemeBootstrap", () => {
  it("applies the persisted theme after hydration", async () => {
    window.localStorage.setItem(
      "flow_state_v2",
      JSON.stringify({ settings: { theme: "dark" } }),
    );

    await act(async () => {
      root.render(<NativeThemeBootstrap />);
      await Promise.resolve();
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("recovers from malformed persisted state without blocking the UI", async () => {
    window.localStorage.setItem("flow_state_v2", "{broken");

    await act(async () => {
      root.render(<NativeThemeBootstrap />);
      await Promise.resolve();
    });

    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
