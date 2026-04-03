/**
 * 管理側 スキルシート
 *
 * 一覧→プレビュー→編集。PDFダウンロード・Excelダウンロードボタン付き。
 */

'use client';

import { useState } from 'react';

const demoSkillsheets: { id: string; name: string; edu: string; exp: string; skills: string; projects: number; updated: string; status: string }[] = [];

export default function AdminSkillsheetsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const filtered = demoSkillsheets.filter(s => (!search || s.name.includes(search)) && (!status || s.status === status));

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">スキルシート</h1>
      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="氏名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[180px]" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none min-w-[160px]">
          <option value="">ステータス: すべて</option>
          <option value="在籍">在籍</option>
          <option value="待機中">待機中</option>
        </select>
        <span className="text-sm text-secondary self-center">{filtered.length}名</span>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr className="border-b border-border">
            {['氏名', '最終学歴', '経験年数', '保有スキル', '案件数', '最終更新', ''].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer">
                <td className="px-4 py-2.5 text-base font-medium">{s.name}</td>
                <td className="px-4 py-2.5 text-base">{s.edu}</td>
                <td className="px-4 py-2.5 text-base">{s.exp}</td>
                <td className="px-4 py-2.5 text-base text-secondary">{s.skills}</td>
                <td className="px-4 py-2.5 text-base text-right">{s.projects}件</td>
                <td className="px-4 py-2.5 text-base text-secondary">{s.updated}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <button className="btn-outline text-xs py-1 px-2">PDF</button>
                    <button className="btn-outline text-xs py-1 px-2">Excel</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
