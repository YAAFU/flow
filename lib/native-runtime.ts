type CapacitorBridge = {
  isNativePlatform?: () => boolean;
};

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

export function isNativeRuntime(
  bridge: CapacitorBridge | undefined =
    typeof window === "undefined" ? undefined : window.Capacitor,
  nativeBuild = process.env.NEXT_PUBLIC_FLOW_NATIVE_BUILD === "1",
): boolean {
  if (nativeBuild) return true;
  try {
    return bridge?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function safeStartupError(error: unknown): {
  type: string;
  message: string;
} {
  if (error instanceof Error) {
    return {
      type: error.name || "Error",
      message: error.message.slice(0, 180) || "Unknown startup error",
    };
  }
  return { type: "UnknownError", message: "Unknown startup error" };
}
