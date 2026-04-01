import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    unoptimized: true,
    remotePatterns: [
      // MinIO / CDN ที่ใช้งานจริง
      { protocol: "https", hostname: "cdn.julaherb.saversure.com" },
      { protocol: "https", hostname: "*.saversure.com" },
      // dev: MinIO โดยตรง
      { protocol: "http", hostname: "192.168.0.41", port: "9010" },
      { protocol: "http", hostname: "localhost", port: "9010" },
      { protocol: "http", hostname: "localhost", port: "59300" },
      // placeholder images
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:30400/api/:path*",
      },
      {
        source: "/auth/:path*",
        destination: "http://localhost:30400/auth/:path*",
      },
      {
        source: "/media/:path*",
        destination: "http://localhost:30400/media/:path*",
      },
    ];
  },
};

export default nextConfig;
