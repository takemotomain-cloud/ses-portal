/**
 * 一般経費申請ページ（事前申請フロー対応）
 *
 * - admin: 直接経費申請OK
 * - manager/member: 事前申請 → 承認後 → 経費申請（ペア必須）
 * - employee (SES): このページにアクセス不可
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, getToken } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';

interface PreApproval {
  id: string;
  expectedDate: string;
  description: string;
  estimatedAmount: number;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  generalExpenses: { id: string }[];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: '承認待ち', cls: 'badge-warn' },
  approved: { label: '承認済', cls: 'badge-ok' },
  rejected: { label: '却下', cls: 'badge-danger' },
};

export default function GeneralExpensePage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const { user } = useAuth();
  const role = user?.role || 'employee';
  const isAdmin = role === 'admin';

  // タブ: admin以外は事前申請タブがデフォルト
  const [tab, setTab] = useState<'pre-approval' | 'expense'>(isAdmin ? 'expense' : 'pre-approval');

  // 事前申請一覧
  const [preApprovals, setPreApprovals] = useState<PreApproval[]>([]);
  const [paLoading, setPaLoading] = useState(true);

  // 承認済み未使用の事前申請（経費申請用）
  const [unusedPAs, setUnusedPAs] = useState<PreApproval[]>([]);

  const fetchPreApprovals = useCallback(async () => {
    setPaLoading(true);
    try {
      const data = await apiClient<PreApproval[]>('/general-expense/pre-approval/my');
      setPreApprovals(data);
    } catch { setPreApprovals([]); }
    finally { setPaLoading(false); }
  }, []);

  const fetchUnusedPAs = useCallback(async () => {
    try {
      const data = await apiClient<PreApproval[]>('/general-expense/pre-approval/unused');
      setUnusedPAs(data);
    } catch { setUnusedPAs([]); }
  }, []);

  useEffect(() => {
    if (!isAdmin) { fetchPreApprovals(); fetchUnusedPAs(); }
  }, [isAdmin, fetchPreApprovals, fetchUnusedPAs]);

  // ===== 事前申請フォーム =====
  const [paExpectedDate, setPaExpectedDate] = useState('');
  const [paDescription, setPaDescription] = useState('');
  const [paAmount, setPaAmount] = useState('');
  const [paSubmitting, setPaSubmitting] = useState(false);

  const paValid = paExpectedDate && paDescription.trim() && parseInt(paAmount, 10) > 0;

  async function handlePaSubmit() {
    setPaSubmitting(true);
    try {
      await apiClient('/general-expense/pre-approval', {
        method: 'POST',
        body: JSON.stringify({
          expectedDate: paExpectedDate,
          description: paDescription.trim(),
          estimatedAmount: parseInt(paAmount, 10),
        }),
      });
      toast('事前申請を提出しました');
      setPaExpectedDate(''); setPaDescription(''); setPaAmount('');
      fetchPreApprovals();
    } catch (err: any) {
      toast(err?.message || '申請に失敗しました');
    } finally { setPaSubmitting(false); }
  }

  // ===== 経費申請フォーム =====
  const [expDate, setExpDate] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expFile, setExpFile] = useState<File | null>(null);
  const [expPreview, setExpPreview] = useState<string | null>(null);
  const [expPaId, setExpPaId] = useState('');
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => { setExpFile(file); setExpPreview(reader.result as string); };
      reader.readAsDataURL(file);
    } else {
      setExpFile(file); setExpPreview(null);
    }
  }

  const expValid = useMemo(() => {
    const hasBase = expDate && expDesc.trim() && parseInt(expAmount, 10) > 0 && expFile;
    if (isAdmin) return hasBase;
    return hasBase && expPaId;
  }, [expDate, expDesc, expAmount, expFile, expPaId, isAdmin]);

  function handleExpConfirm() {
    if (!expDate) { toast('利用日を入力してください'); return; }
    if (!expDesc.trim()) { toast('内容を入力してください'); return; }
    if (parseInt(expAmount, 10) <= 0) { toast('金額を入力してください'); return; }
    if (!expFile) { toast('領収書を添付してください'); return; }
    if (!isAdmin && !expPaId) { toast('事前申請を選択してください'); return; }
    setShowConfirm(true);
  }

  async function handleExpSubmit() {
    setExpSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('expenseDate', expDate);
      formData.append('description', expDesc.trim());
      formData.append('amount', String(parseInt(expAmount, 10)));
      if (!isAdmin && expPaId) formData.append('preApprovalId', expPaId);
      if (expFile) formData.append('receipt', expFile);

      const token = getToken();
      const res = await fetch('/api/general-expense/submit', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || '申請に失敗しました');
      }
      setShowConfirm(false);
      toast('経費を申請しました');
      router.push('/applications');
    } catch (err: any) {
      toast(err?.message || '申請に失敗しました');
    } finally { setExpSubmitting(false); }
  }

  const selectedPA = unusedPAs.find(p => p.id === expPaId);

  // SES事業部はアクセス不可
  if (role === 'employee') {
    return (
      <div className="card p-10 text-center text-secondary">
        経費申請の権限がありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* タブ（admin以外のみ） */}
      {!isAdmin && (
        <div className="flex gap-1 border-b border-border">
          {[
            { key: 'pre-approval' as const, label: '事前申請' },
            { key: 'expense' as const, label: '経費申請' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ===== 事前申請タブ ===== */}
      {tab === 'pre-approval' && !isAdmin && (
        <>
          {/* 事前申請フォーム */}
          <div className="card p-5 space-y-4">
            <h3 className="text-md font-bold">新規事前申請</h3>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">発生予定日（未来日）</label>
              <input type="date" value={paExpectedDate} onChange={e => setPaExpectedDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">内容</label>
              <textarea value={paDescription} onChange={e => setPaDescription(e.target.value)}
                placeholder="例: クライアント接待費" rows={2}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">見積金額</label>
              <input type="number" value={paAmount} onChange={e => setPaAmount(e.target.value)} placeholder="5000"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
            </div>
            <button onClick={handlePaSubmit} disabled={!paValid || paSubmitting}
              className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 disabled:opacity-35">
              {paSubmitting ? '送信中...' : '事前申請を提出'}
            </button>
          </div>

          {/* 事前申請履歴 */}
          <div>
            <h3 className="text-md font-bold mb-3">事前申請履歴</h3>
            {paLoading ? (
              <div className="card p-8 text-center text-secondary">読み込み中...</div>
            ) : preApprovals.length === 0 ? (
              <div className="card p-8 text-center text-secondary">事前申請はありません</div>
            ) : (
              <div className="space-y-2">
                {preApprovals.map(pa => {
                  const st = statusConfig[pa.status] || statusConfig.pending;
                  const used = pa.generalExpenses.length > 0;
                  return (
                    <div key={pa.id} className="card p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                        <span className="text-sm font-medium tabular-nums">{pa.estimatedAmount.toLocaleString()}円</span>
                      </div>
                      <div className="text-sm">{pa.description}</div>
                      <div className="text-xs text-secondary">予定日: {formatDate(pa.expectedDate)}</div>
                      {pa.status === 'approved' && (
                        <div className="text-xs">
                          {used ? (
                            <span className="text-secondary">経費申請済み</span>
                          ) : (
                            <span className="text-green-600 font-medium">経費申請可能</span>
                          )}
                        </div>
                      )}
                      {pa.rejectReason && (
                        <div className="text-xs text-red-600">却下理由: {pa.rejectReason}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 経費申請タブ ===== */}
      {(tab === 'expense' || isAdmin) && (
        <>
          <div className="card p-5 space-y-4">
            {/* 事前申請選択（admin以外） */}
            {!isAdmin && (
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">
                  事前申請を選択 <span className="text-red-500">*</span>
                </label>
                {unusedPAs.length === 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    承認済みの事前申請がありません。先に事前申請を提出してください。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unusedPAs.map(pa => (
                      <button
                        key={pa.id}
                        onClick={() => setExpPaId(pa.id === expPaId ? '' : pa.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          expPaId === pa.id
                            ? 'border-primary bg-blue-50'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="text-sm font-medium">{pa.description}</div>
                        <div className="text-xs text-secondary mt-0.5">
                          予定日: {formatDate(pa.expectedDate)} / 見積: {pa.estimatedAmount.toLocaleString()}円
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">利用日（過去3ヶ月以内）</label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">内容</label>
              <textarea value={expDesc} onChange={e => setExpDesc(e.target.value)}
                placeholder="例: クライアントとの打ち合わせ昼食代" rows={2}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">金額</label>
              <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="3000"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">領収書 <span className="text-red-500">*</span></label>
              <input type="file" accept="image/*,.pdf" onChange={handleFileChange}
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:bg-card file:text-primary file:font-medium file:cursor-pointer hover:file:bg-page" />
              {expPreview && <img src={expPreview} alt="プレビュー" className="mt-2 h-20 rounded border border-border object-contain" />}
              {expFile && !expPreview && <p className="mt-1 text-xs text-secondary">📄 {expFile.name}</p>}
            </div>
          </div>

          <button onClick={handleExpConfirm} disabled={!expValid}
            className="w-full py-3.5 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-35 disabled:cursor-default">
            申請内容を確認
          </button>

          {/* 確認モーダル */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/35 z-[200] flex items-center justify-center p-4"
              onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
              <div className="bg-card rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-y-auto">
                <div className="px-5 pt-5 pb-3 text-lg font-bold sticky top-0 bg-card z-10">経費申請の確認</div>
                <div className="px-5 pb-4 space-y-3">
                  {selectedPA && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <div className="text-xs text-blue-600 font-medium mb-1">事前申請</div>
                      <div>{selectedPA.description}</div>
                      <div className="text-xs text-secondary mt-0.5">見積: {selectedPA.estimatedAmount.toLocaleString()}円</div>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">利用日</span>
                    <span className="font-medium">{formatDate(expDate)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-secondary">内容</span>
                    <p className="mt-1">{expDesc}</p>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                    <span>金額</span>
                    <span className="tabular-nums">{(parseInt(expAmount, 10) || 0).toLocaleString()}円</span>
                  </div>
                  {expPreview ? (
                    <img src={expPreview} alt="領収書" className="h-24 rounded border border-border object-contain" />
                  ) : expFile ? (
                    <p className="text-xs text-secondary">📄 {expFile.name}</p>
                  ) : null}
                </div>
                <div className="flex border-t border-border-light sticky bottom-0 bg-card">
                  <button onClick={() => setShowConfirm(false)}
                    className="flex-1 py-3.5 text-md text-secondary hover:bg-page transition-colors">戻る</button>
                  <button onClick={handleExpSubmit} disabled={expSubmitting}
                    className="flex-1 py-3.5 text-md font-semibold text-primary border-l border-border-light hover:bg-page transition-colors disabled:opacity-50">
                    {expSubmitting ? '送信中...' : '申請する'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ToastUI />
    </div>
  );
}
