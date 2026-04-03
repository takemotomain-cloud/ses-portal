'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

const STATUSES = [
  { id: 1, name: '応募', flag: null, flagClass: '' },
  { id: 2, name: '書類選考', flag: null, flagClass: '' },
  { id: 3, name: '書類選考通過', flag: null, flagClass: '' },
  { id: 4, name: '一次面接設定', flag: '面接ステージ', flagClass: 'badge-info' },
  { id: 5, name: '一次面接通過', flag: '面接ステージ', flagClass: 'badge-info' },
  { id: 6, name: '最終面接設定', flag: '面接ステージ', flagClass: 'badge-info' },
  { id: 7, name: '最終面接通過', flag: '面接ステージ', flagClass: 'badge-info' },
  { id: 8, name: '内定打診中', flag: '内定出し', flagClass: 'badge-warn' },
  { id: 9, name: '内定承諾', flag: '内定承諾', flagClass: 'badge-ok' },
  { id: 10, name: '不採用', flag: '不採用', flagClass: 'badge-danger' },
  { id: 11, name: '辞退', flag: '辞退', flagClass: 'badge-wait' },
];

const JOBS = [
  { id: 1, name: 'SESエンジニア', active: true },
  { id: 2, name: 'インフラエンジニア', active: true },
  { id: 3, name: 'PM / PL', active: false },
];

export default function RecruitSettingsPage() {
  const { toast, ToastUI } = useToast();
  const [interviewers, setInterviewers] = useState<string[]>(['山本 浩二', '田辺 恵子']);
  const [newInterviewer, setNewInterviewer] = useState('');

  function addInterviewer() {
    const name = newInterviewer.trim();
    if (!name) return;
    setInterviewers((prev) => [...prev, name]);
    setNewInterviewer('');
    toast(`「${name}」を追加しました`);
  }

  function removeInterviewer(index: number) {
    const name = interviewers[index];
    setInterviewers((prev) => prev.filter((_, i) => i !== index));
    toast(`「${name}」を削除しました`);
  }

  return (
    <div>
      <ToastUI />

      <h1 className="text-2xl font-medium mb-5">採用設定</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: 面接ステータス一覧 */}
        <div className="card p-0">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-md font-medium">面接ステータス一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]" style={{ whiteSpace: 'nowrap' }}>#</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]" style={{ whiteSpace: 'nowrap' }}>ステータス名</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]" style={{ whiteSpace: 'nowrap' }}>フラグ</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]" style={{ whiteSpace: 'nowrap' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {STATUSES.map((s) => (
                  <tr key={s.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ whiteSpace: 'nowrap' }}>{s.id}</td>
                    <td className="px-4 py-2.5" style={{ whiteSpace: 'nowrap' }}>{s.name}</td>
                    <td className="px-4 py-2.5" style={{ whiteSpace: 'nowrap' }}>
                      {s.flag && <span className={`badge ${s.flagClass}`}>{s.flag}</span>}
                    </td>
                    <td className="px-4 py-2.5" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn-outline text-xs py-1 px-2"
                        onClick={() => toast(`「${s.name}」の編集画面を開きます`)}
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* 募集求人一覧 */}
          <div className="card p-0">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-md font-medium">募集求人一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]" style={{ whiteSpace: 'nowrap' }}>#</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]" style={{ whiteSpace: 'nowrap' }}>求人名</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]" style={{ whiteSpace: 'nowrap' }}>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {JOBS.map((j) => (
                    <tr key={j.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ whiteSpace: 'nowrap' }}>{j.id}</td>
                      <td className="px-4 py-2.5" style={{ whiteSpace: 'nowrap' }}>{j.name}</td>
                      <td className="px-4 py-2.5" style={{ whiteSpace: 'nowrap' }}>
                        <span className={`badge ${j.active ? 'badge-ok' : 'badge-wait'}`}>{j.active ? '募集中' : '停止中'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3">
              <button
                className="btn-outline text-sm py-1.5 px-4"
                onClick={() => toast('求人追加画面を開きます')}
              >
                求人を追加
              </button>
            </div>
          </div>

          {/* 面接官一覧 */}
          <div className="card p-0">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-md font-medium">面接官一覧</h2>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={newInterviewer}
                  onChange={(e) => setNewInterviewer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addInterviewer(); }}
                  placeholder="面接官名を入力"
                  className="border border-border rounded-md px-3 py-1.5 text-sm flex-1"
                />
                <button
                  className="btn-outline text-sm py-1.5 px-4"
                  onClick={addInterviewer}
                >
                  追加
                </button>
              </div>
              <ul className="space-y-1.5">
                {interviewers.map((name, idx) => (
                  <li key={`${name}-${idx}`} className="flex items-center justify-between px-3 py-2 bg-page rounded-md">
                    <span className="text-sm">{name}</span>
                    <button
                      className="text-secondary hover:text-status-red-text text-lg leading-none px-1"
                      onClick={() => removeInterviewer(idx)}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
