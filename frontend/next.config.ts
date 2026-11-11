import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'raw.githubusercontent.com', pathname: '/PokeAPI/sprites/**' }],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [{
      source: '/fonts/pretendard/1.3.9/:file',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Keep older CSS font URLs working; this alias stays pinned to 1.3.9.
        { source: '/fonts/pretendard/:file', destination: '/fonts/pretendard/1.3.9/:file' },
        ...['', '/chat', '/pokedex', '/meta', '/scenario', '/pobti'].map(path => ({
          source: path || '/', destination: `/en${path}`,
        })),
        { source: '/pokedex/:slugId', destination: '/en/pokedex/:slugId' },
        { source: '/meta/:slugId', destination: '/en/meta/:slugId' },
        { source: '/pobti/:type', destination: '/en/pobti/:type' },
      ],
      afterFiles: [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }],
    };
  },
};
export default config;
