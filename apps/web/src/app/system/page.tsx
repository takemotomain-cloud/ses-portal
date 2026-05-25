'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const VALID_KEY = process.env.NEXT_PUBLIC_SYSTEM_ADMIN_SECRET || 'ses-system-2026';

function SystemLoginContent() {
  const [secretKey, setSecretKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const keyParam = searchParams.get('key');

  useEffect(() => {
    if (keyParam) {
      if (keyParam === VALID_KEY) {
        // キーが正しければそのままテナント一覧へ
        router.replace(`/system/tenants?key=${keyParam}`);
      } else {
        setIsAuthorized(false);
      }
    } else {
      setIsAuthorized(null);
    }
  }, [keyParam, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretKey === VALID_KEY) {
      router.push(`/system/tenants?key=${secretKey}`);
    } else {
      setError('シークレットキーが正しくありません');
    }
  };

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
          <ShieldAlert className="mx-auto text-red-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-white mb-2">アクセス拒否</h1>
          <p className="text-slate-400 text-sm mb-6">
            正しいシークレットキーが必要です。
          </p>
          <button
            onClick={() => router.push('/system')}
            className="text-indigo-400 font-bold hover:underline text-sm"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-900/50 mb-6 border-b-4 border-indigo-800">
            <ShieldAlert className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            System Portal
          </h1>
          <p className="text-slate-400 font-medium mt-2 text-sm">
            SES Portal テナント管理システム
          </p>
        </div>

        {/* ログインカード */}
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-700/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                シークレットキー
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type={showKey ? 'text' : 'password'}
                  required
                  value={secretKey}
                  onChange={(e) => {
                    setSecretKey(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-800 border border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-white font-mono placeholder:text-slate-600"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/30 text-red-400 rounded-xl text-sm font-bold border border-red-500/30">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-900/50 hover:bg-indigo-500 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              管理システムにアクセス
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-slate-600 text-xs font-bold uppercase tracking-widest">
          ACCESS RESTRICTED TO SYSTEM ADMINISTRATORS
        </p>
      </div>
    </div>
  );
}

export default function SystemPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-400" size={32} />
        </div>
      }
    >
      <SystemLoginContent />
    </Suspense>
  );
}
