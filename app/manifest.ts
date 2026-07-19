import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flow — คุมวันของคุณ",
    short_name: "Flow",
    description: "วางแผนวันแบบ local-first",
    start_url: "/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    lang: "th",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
