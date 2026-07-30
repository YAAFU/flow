import { describe, expect, it } from "vitest";
import { isNativeRuntime, safeStartupError } from "@/lib/native-runtime";

describe("native runtime detection", () => {
  it("uses the explicit native build marker without depending on a browser URL", () => {
    expect(isNativeRuntime(undefined, true)).toBe(true);
  });

  it("uses the Capacitor bridge and handles a broken bridge safely", () => {
    expect(isNativeRuntime({ isNativePlatform: () => true }, false)).toBe(true);
    expect(
      isNativeRuntime(
        {
          isNativePlatform: () => {
            throw new Error("bridge unavailable");
          },
        },
        false,
      ),
    ).toBe(false);
  });

  it("sanitizes non-error startup failures", () => {
    expect(safeStartupError({ token: "must-not-leak" })).toEqual({
      type: "UnknownError",
      message: "Unknown startup error",
    });
  });
});
