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
        source: '/game-proxy/3000/:path*',
        destination: 'http://127.0.0.1:3000/:path*'
      },
      {
        source: '/game-proxy/3010/:path*',
        destination: 'http://127.0.0.1:3010/:path*'
      },
      // Pet365Care: 이제 Alopop 내부 라우트로 운영 (프록시 제거됨)
    ];
  },
};

export default nextConfig;
