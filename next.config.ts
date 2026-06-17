import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Defence-in-depth against CDN/browser caching responses that carry user
  // state: forbid storing any response under /dashboard or /account.
  async headers() {
    return [
      {
        source: '/(dashboard|account)(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then((m) => m.initOpenNextCloudflareForDev());
