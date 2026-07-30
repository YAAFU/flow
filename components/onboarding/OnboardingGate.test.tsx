import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeProductGuide,
  skipProductGuide,
} from "@/lib/onboarding";
import type { StorageLike } from "@/lib/storage";

const runtime = vi.hoisted(() => ({
  routerReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: runtime.routerReplace }),
}));

import { OnboardingGate } from "@/components/onboarding/OnboardingGate";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;

async function renderGate(storage: StorageLike) {
  await act(async () => {
    root?.render(
      <OnboardingGate storage={storage}>
        <p>Planner ready</p>
      </OnboardingGate>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
  vi.unstubAllGlobals();
});

describe("direct /app onboarding gate", () => {
  it("redirects a first visit to /guide without rendering the Planner", async () => {
    await renderGate(new MemoryStorage());

    expect(runtime.routerReplace).toHaveBeenCalledWith("/guide");
    expect(container?.textContent).not.toContain("Planner ready");
  });

  it.each([
    ["completed", completeProductGuide],
    ["skipped", skipProductGuide],
  ] as const)("allows a current Product Guide that was %s", async (_status, resolveGuide) => {
    const storage = new MemoryStorage();
    resolveGuide(storage);
    await renderGate(storage);

    expect(runtime.routerReplace).not.toHaveBeenCalled();
    expect(container?.textContent).toContain("Planner ready");
  });

  it("fails open instead of creating a redirect loop when storage is blocked", async () => {
    const unavailable: StorageLike = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    };
    await renderGate(unavailable);

    expect(runtime.routerReplace).not.toHaveBeenCalled();
    expect(container?.textContent).toContain("Planner ready");
  });
});
