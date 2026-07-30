import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartupErrorBoundary } from "@/components/StartupErrorBoundary";

let container: HTMLDivElement;
let root: Root;

function BrokenStartup(): never {
  throw new Error("storage initialization failed");
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StartupErrorBoundary", () => {
  it("renders a visible recovery screen without deleting task state", async () => {
    window.localStorage.setItem("flow_state_v2", '{"tasksByDay":{"safe":[]}}');

    await act(async () => {
      root.render(
        <StartupErrorBoundary>
          <BrokenStartup />
        </StartupErrorBoundary>,
      );
    });

    expect(container.textContent).toContain("เปิด Flow ไม่สำเร็จ");
    expect(container.textContent).toContain("ลองอีกครั้ง");
    expect(window.localStorage.getItem("flow_state_v2")).toBe(
      '{"tasksByDay":{"safe":[]}}',
    );
  });
});
