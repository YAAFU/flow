import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { NativeThemeBootstrap } from "@/components/NativeThemeBootstrap";
import { StartupErrorBoundary } from "@/components/StartupErrorBoundary";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flow - คุมวันของคุณ",
  description: "ให้คนกรุงเทพคุมวันของตัวเอง ก่อนที่เมืองจะคุมเรา",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Flow", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  ...(process.env.FLOW_NATIVE_BUILD === "1"
    ? {}
    : { interactiveWidget: "resizes-content" as const }),
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

const themeBootstrap = `
try {
  const raw = localStorage.getItem("flow_state_v2");
  const saved = raw ? JSON.parse(raw)?.settings?.theme : "system";
  const dark = saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch { document.documentElement.dataset.theme = "light"; }
`;
const nativeBuild = process.env.FLOW_NATIVE_BUILD === "1";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={grotesk.variable} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {nativeBuild ? null : (
          <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        )}
      </head>
      <body>
        {nativeBuild ? <NativeThemeBootstrap /> : null}
        <StartupErrorBoundary>{children}</StartupErrorBoundary>
      </body>
    </html>
  );
}
