const path = require('path');

/** @type {import('next').NextConfig} */

/**
 * Next.js 設定
 *
 * セキュリティ: CSP, X-Frame-Options等のセキュリティヘッダーを設定。
 * パフォーマンス: 画像最適化、API proxyでCORS不要化。
 * 注意: rewrites()でAPIリクエストをNestJSに転送。フロントとAPIが同一ドメインに見える。
 */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  // APIリクエストをNestJSにプロキシ（CORSの複雑さを回避）
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
