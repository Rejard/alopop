import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/add',
        destination: '/release.html',
      },
      {
        source: '/game-proxy/3090/:path*',
        destination: 'http://127.0.0.1:3090/:path*'
      },
      {
        source: '/game-proxy/3000/:path*',
        destination: 'http://127.0.0.1:3000/:path*'
      }
    ];
  },
};

export default nextConfig;
