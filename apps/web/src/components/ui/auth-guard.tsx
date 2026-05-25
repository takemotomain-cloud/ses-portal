/**
 * 認証ガードコンポーネント
 *
 * クライアントサイドでログイン状態をチェックし、
 * 未ログインならログイン画面にリダイレクトする。
 *
 * 使い方:
 *   <AuthGuard>
 *     <ProtectedContent />
 *   </AuthGuard>
 *
 *   <AuthGuard requiredRoles={['admin', 'manager', 'member']}>
 *     <AdminOnlyContent />
 *   </AuthGuard>
 *
 * なぜコンポーネント: レイアウトに組み込むことで、
 * 各ページに個別にチェックを書く必要がない。
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface AuthGuardProps {
  children: React.ReactNode;
  /** 必要なロール。省略時は全ロール許可（ログインのみ必須） */
  requiredRoles?: string[];
}

export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // 未ログイン → ログイン画面へ
    if (!user) {
      const pathname = window.location.pathname;
      const tenantMatch = pathname.match(/^\/t\/([^\/]+)/);
      if (tenantMatch) {
        router.push(`/t/${tenantMatch[1]}/login`);
      } else {
        router.push('/login');
      }
      return;
    }

    // ロール不足 → マイページへ（権限エラー）
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      router.push('/mypage');
    }
  }, [user, isLoading, requiredRoles, router]);

  // ローディング中
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-secondary text-sm">読み込み中...</div>
      </div>
    );
  }

  // 未ログインまたはロール不足
  if (!user) return null;
  if (requiredRoles && !requiredRoles.includes(user.role)) return null;

  return <>{children}</>;
}
