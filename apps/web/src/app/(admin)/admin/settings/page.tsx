/**
 * 管理側 設定
 *
 * 部署ツリー / 役職 / ロール（権限マトリクス）/ 操作ログ。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface DeptNode {
  id: string;
  name: string;
  code: string;
  _count: { employees: number };
  children: { id: string; name: string; code: string; _count: { employees: number } }[];
}

interface PositionRow {
  id: string;
  name: string;
  rank: number;
  hasApproval: boolean;
  _count: { employees: number };
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['部署・役職', 'ロール管理', '操作ログ'];
  const { toast, ToastUI } = useToast();
  const [departments, setDepartments] = useState<DeptNode[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await apiClient<DeptNode[]>('/settings/departments');
      setDepartments(data);
    } catch {
      // fallback: keep static
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const data = await apiClient<PositionRow[]>('/settings/positions');
      setPositions(data);
    } catch {
      // fallback: keep static
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchPositions();
  }, [fetchDepartments, fetchPositions]);

  const handleAddDepartment = async () => {
    const name = prompt('部署名を入力してください');
    if (!name) return;
    const code = prompt('部署コード（英数字）を入力してください');
    if (!code) return;
    try {
      await apiClient('/settings/departments', {
        method: 'POST',
        body: JSON.stringify({ name, code }),
      });
      toast('部署を追加しました');
      fetchDepartments();
    } catch (err: any) {
      toast(err?.message || 'エラーが発生しました');
    }
  };

  const handleAddPosition = async () => {
    const name = prompt('役職名を入力してください');
    if (!name) return;
    const rankStr = prompt('ランク（数値）を入力してください');
    if (!rankStr) return;
    const rank = parseInt(rankStr, 10);
    if (isNaN(rank)) { toast('ランクは数値で入力してください'); return; }
    try {
      await apiClient('/settings/positions', {
        method: 'POST',
        body: JSON.stringify({ name, rank }),
      });
      toast('役職を追加しました');
      fetchPositions();
    } catch (err: any) {
      toast(err?.message || 'エラーが発生しました');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">設定</h1>

      {/* タブ */}
      <div className="flex border-b border-border/40 mb-5">
        {tabs.map((tab, idx) => (
          <button key={tab} onClick={() => setActiveTab(idx)} className={`px-5 py-2.5 text-base border-b-2 transition-colors ${activeTab === idx ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* 部署・役職 */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-0">
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-border/30">
              <span className="text-md font-medium">部署</span>
              <button onClick={handleAddDepartment} className="btn-outline text-xs py-1 px-2.5">追加</button>
            </div>
            <div className="p-5">
              {departments.length > 0 ? departments.map(dept => (
                <div key={dept.id}>
                  <div className="text-md font-medium mb-1">
                    {dept.name}
                    <span className="text-sm text-secondary ml-auto float-right">
                      {dept._count.employees + dept.children.reduce((s, c) => s + c._count.employees, 0)}名
                    </span>
                  </div>
                  {dept.children.map(child => (
                    <div key={child.id} className="text-base text-secondary pl-6 py-1 flex items-center gap-2">
                      <span className="w-3 h-px bg-border inline-block" />{child.name} — {child._count.employees}名
                    </div>
                  ))}
                </div>
              )) : (
                <>
                  <div className="text-md font-medium mb-1">SES事業部<span className="text-sm text-secondary ml-auto float-right">68名</span></div>
                  {['第一営業課 — 12名', '第二営業課 — 10名', 'エンジニアリング課 — 46名'].map(d => (
                    <div key={d} className="text-base text-secondary pl-6 py-1 flex items-center gap-2">
                      <span className="w-3 h-px bg-border inline-block" />{d}
                    </div>
                  ))}
                  <div className="text-md font-medium mt-3 mb-1">管理部<span className="text-sm text-secondary ml-auto float-right">4名</span></div>
                  {['人事・総務 — 2名', '経理 — 2名'].map(d => (
                    <div key={d} className="text-base text-secondary pl-6 py-1 flex items-center gap-2">
                      <span className="w-3 h-px bg-border inline-block" />{d}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="card p-0">
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-border/30">
              <span className="text-md font-medium">役職</span>
              <button onClick={handleAddPosition} className="btn-outline text-xs py-1 px-2.5">追加</button>
            </div>
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {['役職名', 'ランク', '人数', '承認'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(positions.length > 0 ? positions.map(p => ({
                  name: p.name,
                  rank: p.rank,
                  count: p._count.employees,
                  approval: p.hasApproval,
                })) : [
                  { name: '部長', rank: 2, count: 3, approval: true },
                  { name: '課長', rank: 3, count: 5, approval: true },
                  { name: '主任', rank: 4, count: 8, approval: false },
                  { name: '一般', rank: 5, count: 61, approval: false },
                ]).map(p => (
                  <tr key={p.name} className="border-b border-border/20">
                    <td className="px-4 py-2.5 text-base font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-base text-right">{p.rank}</td>
                    <td className="px-4 py-2.5 text-base text-right">{p.count}名</td>
                    <td className="px-4 py-2.5"><span className={`badge ${p.approval ? 'badge-ok' : 'badge-wait'}`}>{p.approval ? 'あり' : 'なし'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ロール管理 */}
      {activeTab === 1 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead><tr className="border-b border-border">
              {['ロール名', '権限', '人数'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                { role: '管理者', perms: ['ダッシュボード', '稼働管理', '社員', '給与', '承認', '請求', 'freee', '設定'], count: 3, allOn: true },
                { role: '営業', perms: ['ダッシュボード', '稼働管理', 'クライアント', '承認', '請求'], count: 5, allOn: false },
                { role: '社員', perms: ['マイページのみ'], count: 70, allOn: false },
              ].map(r => (
                <tr key={r.role} className="border-b border-border/20">
                  <td className="px-4 py-2.5 text-base font-medium">{r.role}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {r.perms.map(p => (
                        <span key={p} className={`text-xs px-1.5 py-0.5 rounded ${r.allOn || r.role === '社員' ? 'bg-status-green-bg text-status-green-text' : 'bg-page text-secondary'}`}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-base text-right">{r.count}名</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 操作ログ */}
      {activeTab === 2 && (
        <div className="card p-0">
          {(() => {
            const logs: { time: string; user: string; action: string; badge?: string; badgeLabel?: string }[] = [];
            return logs.length > 0 ? logs.map((log, idx) => (
              <div key={idx} className={`flex items-center gap-3 px-5 py-3 text-base flex-wrap ${idx < logs.length - 1 ? 'border-b border-border/20' : ''}`}>
                <span className="text-sm text-secondary min-w-[160px]">{log.time}</span>
                <span className="font-medium min-w-[80px]">{log.user}</span>
                <span className="text-secondary flex-1">{log.action}</span>
                {log.badge && <span className={`badge ${log.badge}`}>{log.badgeLabel}</span>}
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-secondary text-sm">ログはありません</div>
            );
          })()}
        </div>
      )}
      <ToastUI />
    </div>
  );
}
