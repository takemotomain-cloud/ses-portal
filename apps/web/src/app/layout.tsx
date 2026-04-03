/**
 * Root Layout
 *
 * Next.js App Routerのルートレイアウト。
 * HTML/body要素、メタデータ、グローバルCSSを設定。
 * 認証状態に応じた画面切替はRoute Groupsで行う。
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SES Portal',
  description: 'SES事業 社員情報基幹システム',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
