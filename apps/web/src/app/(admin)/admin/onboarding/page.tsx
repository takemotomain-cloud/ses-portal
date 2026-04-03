/**
 * 管理側 入社予定社員
 *
 * UIモックのpage-onboardingを再現。
 * 13項目チェックリスト（内定通知書/本人確認書類/マイナンバー等）。
 * ✓ / ○ / ― でステータスを管理。フォームバッジ＋対応完了アクション。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

type CheckState = 'done' | 'pending' | 'na';

interface OnboardingPerson {
  name: string;
  hireDate: string;
  checks: CheckState[];
  formStatus: string;
}

const checkItems = [
  '内定通知書', '労働条件通知書', '本人確認書類', 'マイナンバー',
  '年金手帳', '給与振込口座', '入社誓約書', '情報管理誓約書',
  '個人情報同意書', '誓約書', '健康告知書', 'アドレス発行',
];

const initialPeople: OnboardingPerson[] = [];

function cycleCheck(state: CheckState): CheckState {
  if (state === 'done') return 'pending';
  if (state === 'pending') return 'na';
  return 'done';
}

function checkDisplay(state: CheckState) {
  switch (state) {
    case 'done':
      return { symbol: '✓', cls: 'bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA]' };
    case 'pending':
      return { symbol: '○', cls: 'bg-status-amber-bg text-status-amber-text hover:bg-[#FFE8C8]' };
    case 'na':
      return { symbol: '―', cls: 'bg-border/30 text-secondary hover:bg-border/50' };
  }
}

const formBadge: Record<string, { label: string; cls: string }> = {
  submitted: { label: '提出済', cls: 'badge-ok' },
  pending: { label: '未提出', cls: 'badge-warn' },
  draft: { label: '下書き', cls: 'badge-wait' },
};

export default function AdminOnboardingPage() {
  const [people, setPeople] = useState(initialPeople);
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  function toggleCheck(pIdx: number, cIdx: number) {
    setPeople(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const newChecks = [...p.checks];
      newChecks[cIdx] = cycleCheck(newChecks[cIdx]);
      return { ...p, checks: newChecks };
    }));
  }

  function handleComplete(pIdx: number) {
    toast('対応完了にしました');
  }

  return (
    <div>
      <ToastUI />
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium">入社予定社員</h1>
          <span className="text-sm text-secondary">内定承諾者から自動追加</span>
        </div>
        <button className="btn-primary text-sm py-2" onClick={() => router.push('/admin/onboarding/form')}>入社情報フォーム（プレビュー）</button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full" style={{ minWidth: '1100px' }}>
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] sticky left-0 z-[2] min-w-[120px]">氏名<br /><span className="text-2xs">入社予定月</span></th>
              {checkItems.map(item => (
                <th key={item} className="text-center text-2xs text-secondary font-normal px-2 py-2.5 bg-[#FAFAFA] min-w-[70px]">{item}</th>
              ))}
              <th className="text-center text-xs text-secondary font-normal px-2 py-2.5 bg-[#FAFAFA] min-w-[70px]">フォーム</th>
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] min-w-[90px]">アクション</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 ? (
              <tr><td colSpan={checkItems.length + 3}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : people.map((person, pIdx) => {
              const fb = formBadge[person.formStatus];
              return (
                <tr key={pIdx} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 font-medium text-base sticky left-0 bg-card z-[1]">
                    {person.name}
                    <div className="text-2xs text-secondary">{person.hireDate}</div>
                  </td>
                  {person.checks.map((state, cIdx) => {
                    const d = checkDisplay(state);
                    return (
                      <td key={cIdx} className="text-center px-2 py-2.5">
                        <button
                          onClick={() => toggleCheck(pIdx, cIdx)}
                          className={`w-7 h-7 rounded-md text-md inline-flex items-center justify-center cursor-pointer transition-colors ${d.cls}`}
                        >
                          {d.symbol}
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-2.5">
                    {fb ? <span className={`badge ${fb.cls}`}>{fb.label}</span> : '―'}
                  </td>
                  <td className="text-center px-4 py-2.5">
                    <button
                      onClick={() => handleComplete(pIdx)}
                      className="text-xs border border-border rounded-md px-3 py-1.5 hover:bg-[#FAFAFA] transition-colors"
                    >
                      対応完了
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-secondary">
        <span className="inline-flex items-center gap-1"><span className="text-status-green-text">✓</span> 完了</span>
        <span className="inline-flex items-center gap-1"><span className="text-status-amber-text">○</span> 未対応</span>
        <span className="inline-flex items-center gap-1">― 該当なし</span>
      </div>
    </div>
  );
}
