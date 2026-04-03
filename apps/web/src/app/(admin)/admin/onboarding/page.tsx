/**
 * 管理側 入社予定社員
 *
 * UIモックのpage-onboardingを再現。
 * 12項目チェックリスト（内定通知書/本人確認書類/マイナンバー等）。
 * ✓ / ○ でステータスを管理、進捗バー表示。
 */

'use client';

import { useState } from 'react';

interface OnboardingPerson {
  name: string;
  hireDate: string;
  checks: boolean[];
}

const checkItems = [
  '内定通知書', '労働条件通知書', '本人確認書類', 'マイナンバー',
  '年金手帳', '給与振込口座', '入社誓約書', '情報管理徹底誓約書',
  '個人情報同意書', '誓約書', '健康告知書', 'アドレス発行',
];

const initialPeople: OnboardingPerson[] = [];

export default function AdminOnboardingPage() {
  const [people, setPeople] = useState(initialPeople);

  function toggleCheck(pIdx: number, cIdx: number) {
    setPeople(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const newChecks = [...p.checks];
      newChecks[cIdx] = !newChecks[cIdx];
      return { ...p, checks: newChecks };
    }));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">入社予定社員</h1>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full" style={{ minWidth: '900px' }}>
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] sticky left-0 z-[2] min-w-[120px]">氏名</th>
              {checkItems.map(item => (
                <th key={item} className="text-center text-2xs text-secondary font-normal px-2 py-2.5 bg-[#FAFAFA] min-w-[70px]">{item}</th>
              ))}
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">進捗</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 ? (
              <tr><td colSpan={checkItems.length + 2}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : people.map((person, pIdx) => {
              const doneCount = person.checks.filter(Boolean).length;
              const pct = Math.round(doneCount / checkItems.length * 100);
              return (
                <tr key={pIdx} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 font-medium text-base sticky left-0 bg-card z-[1]">
                    {person.name}
                    <div className="text-2xs text-secondary">{person.hireDate}</div>
                  </td>
                  {person.checks.map((checked, cIdx) => (
                    <td key={cIdx} className="text-center px-2 py-2.5">
                      <button
                        onClick={() => toggleCheck(pIdx, cIdx)}
                        className={`w-7 h-7 rounded-md text-md inline-flex items-center justify-center cursor-pointer transition-colors
                          ${checked ? 'bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA]' : 'bg-status-amber-bg text-status-amber-text hover:bg-[#FFE8C8]'}`}
                      >
                        {checked ? '✓' : '○'}
                      </button>
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-border/30 rounded overflow-hidden">
                        <div className="h-full bg-status-green-text rounded transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-secondary min-w-[32px] text-right">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
