import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "development" ? undefined : "export",
  trailingSlash: true,
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
};

export default nextConfig;
