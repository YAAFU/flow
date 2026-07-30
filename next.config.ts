import type { NextConfig } from "next";

const isNativeBuild = process.env.FLOW_NATIVE_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isNativeBuild
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async redirects() {
          return [
            {
              source: "/",
              destination: "/login",
              permanent: false,
            },
          ];
        },
      }),
};

export default nextConfig;
