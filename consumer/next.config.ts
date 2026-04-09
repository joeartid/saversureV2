import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ["julaherb.svsu.me", "julasherb.svsu.me"],
  devIndicators: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tdn.julaherb.saversure.com",
      },
      {
        protocol: "https",
        hostname: "*.svsu.me",
      },
      {
        protocol: "https",
        hostname: "*.saversure.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "192.168.0.41",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "s3.konvy.com",
      },
      {
        protocol: "https",
        hostname: "media.allonline.7eleven.co.th",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:30400/api/:path*",
      },
      {
        source: "/auth/:path*",
        destination: "http://127.0.0.1:30400/auth/:path*",
      },
      {
        source: "/media/:path*",
        destination: "http://127.0.0.1:30400/media/:path*",
      },
    ];
  },
};

export default nextConfig;
