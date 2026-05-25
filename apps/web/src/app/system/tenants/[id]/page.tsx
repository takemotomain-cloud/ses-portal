'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Save, Loader2, ShieldAlert,
  Users, User, Mail, Phone, MapPin, CreditCard,
  CheckCircle2, XCircle, Lock, Unlock, Trash2,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type TenantDetail = {
  id: string;
  name: string;
  subdomain: string | null;
  isActive: boolean;
  zipCode: string | null;
  address: string | null;
  tel: string | null;
  email: string | null;
  registrationNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  planType: string;
  maxUsers: number;
  createdAt: string;
  _count: { users: number; employees: number; clients: number; assignments: number };
  users: Array<{
    id: string;
    role: string;
    isLocked: boolean;
    lastLoginAt: string | null;
    employee: { id: string; lastName: string; firstName: string; email: string; status: string };
  }>;
};

function TenantDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const secretKey = searchParams.get('key') || '';

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<TenantDetail>>({});

  const headers = {
    'Content-Type': 'application/json',
    'x-system-admin-key': secretKey,
  };

  useEffect(() => {
    fetchTenant();
  }, [id]);

  const fetchTenant = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/tenants/${id}`, { headers });
      if (res.status === 401) { router.push('/system'); return; }
      if (res.ok) {
        const data = await res.json();
        setTenant(data);
        setForm({
          name: data.name, subdomain: data.subdomain || '',
          zipCode: data.zipCode || '', address: data.address || '',
          tel: data.tel || '', email: data.email || '',
          registrationNumber: data.registrationNumber || '',
          bankName: data.bankName || '', bankBranch: data.bankBranch || '',
          bankAccountType: data.bankAccountType || '',
          bankAccountNumber: data.bankAccountNumber || '',
          bankAccountName: data.bankAccountName || '',
          planType: data.planType, maxUsers: data.maxUsers,
        });
      }
    } catch { console.error('テナント詳細取得失敗'); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/system/tenants/${id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        fetchTenant();
      } else {
        const err = await res.json();
        alert(`エラー: ${err.message}`);
      }
    } catch { alert('保存に失敗しました'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async () => {
    await fetch(`${API_BASE}/system/tenants/${id}/toggle-active`, { method: 'PATCH', headers });
    fetchTenant();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={40} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        テナントが見つかりません
      </div>
    );
  }

  const inputCls = 'w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm placeholder:text-slate-600';
  const labelCls = 'block text-sm font-bold text-slate-300 mb-1.5';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ヘッダー */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/system/tenants?key=${secretKey}`}
              className="text-slate-400 hover:text-white transition flex items-center gap-1.5 text-sm font-bold"
            >
              <ArrowLeft size={16} />
              テナント一覧
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-indigo-400" />
              <span className="font-black text-white">{tenant.name}</span>
              {tenant.isActive
                ? <CheckCircle2 size={16} className="text-emerald-400" />
                : <XCircle size={16} className="text-red-400" />}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleActive}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition ${
                tenant.isActive
                  ? 'bg-slate-800 text-slate-400 hover:bg-red-900/30 hover:text-red-400'
                  : 'bg-slate-800 text-slate-400 hover:bg-emerald-900/30 hover:text-emerald-400'
              }`}
            >
              {tenant.isActive ? <><Lock size={14} />無効化</> : <><Unlock size={14} />有効化</>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* 統計 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: '社員数', value: tenant._count.employees, icon: Users },
            { label: 'ユーザー数', value: tenant._count.users, icon: User },
            { label: '取引先数', value: tenant._count.clients, icon: Building2 },
            { label: 'アサイン数', value: tenant._count.assignments, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 text-center">
              <Icon size={20} className="mx-auto text-indigo-400 mb-2" />
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* 企業基本情報 */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Building2 size={16} className="text-indigo-400" />
              <h2 className="font-black text-white text-sm uppercase tracking-widest">企業基本情報</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>テナント名 *</label>
                <input required type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>サブドメイン</label>
                <input type="text" value={form.subdomain || ''} onChange={e => setForm({ ...form, subdomain: e.target.value })} className={inputCls} placeholder="company" />
              </div>
              <div>
                <label className={labelCls}>電話番号</label>
                <input type="tel" value={form.tel || ''} onChange={e => setForm({ ...form, tel: e.target.value })} className={inputCls} placeholder="03-0000-0000" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>メールアドレス</label>
                <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>郵便番号</label>
                <input type="text" value={form.zipCode || ''} onChange={e => setForm({ ...form, zipCode: e.target.value })} className={inputCls} placeholder="000-0000" />
              </div>
              <div>
                <label className={labelCls}>適格請求書登録番号</label>
                <input type="text" value={form.registrationNumber || ''} onChange={e => setForm({ ...form, registrationNumber: e.target.value })} className={inputCls} placeholder="T1234567890123" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>住所</label>
                <input type="text" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>

          {/* 銀行口座情報 */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <CreditCard size={16} className="text-indigo-400" />
              <h2 className="font-black text-white text-sm uppercase tracking-widest">銀行口座情報</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>銀行名</label>
                <input type="text" value={form.bankName || ''} onChange={e => setForm({ ...form, bankName: e.target.value })} className={inputCls} placeholder="〇〇銀行" />
              </div>
              <div>
                <label className={labelCls}>支店名</label>
                <input type="text" value={form.bankBranch || ''} onChange={e => setForm({ ...form, bankBranch: e.target.value })} className={inputCls} placeholder="〇〇支店" />
              </div>
              <div>
                <label className={labelCls}>口座種別</label>
                <select value={form.bankAccountType || ''} onChange={e => setForm({ ...form, bankAccountType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 transition text-sm">
                  <option value="">選択してください</option>
                  <option value="普通">普通</option>
                  <option value="当座">当座</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>口座番号</label>
                <input type="text" value={form.bankAccountNumber || ''} onChange={e => setForm({ ...form, bankAccountNumber: e.target.value })} className={inputCls} placeholder="0000000" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>口座名義</label>
                <input type="text" value={form.bankAccountName || ''} onChange={e => setForm({ ...form, bankAccountName: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>

          {/* プラン設定 */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <ShieldAlert size={16} className="text-indigo-400" />
              <h2 className="font-black text-white text-sm uppercase tracking-widest">プラン設定</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>プランタイプ</label>
                <select value={form.planType || 'standard'} onChange={e => setForm({ ...form, planType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:border-indigo-500 transition text-sm">
                  <option value="free">フリー</option>
                  <option value="standard">スタンダード</option>
                  <option value="enterprise">エンタープライズ</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>最大ユーザー数</label>
                <input type="number" min={1} value={form.maxUsers || 50} onChange={e => setForm({ ...form, maxUsers: parseInt(e.target.value) })} className={inputCls} />
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end gap-3">
            {saved && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-bold">
                <CheckCircle2 size={16} />保存しました
              </div>
            )}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black transition-all hover:-translate-y-0.5 disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              変更を保存
            </button>
          </div>
        </form>

        {/* ユーザー一覧 */}
        <div className="mt-6 bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users size={16} className="text-indigo-400" />
            <h2 className="font-black text-white text-sm uppercase tracking-widest">ユーザー一覧</h2>
          </div>
          <div className="space-y-3">
            {tenant.users.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">ユーザーがいません</p>
            ) : (
              tenant.users.map(user => (
                <div key={user.id} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-xs font-black text-white">
                      {user.employee.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {user.employee.lastName} {user.employee.firstName}
                      </p>
                      <p className="text-xs text-slate-500">{user.employee.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      user.role === 'admin' ? 'bg-indigo-900/60 text-indigo-300' :
                      user.role === 'manager' ? 'bg-amber-900/60 text-amber-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {user.role === 'admin' ? '管理者' : user.role === 'manager' ? 'マネージャー' : '一般'}
                    </span>
                    {user.isLocked && (
                      <span className="text-xs font-bold px-2 py-1 rounded-lg bg-red-900/40 text-red-400">
                        ロック中
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TenantDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={40} />
      </div>
    }>
      <TenantDetailContent />
    </Suspense>
  );
}
