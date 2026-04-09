/**
 * 交通費申請フォーム（都度 + 定期 対応版）
 *
 * 対応種別:
 *  - 都度  (onetime)         : 日付・区間・金額
 *  - 1ヶ月定期 (monthly_pass) : 開始日・区間・金額（終了日は API 側で自動算出）
 *  - 3ヶ月定期 (three_month_pass): 開始日・区間・金額
 *
 * 期間バリデーション / 重複定期 / 金額負数は API 側（expense.service.ts）で実行。
 * 送信時は POST /api/expense/request に items[] を渡す。
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

type ExpenseKind = 'onetime' | 'monthly_pass' | 'three_month_pass';

interface ExpenseFormItem {
  id: string;
  kind: ExpenseKind;
  date: string;   // onetime: 利用日 / pass: 開始日
  from: string;
  to: string;
  amount: number;
}

const kindLabel: Record<ExpenseKind, string> = {
  onetime: '都度',
  monthly_pass: '1ヶ月定期',
  three_month_pass: '3ヶ月定期',
};

/** 開始日と種別から定期券の終了日（表示用）を算出 */
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

export default function ExpenseRequestPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [items, setItems] = useState<ExpenseFormItem[]>([]);

  // 入力フォーム
  const [kind, setKind] = useState<ExpenseKind>('onetime');
  const [newDate, setNewDate] = useState('');
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);

  function addItem() {
    if (!newDate || !newFrom || !newTo || !newAmount) return;
    const amount = parseInt(newAmount, 10) || 0;
    if (amount <= 0) {
      toast('金額は1円以上で入力してください');
      return;
    }
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        kind,
        date: newDate,
        from: newFrom,
        to: newTo,
        amount,
      },
    ]);
    setNewDate('');
    setNewFrom('');
    setNewTo('');
    setNewAmount('');
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleSubmit() {
    if (items.length === 0) return;
    setIsSubmitting(true);
    try {
      await apiClient('/expense/request', {
        method: 'POST',
        body: JSON.stringify({
          targetMonth: currentTargetMonth(),
          items: items.map(it => ({
            kind: it.kind,
            expenseDate: it.date,
            departure: it.from,
            destination: it.to,
            amount: it.amount,
          })),
        }),
      });
      setShowConfirm(false);
      toast('交通費を申請しました');
      router.push('/applications');
    } catch (err: any) {
      toast(err?.message || '申請に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  const dateLabel = kind === 'onetime' ? '利用日' : '定期開始日';

  return (
    <div className="space-y-5">
      {/* 明細入力フォーム */}
      <div className="card p-5">
        <h3 className="text-md font-bold mb-4">明細を追加</h3>

        {/* 種別切り替え */}
        <div className="mb-3">
          <label className="block text-sm font-semibold text-secondary mb-1">種別</label>
          <div className="flex gap-2">
            {(['onetime', 'monthly_pass', 'three_month_pass'] as ExpenseKind[]).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  kind === k
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
            <label className="block text-sm font-semibold text-secondary mb-1">{dateLabel}</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
            />
            {kind !== 'onetime' && newDate && (
              <p className="text-xs text-secondary mt-1">
                有効期限: {calcPassEndDisplay(newDate, kind)} まで
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-secondary mb-1">出発地</label>
              <input
                type="text"
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value)}
                placeholder="大阪駅"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-secondary mb-1">到着地</label>
              <input
                type="text"
                value={newTo}
                onChange={(e) => setNewTo(e.target.value)}
                placeholder="梅田駅"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">金額</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder={kind === 'onetime' ? '230' : '15,000'}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={addItem}
            disabled={!newDate || !newFrom || !newTo || !newAmount}
            className="w-full py-2.5 rounded-lg border border-border text-md font-medium text-primary
                       hover:bg-page transition-colors disabled:opacity-35"
          >
            ＋ 明細を追加
          </button>
        </div>
      </div>

      {/* 明細テーブル */}
      {items.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-border">
                {['種別', '日付', '区間', '金額', ''].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-3 py-2 bg-page/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border-light last:border-b-0 text-md">
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.kind === 'onetime'
                        ? 'bg-muted text-secondary'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {kindLabel[item.kind]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    {formatDate(item.date)}
                    {item.kind !== 'onetime' && (
                      <div className="text-2xs text-secondary">
                        〜 {calcPassEndDisplay(item.date, item.kind)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm">{item.from} → {item.to}</td>
                  <td className="px-3 py-2.5 tabular-nums">{item.amount.toLocaleString()}円</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-secondary border border-border rounded px-2 py-0.5 hover:text-status-red-text hover:border-status-red-text transition-colors"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 合計 */}
          <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-page/30">
            <span className="text-md font-semibold">合計</span>
            <span className="text-xl font-semibold tabular-nums">{total.toLocaleString()}円</span>
          </div>
        </div>
      )}

      {/* 申請ボタン */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={items.length === 0}
        className="w-full py-3.5 rounded-lg bg-primary text-white text-md font-semibold transition-all
                   hover:opacity-90 active:scale-[0.98] disabled:opacity-35 disabled:cursor-default"
      >
        申請内容を確認
      </button>

      {/* 確認モーダル */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/35 z-[200] flex items-center justify-center p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}
        >
          <div className="bg-card rounded-2xl w-full max-w-[400px] overflow-hidden">
            <div className="px-5 pt-5 pb-3 text-lg font-bold">交通費申請の確認</div>
            <div className="px-5 pb-5 space-y-2.5">
              {[
                ['申請月', currentTargetMonth()],
                ['明細件数', `${items.length}件`],
                ['合計金額', `${total.toLocaleString()}円`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-md">
                  <span className="text-secondary">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex border-t border-border-light">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 text-md text-secondary hover:bg-page transition-colors"
              >
                いいえ
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3.5 text-md font-semibold text-primary border-l border-border-light
                           hover:bg-page transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '送信中...' : 'はい'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
