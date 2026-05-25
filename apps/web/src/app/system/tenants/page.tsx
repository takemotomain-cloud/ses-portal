'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, Plus, Users, ShieldAlert, Loader2, X,
  CheckCircle2, XCircle, Settings, ChevronRight,
  FileText, ToggleLeft, ToggleRight, Trash2,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type Tenant = {
  id: string;
  name: string;
  subdomain: string | null;
  isActive: boolean;
  planType: string;
  maxUsers: number;
  email: string | null;
  tel: string | null;
  createdAt: string;
  _count: { users: number; employees: number; clients: number };
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:       { label: 'フリー',        color: 'bg-slate-700 text-slate-300' },
  standard:   { label: 'スタンダード',  color: 'bg-indigo-900/60 text-indigo-300' },
  enterprise: { label: 'エンタープライズ', color: 'bg-amber-900/60 text-amber-300' },
};

function TenantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key') || '';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', subdomain: '', email: '', tel: '', address: '', zipCode: '',
    registrationNumber: '', planType: 'standard', maxUsers: 50,
    adminLastName: '', adminFirstName: '', adminEmail: '', adminPassword: '',
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const headers = {
    'Content-Type': 'application/json',
    'x-system-admin-key': secretKey,
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/tenants`, { headers });
      if (res.status === 401) { router.push('/system'); return; }
      if (res.ok) setTenants(await res.json());
    } catch {
      console.error('テナント取得失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/system/tenants`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...form, maxUsers: Number(form.maxUsers) }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setForm({ name: '', subdomain: '', email: '', tel: '', address: '', zipCode: '',
          registrationNumber: '', planType: 'standard', maxUsers: 50,
          adminLastName: '', adminFirstName: '', adminEmail: '', adminPassword: '' });
        fetchTenants();
      } else {
        const err = await res.json();
        alert(`エラー: ${err.message || 'テナント作成に失敗しました'}`);
      }
    } catch { alert('通信エラーが発生しました'); }
    finally { setSubmitting(false); }
  };

  const handleToggleActive = async (id: string) => {
    await fetch(`${API_BASE}/system/tenants/${id}/toggle-active`, { method: 'PATCH', headers });
    fetchTenants();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`${API_BASE}/system/tenants/${id}`, { method: 'DELETE', headers });
    if (res.ok || res.status === 204) { setDeleteConfirmId(null); fetchTenants(); }
    else alert('削除に失敗しました');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ヘッダー */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <ShieldAlert size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">System Portal</h1>
              <p className="text-xs text-slate-500">テナント管理</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
          >
            <Plus size={16} />
            新規テナント
          </button>
        </div>
      </header>

      {/* 統計バー */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-8 text-sm">
          <span className="text-slate-400">
            合計 <span className="text-white font-bold">{tenants.length}</span> テナント
          </span>
          <span className="text-slate-400">
            有効 <span className="text-emerald-400 font-bold">{tenants.filter(t => t.isActive).length}</span>
          </span>
          <span className="text-slate-400">
            無効 <span className="text-red-400 font-bold">{tenants.filter(t => !t.isActive).length}</span>
          </span>
        </div>
      </div>

      {/* テナント一覧 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {tenants.length === 0 ? (
          <div className="text-center py-24">
            <Building2 className="mx-auto text-slate-700 mb-4" size={64} />
            <p className="text-slate-500 text-lg font-bold">テナントがまだありません</p>
            <p className="text-slate-600 text-sm mt-2">「新規テナント」ボタンから最初のテナントを作成してください</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {tenants.map((tenant) => {
              const plan = PLAN_LABELS[tenant.planType] || PLAN_LABELS.standard;
              return (
                <div
                  key={tenant.id}
                  className={`bg-slate-900 rounded-2xl border transition-all hover:border-slate-600 ${
                    tenant.isActive ? 'border-slate-700/80' : 'border-slate-800 opacity-60'
                  }`}
                >
                  {/* カードヘッダー */}
                  <div className="p-5 border-b border-slate-800">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="bg-indigo-900/50 p-2.5 rounded-xl border border-indigo-700/30">
                        <Building2 size={20} className="text-indigo-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${plan.color}`}>
                          {plan.label}
                        </span>
                        {tenant.isActive
                          ? <CheckCircle2 size={16} className="text-emerald-400" />
                          : <XCircle size={16} className="text-red-400" />}
                      </div>
                    </div>
                    <h3 className="text-base font-black text-white mb-0.5">{tenant.name}</h3>
                    <p className="text-xs text-slate-500">
                      {tenant.subdomain ? `${tenant.subdomain}.ses-portal.com` : 'サブドメイン未設定'}
                    </p>
                  </div>

                  {/* 統計 */}
                  <div className="px-5 py-4 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-lg font-black text-white">{tenant._count.employees}</p>
                      <p className="text-xs text-slate-500">社員</p>
                    </div>
                    <div className="text-center border-x border-slate-800">
                      <p className="text-lg font-black text-white">{tenant._count.users}</p>
                      <p className="text-xs text-slate-500">ユーザー</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-white">{tenant._count.clients}</p>
                      <p className="text-xs text-slate-500">取引先</p>
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="px-5 pb-5 flex gap-2">
                    <Link
                      href={`/system/tenants/${tenant.id}?key=${secretKey}`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold py-2.5 rounded-xl transition-all"
                    >
                      <Settings size={14} />
                      詳細・編集
                    </Link>
                    <button
                      onClick={() => handleToggleActive(tenant.id)}
                      title={tenant.isActive ? '無効化' : '有効化'}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-400 p-2.5 rounded-xl transition"
                    >
                      {tenant.isActive
                        ? <ToggleRight size={18} className="text-emerald-400" />
                        : <ToggleLeft size={18} className="text-slate-500" />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(tenant.id)}
                      title="削除"
                      className="bg-slate-800 hover:bg-red-900/40 text-slate-500 hover:text-red-400 p-2.5 rounded-xl transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 新規テナント作成モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">新規テナント登録</h2>
                <p className="text-xs text-slate-500 mt-0.5">デフォルト管理者ユーザーも同時に作成されます</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* 企業情報 */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">企業情報</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">テナント名 *</label>
                  <input required type="text" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                    placeholder="株式会社〇〇" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">サブドメイン</label>
                    <input type="text" value={form.subdomain}
                      onChange={e => setForm({ ...form, subdomain: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                      placeholder="company" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">電話番号</label>
                    <input type="tel" value={form.tel}
                      onChange={e => setForm({ ...form, tel: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                      placeholder="03-0000-0000" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">メールアドレス</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                    placeholder="info@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">適格請求書登録番号</label>
                  <input type="text" value={form.registrationNumber}
                    onChange={e => setForm({ ...form, registrationNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                    placeholder="T1234567890123" />
                </div>
              </div>

              {/* プラン */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">プラン設定</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">プランタイプ</label>
                    <select value={form.planType}
                      onChange={e => setForm({ ...form, planType: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 transition text-sm"
                    >
                      <option value="free">フリー</option>
                      <option value="standard">スタンダード</option>
                      <option value="enterprise">エンタープライズ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">最大ユーザー数</label>
                    <input type="number" min={1} value={form.maxUsers}
                      onChange={e => setForm({ ...form, maxUsers: parseInt(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm" />
                  </div>
                </div>
              </div>

              {/* 管理者ユーザー */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">デフォルト管理者</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">姓 *</label>
                    <input required type="text" value={form.adminLastName}
                      onChange={e => setForm({ ...form, adminLastName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                      placeholder="山田" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">名 *</label>
                    <input required type="text" value={form.adminFirstName}
                      onChange={e => setForm({ ...form, adminFirstName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                      placeholder="太郎" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">管理者メール *</label>
                  <input required type="email" value={form.adminEmail}
                    onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                    placeholder="admin@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">初期パスワード</label>
                  <input type="password" value={form.adminPassword}
                    onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                    placeholder="未入力の場合: Admin1234!" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-600 text-slate-400 rounded-xl font-bold hover:bg-slate-800 transition text-sm">
                  キャンセル
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  テナントを作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-6">
              <Trash2 className="mx-auto text-red-400 mb-3" size={40} />
              <h2 className="text-lg font-black text-white mb-2">テナント削除</h2>
              <p className="text-slate-400 text-sm">
                このテナントと<span className="text-red-400 font-bold">全ての関連データ</span>が削除されます。この操作は取り消せません。
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-3 border border-slate-600 text-slate-400 rounded-xl font-bold hover:bg-slate-800 transition text-sm">
                キャンセル
              </button>
              <button onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition text-sm">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TenantsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin text-indigo-400" size={40} />
      </div>
    }>
      <TenantsContent />
    </Suspense>
  );
}
