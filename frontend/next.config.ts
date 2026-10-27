import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Resolve local SEO metadata with route content instead of streaming a second head update.
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'raw.githubusercontent.com', pathname: '/PokeAPI/sprites/**' }],
    minimumCacheTTL: 86400,
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};
export default config;
