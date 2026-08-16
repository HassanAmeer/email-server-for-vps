import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    output: isDev ? undefined : "export",
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    ...(isDev
      ? {
          async rewrites() {
            return [
              {
                source: "/api/:path*",
                destination: "http://127.0.0.1:8081/api/:path*",
              },
              {
                source: "/storage/:path*",
                destination: "http://127.0.0.1:8081/storage/:path*",
              },
            ];
          },
        }
      : {}),
  };
};
