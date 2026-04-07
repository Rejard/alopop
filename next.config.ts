import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    const gameRewrites = Array.from({ length: 19 }, (_, i) => ({
      source: `/game-proxy/${3001 + i}/:path*`,
      destination: `http://127.0.0.1:${3001 + i}/:path*`
    }));

    return [
      {
        source: '/add',
        destination: '/release.html',
      },
      ...gameRewrites
    ];
  },
};

export default nextConfig;
