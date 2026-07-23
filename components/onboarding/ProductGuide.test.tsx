import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultState } from "@/lib/storage";
import { loadOnboardingState } from "@/lib/onboarding";

const runtime = vi.hoisted(() => ({
  flowState: null as unknown,
  routerReplace: vi.fn(),
  track: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: runtime.routerReplace }),
}));

vi.mock("@/hooks/useFlowStore", () => ({
  useFlowStore: () => ({
    state: runtime.flowState,
    hydrated: true,
    updateFlow: (updater: (previous: unknown) => unknown) => {
      runtime.flowState = updater(runtime.flowState);
    },
  }),
}));

vi.mock("@/lib/product-analytics", () => ({
  trackProductEvent: runtime.track,
}));

import GuidePage from "@/app/guide/page";
import { ProductGuide } from "@/components/onboarding/ProductGuide";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function findButton(label: string) {
  return [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) =>
    button.textContent?.replace(/\s+/g, " ").trim().includes(label),
  );
}

async function click(button: HTMLButtonElement | undefined) {
  expect(button).toBeTruthy();
  await act(async () => {
    button?.click();
    await Promise.resolve();
  });
}

async function renderGuide() {
  await act(async () => {
    root?.render(<ProductGuide />);
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  });
  await vi.waitFor(() => expect(container?.textContent).not.toContain("กำลังเตรียม Guide"));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("fetch", vi.fn());
  window.localStorage.clear();
  window.history.replaceState({}, "", "/guide");
  runtime.flowState = createDefaultState(new Date("2026-07-23T00:00:00.000Z"));
  runtime.routerReplace.mockReset();
  runtime.track.mockReset();
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
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("/guide route", () => {
  it("renders ProductGuide", () => {
    expect(GuidePage().type).toBe(ProductGuide);
  });
});

describe("three-page Product Guide", () => {
  it("has exactly three normal pages and keeps the Before/After and comparison concepts", async () => {
    await renderGuide();
    expect(container?.textContent).toContain("1 / 3");
    expect(container?.textContent).toContain("ก่อนจัด");
    expect(container?.textContent).toContain("หลังจัด");

    await click(findButton("ต่อไป"));
    expect(container?.textContent).toContain("2 / 3");
    expect(container?.textContent).toContain("ปฏิทินทั่วไป");
    expect(container?.textContent).toContain("ผู้ใช้ยังเป็นคนยืนยันแผนสุดท้าย");

    await click(findButton("ต่อไป"));
    expect(container?.textContent).toContain("3 / 3");
    expect(container?.textContent).toContain("เพิ่มสิ่งที่ต้องทำ");
    expect(container?.textContent).toContain("ให้ Flow จัดเวลา");
    expect(container?.textContent).toContain("เริ่มลงมือทำ");
    expect(findButton("เริ่มวางแผนวันแรก")).toBeTruthy();
    expect(container?.textContent).not.toContain("4 / 4");
  });

  it("starts Interactive Quick Start and routes to /app without creating sample tasks", async () => {
    const before = JSON.stringify(runtime.flowState);
    await renderGuide();
    await click(findButton("ต่อไป"));
    await click(findButton("ต่อไป"));
    await click(findButton("เริ่มวางแผนวันแรก"));

    const guidance = loadOnboardingState(window.localStorage);
    expect(guidance.productGuide.status).toBe("completed");
    expect(guidance.quickStart).toMatchObject({ status: "started", stage: "add_task" });
    expect(runtime.routerReplace).toHaveBeenCalledWith("/app?quickStart=1");
    expect(JSON.stringify(runtime.flowState)).toBe(before);
    expect(runtime.track).not.toHaveBeenCalledWith("tour_reopened", expect.anything());
  });

  it("skips Product Guide and Quick Start without touching task state", async () => {
    const before = JSON.stringify(runtime.flowState);
    await renderGuide();
    await click(findButton("ข้ามและเริ่มใช้"));
    const guidance = loadOnboardingState(window.localStorage);
    expect(guidance.productGuide.status).toBe("skipped");
    expect(guidance.quickStart.status).toBe("skipped");
    expect(runtime.routerReplace).toHaveBeenCalledWith("/app");
    expect(JSON.stringify(runtime.flowState)).toBe(before);
  });
});

describe("optional Sample Day routes", () => {
  it("keeps start=templates outside Product Guide page count", async () => {
    window.history.replaceState({}, "", "/guide?start=templates");
    await renderGuide();
    expect(container?.textContent).toContain("ลองด้วยวันตัวอย่าง");
    expect(container?.textContent).toContain("เลือกวันที่ใกล้กับชีวิตคุณ");
    expect(container?.textContent).not.toContain("3 / 3");
  });

  it("keeps start=comparison available without starting Quick Start", async () => {
    window.history.replaceState({}, "", "/guide?start=comparison");
    await renderGuide();
    expect(container?.textContent).toContain("Flow ต่างจากปฏิทินอย่างไร");
    expect(loadOnboardingState(window.localStorage).quickStart.status).toBe("not_started");
  });

  it("still builds and confirms a Sample Day with the offline local planner", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    window.history.replaceState({}, "", "/guide?start=templates");
    await renderGuide();
    await click(findButton("วันเรียน"));
    await click(findButton("ใช้ฉบับร่างนี้"));
    expect(container?.textContent).toContain("สร้างแผนวันแรก");
    await click(findButton("จัดวันแรกของฉัน"));
    await vi.waitFor(() => expect(container?.textContent).toContain("แผนพร้อมให้ตรวจแล้ว"));
    await click(findButton("ยืนยันแผนนี้"));
    expect(Object.values((runtime.flowState as ReturnType<typeof createDefaultState>).tasksByDay).flat().length).toBeGreaterThan(0);
    expect(runtime.routerReplace).toHaveBeenCalledWith(expect.stringContaining("/app?date="));
  });
});
