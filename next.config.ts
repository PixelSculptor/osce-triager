import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Keep `postgres` out of Next's bundle so @opennextjs/cloudflare resolves it
  // fresh under the `workerd` export condition — i.e. postgres.js's cf build,
  // which opens connections via cloudflare:sockets. The default Node build
  // (resolved via the `import` condition) cannot open outbound TCP on workerd,
  // which is why the Worker hit CONNECT_TIMEOUT against a pooler CI reaches.
  // Local `next dev` (Node) resolves the same import to the Node build.
  serverExternalPackages: ['postgres'],
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
