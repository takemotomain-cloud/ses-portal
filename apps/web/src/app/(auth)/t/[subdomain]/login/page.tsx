'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import type { ApiError } from '@ses-portal/shared';

export default function TenantLoginPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = params.subdomain as string;
  const { login } = useAuth();

  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantError, setTenantError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 初回マウント時にテナント情報を取得
  useEffect(() => {
    if (!subdomain) return;
    
    apiClient<{ name: string }>(`/auth/tenant/${subdomain}`)
      .then((data) => {
        setTenantName(data.name);
      })
      .catch(() => {
        setTenantError('無効なテナントURLです');
      });
  }, [subdomain]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await login(email, password, subdomain);

      // ロール別に初期画面へ遷移
      if (user.role === 'admin' || user.role === 'manager' || user.role === 'member') {
        router.push('/admin/dashboard');
      } else {
        router.push('/mypage');
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'ログインに失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  // テナント取得中のローディング表示
  if (!tenantName && !tenantError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="text-secondary">読み込み中...</div>
      </div>
    );
  }

  // 無効なテナントの場合のエラー表示
  if (tenantError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-[420px] w-full text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="text-status-red-text mb-4">{tenantError}</div>
          <button
            onClick={() => router.push('/login')}
            className="text-primary hover:underline text-sm"
          >
            共通ログイン画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="bg-card border border-border rounded-2xl p-10 sm:p-12 max-w-[420px] w-full shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        {/* テナント名 / ロゴテキスト */}
        <div className="text-center mb-9">
          <h1 className="text-xl font-bold text-primary mb-3 tracking-wide">
            {tenantName}
          </h1>
          <h2 className="text-[15px] font-bold text-primary mb-1">
            SES Portal
          </h2>
          <p className="text-[13px] text-secondary">
            ログインしてください
          </p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-status-red-bg text-status-red-text text-sm">
            {error}
          </div>
        )}

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-[13px] font-semibold text-secondary mb-1.5"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-primary
                         bg-card outline-none transition-colors
                         focus:border-primary
                         placeholder:text-secondary/40"
              placeholder="example@company.co.jp"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[13px] font-semibold text-secondary mb-1.5"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-primary
                         bg-card outline-none transition-colors
                         focus:border-primary
                         placeholder:text-secondary/40"
              placeholder="パスワードを入力"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-lg bg-[#1a1a1a] text-white text-sm font-medium
                       cursor-pointer transition-all mt-2
                       hover:bg-[#2a2a2a] active:scale-[0.98]
                       disabled:opacity-35 disabled:cursor-default disabled:transform-none"
          >
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
