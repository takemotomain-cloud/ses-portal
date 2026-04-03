/**
 * ログイン画面
 *
 * メールアドレス + パスワードでログインする。
 * デザインルール準拠（カラー・フォント・letter-spacing）。
 * UIモックのログイン画面デザインを再現。
 *
 * セキュリティ:
 * - パスワードフィールドはtype="password"
 * - エラーメッセージは具体的な失敗理由を明かさない
 * - フォームsubmitでページ遷移しない（SPAのまま）
 */

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { ApiError } from '@ses-portal/shared';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);

      // ログイン成功 → ロール別リダイレクト
      // AuthContextのuserが更新されるので、
      // middleware or layout側でリダイレクト判定する。
      // Phase 1初期はマイページに遷移。
      router.push('/mypage');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'ログインに失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="bg-card border border-border rounded-2xl p-10 sm:p-12 max-w-[420px] w-full shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        {/* ロゴ */}
        <div className="text-center mb-9">
          <svg
            className="h-8 w-auto mx-auto mb-4"
            viewBox="0 0 1050 400"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#2f2f2f"
              d="M951.79,306.82l-2.1-23.01c-17.52,31.29-60.89,32.53-88.67,17.23-10.45-5.75-18.68-14.17-25.03-24.09-9.94-15.51-13.25-32.91-12.98-51.26.7-47.36,33.06-83.05,81.2-80.29,19.44,1.11,36.24,8.99,45.67,26.37l1.78-23.03h30.15s-.02,157.93-.02,157.93l-29.99.16ZM905.82,283.83c16.43-.81,30.36-9.55,37.73-23.85,10.4-20.17,10.27-44.4-.11-64.47-8.38-16.22-24.32-24.39-42.25-23.73s-33.64,10.82-40.85,28.05c-7.58,18.11-7.63,39.1.4,57.13,7.98,17.92,25.06,27.85,45.07,26.87Z"
            />
            <path
              fill="#2f2f2f"
              d="M300.54,285.04c21.34,2.82,42.04-4.83,51.29-25.34l31.49.05c-4.48,13.09-11.45,24.57-21.9,33.42-21.43,18.16-53.98,21.24-80.45,13.41-49.72-14.7-64.87-70.58-46.86-114.69,7.59-18.6,21.83-32.25,40.05-40.08,13.41-5.77,27.15-7.08,41.79-6.26,11.46.64,21.86,3.9,31.98,9.26,29.98,15.89,41.63,50.35,38.31,82.6l-127.43-.02c1.17,25.3,17.37,44.42,41.74,47.64ZM354.02,214.37c-.91-10.03-4.03-18.45-8.83-26.11-12.35-19.19-40.64-22.81-59.31-13.67-15.32,7.5-24.92,22.95-26.23,39.94l94.37-.16Z"
            />
            <polygon
              fill="#2f2f2f"
              points="604.07 306.75 542.32 148.72 576.21 148.77 623.3 275.47 686.02 111.05 756.6 89.38 756.48 117.11 711.08 131.17 642.38 306.71 604.07 306.75"
            />
            <polygon
              fill="#2f2f2f"
              points="208.15 277.7 208.25 306.75 68.21 306.72 68.22 93.71 100.22 93.72 100.2 277.75 208.15 277.7"
            />
            <path
              fill="#2f2f2f"
              d="M456.5,220.2l-.29,86.59-31.75-.13.05-157.86,29.86-.14,1.3,25.32c11.25-25.08,35.87-32.08,61.49-27.06l.09,29.24c-20.26-3.7-42.54-3.17-53.4,17.25-4.13,7.76-7.31,16.95-7.34,26.79Z"
            />
            <polygon
              fill="#2f2f2f"
              points="784.98 306.56 753.89 306.81 753.87 148.73 784.96 148.72 784.98 306.56"
            />
          </svg>
          <h1 className="text-2xl font-semibold text-primary mb-1">
            SES Portal
          </h1>
          <p className="text-sm text-secondary">
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
              className="block text-sm font-semibold text-secondary mb-1.5"
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
              className="w-full px-3 py-2.5 border border-border rounded-lg text-md text-primary
                         bg-card outline-none transition-colors
                         focus:border-primary
                         placeholder:text-secondary/40"
              placeholder="example@company.co.jp"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-secondary mb-1.5"
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
              className="w-full px-3 py-2.5 border border-border rounded-lg text-md text-primary
                         bg-card outline-none transition-colors
                         focus:border-primary
                         placeholder:text-secondary/40"
              placeholder="パスワードを入力"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-lg bg-primary text-white text-md font-semibold
                       cursor-pointer transition-all
                       hover:opacity-90 active:scale-[0.98]
                       disabled:opacity-35 disabled:cursor-default disabled:transform-none"
          >
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
