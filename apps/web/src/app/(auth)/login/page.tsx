'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, ShieldCheck, Globe } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdomain.trim()) {
      setError('企業コードを入力してください');
      return;
    }
    // テナント専用ログイン画面へリダイレクト
    router.push(`/t/${subdomain.trim().toLowerCase()}/login`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 relative overflow-hidden">
      {/* 背景の装飾的要素 */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-status-blue-bg/30 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-[420px] w-full z-10">
        {/* ロゴエリア */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-primary rounded-2xl shadow-xl mb-6">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-primary tracking-tight mb-2">
            SES Portal
          </h1>
          <p className="text-md text-secondary font-medium">
            企業ログイン
          </p>
        </div>

        {/* メインカード */}
        <div className="bg-card border border-border rounded-[24px] p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm bg-card/95">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-primary mb-2">企業コードの入力</h2>
            <p className="text-sm text-secondary">
              会社から提供された企業コードを入力してログイン画面へ進んでください。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2 ml-1">
                <label htmlFor="subdomain" className="text-xs font-black text-secondary uppercase tracking-widest">
                  Company Code
                </label>
                <Globe size={14} className="text-secondary/40" />
              </div>
              <div className="relative group">
                <input
                  id="subdomain"
                  type="text"
                  required
                  autoFocus
                  placeholder="例: test"
                  value={subdomain}
                  onChange={(e) => {
                    setSubdomain(e.target.value);
                    setError('');
                  }}
                  className="w-full px-5 py-4 bg-page border border-border rounded-xl outline-none 
                           transition-all duration-300
                           focus:border-primary focus:ring-4 focus:ring-primary/5
                           text-md font-bold text-primary placeholder:text-secondary/30"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/30 group-focus-within:text-primary transition-colors">
                  .sauros.co.jp
                </div>
              </div>
              {error && (
                <p className="mt-2 ml-1 text-xs font-bold text-status-red-text bg-status-red-bg px-3 py-2 rounded-lg border border-status-red-bg">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="group w-full bg-primary text-white py-4 rounded-xl font-black text-lg shadow-lg 
                       shadow-primary/10 transition-all duration-300
                       hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0
                       flex items-center justify-center gap-2"
            >
              次へ進む
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* ヘルプセクション */}
          <div className="mt-10 pt-8 border-t border-border-light text-center">
            <p className="text-xs text-secondary mb-4 font-medium">
              コードが不明な場合は、各社のシステム管理者にお問い合わせください。
            </p>
            <button
              onClick={() => router.push('/system')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-primary transition-colors py-1 px-3 rounded-full hover:bg-page"
            >
              <ShieldCheck size={14} />
              システム管理はこちら
            </button>
          </div>
        </div>

        {/* フッター */}
        <p className="text-center mt-10 text-secondary/40 text-[10px] font-bold uppercase tracking-[0.2em]">
          &copy; 2026 SES Portal System
        </p>
      </div>
    </div>
  );
}
