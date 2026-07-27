import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "site.nsys.flow",
  appName: "Flow",
  webDir: "out-native",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled:
      process.env.CAPACITOR_ANDROID_DEBUG === "1",
  },
  plugins: {
    SystemBars: {
      // Capacitor's CSS mode mutates <html style> before React hydrates and
      // older WebViews can report documentElement as null during redirects.
      // Android already keeps this WebView inside the system bars.
      insetsHandling: "disable",
    },
  },
};

export default config;
