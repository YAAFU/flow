import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeProductGuide } from "@/lib/onboarding";

const runtime = vi.hoisted(() => ({
  routerReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: runtime.routerReplace }),
}));

import LoginPage from "@/app/login/page";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function quickAccessButton() {
  return [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((button) => button.textContent?.includes("เข้าใช้งานด่วน"));
}

async function renderLogin() {
  await act(async () => {
    root?.render(<LoginPage />);
    await Promise.resolve();
  });
}

async function enterQuickAccess() {
  await act(async () => {
    quickAccessButton()?.click();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.clear();
  runtime.routerReplace.mockReset();
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Login onboarding entry", () => {
  it("sends a first-time Guest to /guide even when old task data exists", async () => {
    window.localStorage.setItem("flow_state_v2", JSON.stringify({
      tasksByDay: { "2026-07-24": [{ id: "old-task" }] },
    }));
    await renderLogin();
    await enterQuickAccess();

    expect(runtime.routerReplace).toHaveBeenCalledWith("/guide");
  });

  it("sends a Guest who resolved the current Product Guide to /app", async () => {
    completeProductGuide(window.localStorage);
    await renderLogin();
    await enterQuickAccess();

    expect(runtime.routerReplace).toHaveBeenCalledWith("/app");
  });

  it("fails open to /app when onboarding state cannot be persisted", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await renderLogin();
    await enterQuickAccess();

    expect(runtime.routerReplace).toHaveBeenCalledWith("/app");
  });
});
