import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaRegister } from "@/components/PwaRegister";

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
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PwaRegister", () => {
  it("does not register a service worker in a native build and removes old shell caches", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const register = vi.fn();
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubEnv("NEXT_PUBLIC_FLOW_NATIVE_BUILD", "1");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
        getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
      },
    });
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["flow-shell-v2", "unrelated-cache"]),
      delete: deleteCache,
    });

    await act(async () => {
      root.render(<PwaRegister />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(register).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith("flow-shell-v2");
    expect(deleteCache).not.toHaveBeenCalledWith("unrelated-cache");
  });

  it("keeps the website PWA registration outside native builds", async () => {
    const register = vi.fn().mockResolvedValue({});
    vi.stubEnv("NEXT_PUBLIC_FLOW_NATIVE_BUILD", "0");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    await act(async () => {
      root.render(<PwaRegister />);
      await Promise.resolve();
    });

    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
