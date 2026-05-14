/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/add',
        destination: '/release.html',
      },
      // 게임 점수 API: Alopop iframe에서 /api/highscore 요청을 game-portal로 프록시
      {
        source: '/api/highscore/:gameId',
        destination: 'http://127.0.0.1:3000/api/highscore/:gameId'
      },
      {
        source: '/game-proxy/3090/:path*',
        destination: 'http://127.0.0.1:3090/:path*'
      },
      {
        source: '/game-proxy/3000/:path*',
        destination: 'http://127.0.0.1:3000/:path*'
      },
      {
        source: '/game-proxy/3010/:path*',
        destination: 'http://127.0.0.1:3010/:path*'
      },
      // Pet365Care: 모바일에서 localhost 대신 Alopop 도메인 경유
      {
        source: '/pet365care/:path*',
        destination: 'http://127.0.0.1:3065/:path*'
      }
    ];
  },
};

export default nextConfig;
