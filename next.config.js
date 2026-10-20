/** @type {import('next').NextConfig} */

function getOrigin(urlString, fallback = '') {
  try {
    return new URL(urlString).origin;
  } catch {
    return fallback;
  }
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL
  ? getOrigin(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:3000')
  : 'http://localhost:3000';

const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL
  ? getOrigin(process.env.NEXT_PUBLIC_STELLAR_RPC_URL, 'https://soroban-testnet.stellar.org')
  : 'https://soroban-testnet.stellar.org';

const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL
  ? getOrigin(process.env.NEXT_PUBLIC_HORIZON_URL, 'https://horizon-testnet.stellar.org')
  : 'https://horizon-testnet.stellar.org';

const ipfsGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY
  ? getOrigin(process.env.NEXT_PUBLIC_IPFS_GATEWAY, 'https://ipfs.io')
  : 'https://ipfs.io';

const connectSources = Array.from(
  new Set(["'self'", apiUrl, rpcUrl, horizonUrl, ipfsGateway].filter(Boolean)),
).join(' ');

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: ${ipfsGateway}`,
  `connect-src ${connectSources}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
]
  .join('; ')
  .trim();

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
