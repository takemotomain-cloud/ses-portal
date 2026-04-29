/**
 * 交通費申請フォーム（都度 + 定期 対応版・領収書添付必須）
 *
 * フォームに直接入力 → 「申請内容を確認」で確認モーダル（領収書プレビュー付き）→ 送信。
 */

'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

type ExpenseKind = 'onetime' | 'monthly_pass' | 'three_month_pass';

interface FormRow {
  id: string;
  kind: ExpenseKind;
  date: string;
  from: string;
  to: string;
  amount: string;
  receiptFile: File | null;
  receiptPreview: string | null;
}

const kindLabel: Record<ExpenseKind, string> = {
  onetime: '都度',
  monthly_pass: '1ヶ月定期',
  three_month_pass: '3ヶ月定期',
};

function calcPassEndDisplay(startDate: string, kind: ExpenseKind): string {
  if (!startDate || kind === 'onetime') return '';
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  if (kind === 'monthly_pass') end.setMonth(end.getMonth() + 1);
  if (kind === 'three_month_pass') end.setMonth(end.getMonth() + 3);
  end.setDate(end.getDate() - 1);
  return `${end.getFullYear()}/${String(end.getMonth() + 1).padStart(2, '0')}/${String(end.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

function currentTargetMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function createEmptyRow(): FormRow {
  return { id: Date.now().toString(), kind: 'onetime', date: '', from: '', to: '', amount: '', receiptFile: null, receiptPreview: null };
}

export default function ExpenseRequestPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [rows, setRows] = useState<FormRow[]>([createEmptyRow()]);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateRow(id: string, patch: Partial<FormRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function handleReceiptChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => updateRow(id, { receiptFile: file, receiptPreview: reader.result as string });
      reader.readAsDataURL(file);
    } else {
      updateRow(id, { receiptFile: file, receiptPreview: null });
    }
  }

  function addRow() {
    setRows(prev => [...prev, createEmptyRow()]);
  }

  function removeRow(id: string) {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  }

  // バリデーション
  const isValid = useMemo(() => {
    return rows.every(r =>
      r.date && r.from.trim() && r.to.trim() &&
      parseInt(r.amount, 10) > 0 && r.receiptFile
    );
  }, [rows]);

  const total = useMemo(() => rows.reduce((s, r) => s + (parseInt(r.amount, 10) || 0), 0), [rows]);

  function handleConfirm() {
    // フロント側バリデーション
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.date || !r.from.trim() || !r.to.trim()) {
        toast(`明細${i + 1}: 日付・出発地・到着地を入力してください`);
        return;
      }
      const amt = parseInt(r.amount, 10);
      if (!amt || amt <= 0) {
        toast(`明細${i + 1}: 金額は1円以上で入力してください`);
        return;
      }
      if (!r.receiptFile) {
        toast(`明細${i + 1}: 領収書を添付してください`);
        return;
      }
    }
    setShowConfirm(true);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('targetMonth', currentTargetMonth());
      formData.append('items', JSON.stringify(rows.map(r => ({
        kind: r.kind,
        expenseDate: r.date,
        departure: r.from.trim(),
        destination: r.to.trim(),
        amount: parseInt(r.amount, 10),
      }))));

      rows.forEach((r, idx) => {
        if (r.receiptFile) {
          formData.append('receipts', r.receiptFile, `receipt_${idx}_${r.receiptFile.name}`);
        }
      });

      const token = getToken();
      const res = await fetch('/api/expense/request', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || '申請に失敗しました');
      }

      setShowConfirm(false);
      toast('交通費を申請しました');
      router.push('/applications');
    } catch (err: any) {
      toast(err?.message || '申請に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {rows.map((row, idx) => (
        <div key={row.id} className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-bold">明細 {rows.length > 1 ? idx + 1 : ''}</h3>
            {rows.length > 1 && (
              <button onClick={() => removeRow(row.id)} className="text-xs text-red-500 hover:text-red-700">削除</button>
            )}
          </div>

          {/* 種別切り替え */}
          <div className="mb-3">
            <label className="block text-sm font-semibold text-secondary mb-1">種別</label>
            <div className="flex gap-2">
              {(['onetime', 'monthly_pass', 'three_month_pass'] as ExpenseKind[]).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => updateRow(row.id, { kind: k })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    row.kind === k
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-primary border-border hover:bg-page'
                  }`}
                >
                  {kindLabel[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">
                {row.kind === 'onetime' ? '利用日' : '定期開始日'}
              </label>
              <input
                type="date"
                value={row.date}
                onChange={(e) => updateRow(row.id, { date: e.target.value })}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
              />
              {row.kind !== 'onetime' && row.date && (
                <p className="text-xs text-secondary mt-1">
                  有効期限: {calcPassEndDisplay(row.date, row.kind)} まで
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-secondary mb-1">出発地</label>
                <input
                  type="text"
                  value={row.from}
                  onChange={(e) => updateRow(row.id, { from: e.target.value })}
                  placeholder="大阪駅"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-secondary mb-1">到着地</label>
                <input
                  type="text"
                  value={row.to}
                  onChange={(e) => updateRow(row.id, { to: e.target.value })}
                  placeholder="天王寺駅"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">金額</label>
              <input
                type="number"
                value={row.amount}
                onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                placeholder={row.kind === 'onetime' ? '230' : '15000'}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
              />
            </div>

            {/* 領収書 */}
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">
                領収書 <span className="text-red-500">*</span>
              </label>
              <input
                ref={(el) => { fileRefs.current[row.id] = el; }}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleReceiptChange(row.id, e)}
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:bg-card file:text-primary file:font-medium file:cursor-pointer hover:file:bg-page"
              />
              {row.receiptPreview && (
                <img src={row.receiptPreview} alt="プレビュー" className="mt-2 h-20 rounded border border-border object-contain" />
              )}
              {row.receiptFile && !row.receiptPreview && (
                <p className="mt-1 text-xs text-secondary">📄 {row.receiptFile.name}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* もう一件追加 */}
      <button
        onClick={addRow}
        className="w-full py-2.5 rounded-lg border border-dashed border-border text-sm text-secondary hover:text-primary hover:border-primary transition-colors"
      >
        ＋ もう一件追加
      </button>

      {/* 申請ボタン */}
      <button
        onClick={handleConfirm}
        disabled={!isValid}
        className="w-full py-3.5 rounded-lg bg-primary text-white text-md font-semibold transition-all
                   hover:opacity-90 active:scale-[0.98] disabled:opacity-35 disabled:cursor-default"
      >
        申請内容を確認
      </button>

      {/* 確認モーダル */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/35 z-[200] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}
        >
          <div className="bg-card rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-y-auto">
            <div className="px-5 pt-5 pb-3 text-lg font-bold sticky top-0 bg-card z-10">交通費申請の確認</div>
            <div className="px-5 pb-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">申請月</span>
                <span className="font-medium">{currentTargetMonth()}</span>
              </div>

              {rows.map((row, idx) => {
                const amt = parseInt(row.amount, 10) || 0;
                return (
                  <div key={row.id} className="border border-border/30 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        row.kind === 'onetime' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {kindLabel[row.kind]}
                      </span>
                      <span className="text-sm">{formatDate(row.date)}</span>
                      {row.kind !== 'onetime' && row.date && (
                        <span className="text-xs text-secondary">〜 {calcPassEndDisplay(row.date, row.kind)}</span>
                      )}
                    </div>
                    <div className="text-sm">{row.from} → {row.to}</div>
                    <div className="text-base font-medium tabular-nums">{amt.toLocaleString()}円</div>
                    {row.receiptPreview ? (
                      <img src={row.receiptPreview} alt="領収書" className="h-24 rounded border border-border object-contain" />
                    ) : row.receiptFile ? (
                      <p className="text-xs text-secondary">📄 {row.receiptFile.name}</p>
                    ) : null}
                  </div>
                );
              })}

              <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                <span>合計</span>
                <span className="tabular-nums">{total.toLocaleString()}円</span>
              </div>
            </div>

            <div className="flex border-t border-border-light sticky bottom-0 bg-card">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 text-md text-secondary hover:bg-page transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3.5 text-md font-semibold text-primary border-l border-border-light
                           hover:bg-page transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '送信中...' : '申請する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
