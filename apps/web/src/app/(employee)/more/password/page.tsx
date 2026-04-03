/**
 * パスワード変更ページ
 *
 * UIモックのpage-passwordを再現。
 * 現在のパスワード + 新しいパスワード + 強度チェックバー。
 *
 * セキュリティ:
 * - 現在のパスワード確認必須（API側でbcrypt検証）
 * - 強度チェックはクライアント補助のみ（本バリデーションはAPI側）
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function PasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // パスワード強度チェック（クライアント側の補助表示）
  const strength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '' };

    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;

    const levels = [
      { label: '弱い', color: 'bg-status-red-text', width: '20%' },
      { label: '弱い', color: 'bg-status-red-text', width: '40%' },
      { label: '普通', color: 'bg-status-amber-text', width: '60%' },
      { label: '強い', color: 'bg-status-green-text', width: '80%' },
      { label: 'とても強い', color: 'bg-status-green-text', width: '100%' },
    ];

    const level = levels[Math.min(score, 4)];
    return { score, ...level };
  }, [newPassword]);

  function handleSubmit() {
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('すべての項目を入力してください');
      return;
    }

    if (newPassword.length < 8) {
      setError('新しいパスワードは8文字以上で入力してください');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }

    setShowConfirm(true);
  }

  async function confirmSubmit() {
    setIsSubmitting(true);
    try {
      // Phase 1: デモ。API連携後にPOST /api/profile/passwordを呼ぶ
      await new Promise(r => setTimeout(r, 800));
      setShowConfirm(false);
      router.push('/more');
    } catch (err) {
      setError('パスワードの変更に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-status-red-bg text-status-red-text text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">現在のパスワード</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">新しいパスワード</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
            autoComplete="new-password"
          />

          {/* 強度インジケーター */}
          {newPassword && (
            <div className="mt-2">
              <div className="h-1 bg-border-light rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: strength.width }}
                />
              </div>
              <div className="text-2xs mt-1" style={{ color: strength.color === 'bg-status-green-text' ? '#1B7D40' : strength.color === 'bg-status-amber-text' ? '#8B5E00' : '#A32D2D' }}>
                {strength.label}
              </div>
            </div>
          )}

          <div className="text-2xs text-secondary mt-1.5">
            8文字以上、大文字・数字・記号を含めると強度が上がります
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">新しいパスワード（確認）</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
            autoComplete="new-password"
          />
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-lg bg-primary text-white text-md font-semibold transition-all
                     hover:opacity-90 active:scale-[0.98]"
        >
          パスワードを変更
        </button>
      </div>

      {/* 確認モーダル */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/35 z-[200] flex items-center justify-center p-6" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="bg-card rounded-2xl w-full max-w-[400px] overflow-hidden">
            <div className="px-5 pt-5 pb-3 text-lg font-bold">パスワード変更の確認</div>
            <div className="px-5 pb-5">
              <div className="flex justify-between text-md">
                <span className="text-secondary">変更内容</span>
                <span className="font-medium">パスワードを変更します</span>
              </div>
            </div>
            <div className="flex border-t border-border-light">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3.5 text-md text-secondary hover:bg-page transition-colors">いいえ</button>
              <button onClick={confirmSubmit} disabled={isSubmitting} className="flex-1 py-3.5 text-md font-semibold text-primary border-l border-border-light hover:bg-page transition-colors disabled:opacity-50">
                {isSubmitting ? '変更中...' : 'はい'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
