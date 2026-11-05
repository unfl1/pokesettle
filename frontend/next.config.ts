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
  async rewrites() {
    return {
      beforeFiles: [
        ...['', '/chat', '/pokedex', '/meta', '/scenario', '/pobti'].map(path => ({
          source: path || '/', destination: `/en${path}`,
        })),
        { source: '/pokedex/:slugId', destination: '/en/pokedex/:slugId' },
        { source: '/pobti/:type', destination: '/en/pobti/:type' },
      ],
      afterFiles: [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }],
    };
  },
};
export default config;
