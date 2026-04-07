'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ------------------------------------------------------------------ */
/*  型定義                                                              */
/* ------------------------------------------------------------------ */

interface RecruitSource {
  id: string;
  name: string;
  category: string; // agent | media | referral | homepage
  fee: string | null;
  memo: string | null;
}

const categoryLabel: Record<string, string> = {
  agent: '紹介',
  media: '媒体',
  referral: 'リファラル',
  homepage: '自社',
};

const categoryBadge: Record<string, string> = {
  agent: 'badge-info',
  media: 'badge-warn',
  referral: 'badge-ok',
  homepage: 'badge-wait',
};

/* ------------------------------------------------------------------ */
/*  コンポーネント                                                      */
/* ------------------------------------------------------------------ */

export default function RecruitSourcesPage() {
  const { toast, ToastUI } = useToast();
  const [sources, setSources] = useState<RecruitSource[]>([]);
  const [loading, setLoading] = useState(true);

  // 追加モーダル
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'agent', fee: '', memo: '' });
  const [saving, setSaving] = useState(false);

  // 編集モーダル
  const [editTarget, setEditTarget] = useState<RecruitSource | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', fee: '', memo: '' });

  const fetchSources = useCallback(async () => {
    try {
      const data = await apiClient<RecruitSource[]>('/candidates/sources');
      setSources(data);
    } catch {
      toast('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const agents = sources.filter(s => s.category === 'agent');
  const medias = sources.filter(s => s.category === 'media');
  const others = sources.filter(s => s.category !== 'agent' && s.category !== 'media');

  // 追加
  async function handleAdd() {
    if (!addForm.name.trim()) return;
    setSaving(true);
    try {
      await apiClient('/candidates/sources', {
        method: 'POST',
        body: JSON.stringify({ name: addForm.name.trim(), category: addForm.category, fee: addForm.fee || null, memo: addForm.memo || null }),
      });
      toast('経路を追加しました');
      setShowAdd(false);
      setAddForm({ name: '', category: 'agent', fee: '', memo: '' });
      fetchSources();
    } catch {
      toast('追加に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // 編集
  function openEdit(s: RecruitSource) {
    setEditTarget(s);
    setEditForm({ name: s.name, category: s.category, fee: s.fee || '', memo: s.memo || '' });
  }

  async function handleEdit() {
    if (!editTarget || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await apiClient(`/candidates/sources/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editForm.name.trim(), category: editForm.category, fee: editForm.fee || null, memo: editForm.memo || null }),
      });
      toast('更新しました');
      setEditTarget(null);
      fetchSources();
    } catch {
      toast('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // 削除
  async function handleDelete(id: string) {
    if (!confirm('この経路を削除しますか？')) return;
    try {
      await apiClient(`/candidates/sources/${id}`, { method: 'DELETE' });
      toast('削除しました');
      fetchSources();
    } catch {
      toast('削除に失敗しました');
    }
  }

  function renderTable(title: string, items: RecruitSource[], columns: { label: string; render: (s: RecruitSource) => React.ReactNode }[]) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">{title}</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[700px]" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr className="border-b border-border">
                {columns.map(c => (
                  <th key={c.label} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{c.label}</th>
                ))}
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-center text-sm text-secondary">データはありません</td></tr>
              ) : items.map(s => (
                <tr key={s.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  {columns.map(c => (
                    <td key={c.label} className="px-4 py-2.5">{c.render(s)}</td>
                  ))}
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button className="btn-outline text-xs py-1 px-3" onClick={() => openEdit(s)}>編集</button>
                      <button className="btn-outline text-xs py-1 px-3 text-status-red-text" onClick={() => handleDelete(s.id)}>削除</button>
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

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <ToastUI />

      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">応募経路管理</h1>
        <button className="btn-primary text-sm py-2" onClick={() => setShowAdd(true)}>経路を追加</button>
      </div>

      {/* エージェント（紹介） */}
      {renderTable('エージェント（紹介）', agents, [
        { label: '経路名', render: s => <span className="text-base font-medium">{s.name}</span> },
        { label: 'タイプ', render: s => <span className={`badge ${categoryBadge[s.category] || ''}`}>{categoryLabel[s.category] || s.category}</span> },
        { label: '手数料', render: s => <span className="text-sm">{s.fee || '—'}</span> },
        { label: 'メモ', render: s => <span className="text-sm text-secondary">{s.memo || '—'}</span> },
      ])}

      {/* 媒体 */}
      {renderTable('媒体', medias, [
        { label: '経路名', render: s => <span className="text-base font-medium">{s.name}</span> },
        { label: 'タイプ', render: s => <span className={`badge ${categoryBadge[s.category] || ''}`}>{categoryLabel[s.category] || s.category}</span> },
        { label: '掲載費', render: s => <span className="text-sm tabular-nums">{s.fee || '—'}</span> },
        { label: 'メモ', render: s => <span className="text-sm text-secondary">{s.memo || '—'}</span> },
      ])}

      {/* その他 */}
      {renderTable('その他', others, [
        { label: '経路名', render: s => <span className="text-base font-medium">{s.name}</span> },
        { label: 'タイプ', render: s => <span className={`badge ${categoryBadge[s.category] || ''}`}>{categoryLabel[s.category] || s.category}</span> },
        { label: 'コスト', render: s => <span className="text-sm tabular-nums">{s.fee || '—'}</span> },
        { label: 'メモ', render: s => <span className="text-sm text-secondary">{s.memo || '—'}</span> },
      ])}

      {/* 追加モーダル */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">経路を追加</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-secondary block mb-1">経路名</label>
                <input className="border border-border rounded-md px-3 py-1.5 text-sm w-full" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-secondary block mb-1">カテゴリ</label>
                <select className="border border-border rounded-md px-3 py-1.5 text-sm w-full bg-white" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="agent">エージェント（紹介）</option>
                  <option value="media">媒体</option>
                  <option value="referral">リファラル</option>
                  <option value="homepage">自社HP</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-secondary block mb-1">手数料 / コスト</label>
                <input className="border border-border rounded-md px-3 py-1.5 text-sm w-full" placeholder="例: 理論年収の35%" value={addForm.fee} onChange={e => setAddForm(f => ({ ...f, fee: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-secondary block mb-1">メモ</label>
                <input className="border border-border rounded-md px-3 py-1.5 text-sm w-full" value={addForm.memo} onChange={e => setAddForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-outline text-sm py-2 px-4" onClick={() => setShowAdd(false)}>キャンセル</button>
              <button className="btn-primary text-sm py-2 px-4" disabled={saving || !addForm.name.trim()} onClick={handleAdd}>
                {saving ? '保存中…' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">経路を編集</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-secondary block mb-1">経路名</label>
                <input className="border border-border rounded-md px-3 py-1.5 text-sm w-full" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-secondary block mb-1">カテゴリ</label>
                <select className="border border-border rounded-md px-3 py-1.5 text-sm w-full bg-white" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="agent">エージェント（紹介）</option>
                  <option value="media">媒体</option>
                  <option value="referral">リファラル</option>
                  <option value="homepage">自社HP</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-secondary block mb-1">手数料 / コスト</label>
                <input className="border border-border rounded-md px-3 py-1.5 text-sm w-full" value={editForm.fee} onChange={e => setEditForm(f => ({ ...f, fee: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-secondary block mb-1">メモ</label>
                <input className="border border-border rounded-md px-3 py-1.5 text-sm w-full" value={editForm.memo} onChange={e => setEditForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-outline text-sm py-2 px-4" onClick={() => setEditTarget(null)}>キャンセル</button>
              <button className="btn-primary text-sm py-2 px-4" disabled={saving || !editForm.name.trim()} onClick={handleEdit}>
                {saving ? '保存中…' : '更新'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
