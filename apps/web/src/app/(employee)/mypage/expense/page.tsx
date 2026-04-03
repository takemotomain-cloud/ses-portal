/**
 * 交通費申請フォーム
 *
 * UIモックのpage-expenseを再現。
 * 明細行の追加・削除 + 合計自動計算 + 確認モーダル。
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface ExpenseItem {
  id: string;
  date: string;
  from: string;
  to: string;
  amount: number;
}

export default function ExpenseRequestPage() {
  const router = useRouter();
  const [items, setItems] = useState<ExpenseItem[]>([]);

  // 入力フォーム
  const [newDate, setNewDate] = useState('');
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);

  function addItem() {
    if (!newDate || !newFrom || !newTo || !newAmount) return;
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        date: newDate,
        from: newFrom,
        to: newTo,
        amount: parseInt(newAmount) || 0,
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

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    setIsSubmitting(false);
    setShowConfirm(false);
    router.push('/applications');
  }

  return (
    <div className="space-y-5">
      {/* 明細入力フォーム */}
      <div className="card p-5">
        <h3 className="text-md font-bold mb-4">明細を追加</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">日付</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary"
            />
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
              placeholder="230"
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
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="border-b border-border">
                {['日付', '区間', '金額', ''].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-3 py-2 bg-page/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border-light last:border-b-0 text-md">
                  <td className="px-3 py-2.5">{formatDate(item.date)}</td>
                  <td className="px-3 py-2.5">{item.from} → {item.to}</td>
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
                ['申請月', '2026年3月分'],
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
    </div>
  );
}
