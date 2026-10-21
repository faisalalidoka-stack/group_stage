import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The share-card route reads its fonts from assets/fonts at runtime. Their
  // path is built dynamically, so tell Next to ship them with the route.
  outputFileTracingIncludes: {
    "/api/card/*": ["./assets/fonts/**/*"],
    "/api/card/**": ["./assets/fonts/**/*"],
    "/api/card/\\[kind\\]/\\[id\\]": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
