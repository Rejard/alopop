import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/add',
        destination: '/release.html',
      },
    ];
  },
};

export default nextConfig;
