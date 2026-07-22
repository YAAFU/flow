import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnergyLevelSelector } from "@/components/planner/EnergyLevelSelector";
import type { DayEnergy } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function Harness() {
  const [energy, setEnergy] = useState<DayEnergy>("medium");
  return <EnergyLevelSelector value={energy} onChange={setEnergy} />;
}

function radio(value: DayEnergy): HTMLInputElement {
  const input = container?.querySelector<HTMLInputElement>(`input[value="${value}"]`);
  expect(input).toBeTruthy();
  return input!;
}

function press(element: HTMLInputElement, key: string) {
  act(() => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("EnergyLevelSelector", () => {
  it("maps the stable energy values to the Thai labels", () => {
    expect(radio("low").parentElement?.textContent).toContain("น้อย");
    expect(radio("medium").parentElement?.textContent).toContain("กลาง");
    expect(radio("high").parentElement?.textContent).toContain("มาก");
  });

  it("supports arrow, Home, and End keyboard navigation", () => {
    press(radio("medium"), "ArrowLeft");
    expect(radio("low").checked).toBe(true);
    expect(document.activeElement).toBe(radio("low"));

    press(radio("low"), "ArrowLeft");
    expect(radio("high").checked).toBe(true);

    press(radio("high"), "Home");
    expect(radio("low").checked).toBe(true);

    press(radio("low"), "End");
    expect(radio("high").checked).toBe(true);
  });
});
