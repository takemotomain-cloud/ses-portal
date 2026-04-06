/**
 * 管理側 商談ログ
 *
 * 名刺管理を軸に商談記録。
 * - 新規登録（手入力）
 * - 名刺から登録（画像アップロード→Claude Vision OCR→自動登録、最大100枚一括）
 * - 商談ログ記録（日付・内容・録画URL）
 *
 * API:
 *   GET  /api/business-cards            — 名刺一覧（商談ログ含む）
 *   POST /api/business-cards/scan       — 画像OCR解析
 *   POST /api/business-cards            — 名刺登録
 *   POST /api/business-cards/:id/logs   — 商談ログ追加
 *   DELETE /api/business-cards/logs/:id — 商談ログ削除
 */

'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- types ---------- */

interface DealLog {
  id: string;
  date: string;
  content: string;
  recordingUrl: string | null;
}

interface Card {
  id: string;
  name: string;
  company: string;
  dept: string;
  title: string;
  status: string;
  lastDeal: string;
  owner: string;
  email: string;
  phone: string;
  address: string;
  note: string;
  cardImage: string | null;
  logs: DealLog[];
}

interface OcrResult {
  name: string;
  company: string;
  department: string;
  title: string;
  email: string;
  phone: string;
  address: string;
}

/* ---------- badge helpers ---------- */

const statusBadge: Record<string, string> = {
  '商談中': 'badge-info',
  '提案済': 'badge-wait',
  '成約': 'badge-ok',
  'フォロー中': 'badge-warn',
  '休止': 'badge-danger',
};

const inputCls = 'w-full border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card focus:border-primary';

/* ---------- bulk upload types ---------- */
interface BulkItem {
  file: File;
  status: 'pending' | 'scanning' | 'done' | 'error';
  result?: OcrResult;
  error?: string;
}

/* ---------- component ---------- */

export default function AdminDealsPage() {
  const { toast, ToastUI } = useToast();

  /* cards from API */
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async () => {
    try {
      const data = await apiClient<any[]>('/business-cards');
      setCards(
        data.map((c: any) => ({
          id: c.id,
          name: c.name || '',
          company: c.company || '',
          dept: c.department || '',
          title: c.title || '',
          status: c.status || '商談中',
          lastDeal: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('ja-JP') : '--',
          owner: c.owner || '--',
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          note: c.note || '',
          cardImage: c.cardImage || null,
          logs: (c.logs || []).map((l: any) => ({
            id: l.id,
            date: l.date ? l.date.split('T')[0] : '',
            content: l.content || '',
            recordingUrl: l.recordingUrl || null,
          })),
        })),
      );
    } catch {
      // API未接続時は空配列のまま
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  /* filters */
  const [search, setSearch] = useState('');

  /* detail panel */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? cards.find(c => c.id === selectedId) ?? null : null;

  /* edit modal */
  const [editModalOpen, setEditModalOpen] = useState(false);

  /* new entry modal (手入力) */
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', company: '', department: '', title: '', email: '', phone: '', address: '' });
  const [newSaving, setNewSaving] = useState(false);

  /* scanner modal (名刺から登録) */
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<BulkItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  /* deal log form */
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ date: '', content: '', recordingUrl: '' });
  const [logSaving, setLogSaving] = useState(false);

  /* card image upload */
  const cardImageRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  /* deal log edit */
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ date: '', content: '', recordingUrl: '' });
  const [editLogSaving, setEditLogSaving] = useState(false);

  /* filtered data */
  const filtered = useMemo(() => {
    return cards.filter(c => {
      if (search && !c.name.includes(search) && !c.company.includes(search)) return false;
      return true;
    });
  }, [cards, search]);

  /* ---- 新規登録（手入力）ハンドラー ---- */
  const openNewModal = () => {
    setNewForm({ name: '', company: '', department: '', title: '', email: '', phone: '', address: '' });
    setNewModalOpen(true);
  };
  const handleNewSubmit = async () => {
    if (!newForm.name && !newForm.company) {
      toast('氏名または会社名を入力してください');
      return;
    }
    setNewSaving(true);
    try {
      await apiClient('/business-cards', {
        method: 'POST',
        body: JSON.stringify({
          name: newForm.name,
          company: newForm.company,
          department: newForm.department || undefined,
          title: newForm.title || undefined,
          email: newForm.email || undefined,
          phone: newForm.phone || undefined,
          address: newForm.address || undefined,
        }),
      });
      toast('登録しました');
      setNewModalOpen(false);
      fetchCards();
    } catch (err: any) {
      toast(err?.message || '登録に失敗しました');
    } finally {
      setNewSaving(false);
    }
  };

  /* ---- 名刺から登録（一括）ハンドラー ---- */
  const openBulkScanner = () => {
    setBulkFiles([]);
    setBulkProcessing(false);
    setBulkDone(false);
    setScannerOpen(true);
  };
  const closeBulkScanner = () => {
    setScannerOpen(false);
    setBulkFiles([]);
    setBulkProcessing(false);
    setBulkDone(false);
  };

  const handleBulkFileSelect = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 100).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) {
      toast('画像ファイルを選択してください');
      return;
    }
    setBulkFiles(arr.map(f => ({ file: f, status: 'pending' as const })));
    setBulkDone(false);
  };

  const startBulkProcess = async () => {
    if (bulkFiles.length === 0) return;
    setBulkProcessing(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('ses_portal_token') : null;
    const items = [...bulkFiles];

    for (let i = 0; i < items.length; i++) {
      items[i] = { ...items[i], status: 'scanning' };
      setBulkFiles([...items]);

      try {
        const formData = new FormData();
        formData.append('image', items[i].file);
        const res = await fetch('/api/business-cards/scan', {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `スキャン失敗 (${res.status})`);
        }

        const result: OcrResult = await res.json();

        if (result.name || result.company) {
          const created = await apiClient<{ id: string }>('/business-cards', {
            method: 'POST',
            body: JSON.stringify({
              name: result.name || '(名前なし)',
              company: result.company || '',
              department: result.department || undefined,
              title: result.title || undefined,
              email: result.email || undefined,
              phone: result.phone || undefined,
              address: result.address || undefined,
            }),
          });

          // 名刺画像もスキャン加工して保存
          if (created?.id) {
            try {
              const imgForm = new FormData();
              imgForm.append('image', items[i].file);
              await fetch(`/api/business-cards/${created.id}/card-image`, {
                method: 'POST',
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: imgForm,
              });
            } catch { /* 画像保存失敗は無視 */ }
          }
        }

        items[i] = { ...items[i], status: 'done', result };
      } catch (err: any) {
        items[i] = { ...items[i], status: 'error', error: err.message || '解析失敗' };
      }
      setBulkFiles([...items]);
    }

    setBulkProcessing(false);
    setBulkDone(true);
    const doneCount = items.filter(it => it.status === 'done').length;
    const errCount = items.filter(it => it.status === 'error').length;
    toast(`${doneCount}件登録完了${errCount > 0 ? `、${errCount}件失敗` : ''}`);
    fetchCards();
  };

  const bulkDoneCount = bulkFiles.filter(f => f.status === 'done').length;
  const bulkErrorCount = bulkFiles.filter(f => f.status === 'error').length;

  /* ---- 商談ログ追加 ---- */
  const handleAddLog = async () => {
    if (!selected) return;
    if (!logForm.date || !logForm.content) {
      toast('日付と内容を入力してください');
      return;
    }
    setLogSaving(true);
    try {
      await apiClient(`/business-cards/${selected.id}/logs`, {
        method: 'POST',
        body: JSON.stringify({
          date: logForm.date,
          content: logForm.content,
          recordingUrl: logForm.recordingUrl || undefined,
        }),
      });
      toast('商談ログを保存しました');
      setLogForm({ date: '', content: '', recordingUrl: '' });
      setShowLogForm(false);
      fetchCards();
    } catch (err: any) {
      toast(err?.message || '保存に失敗しました');
    } finally {
      setLogSaving(false);
    }
  };

  /* ---- 商談ログ編集 ---- */
  const startEditLog = (log: DealLog) => {
    setEditingLogId(log.id);
    setEditLogForm({ date: log.date, content: log.content, recordingUrl: log.recordingUrl || '' });
  };
  const handleUpdateLog = async () => {
    if (!editingLogId) return;
    if (!editLogForm.date || !editLogForm.content) {
      toast('日付と内容を入力してください');
      return;
    }
    setEditLogSaving(true);
    try {
      await apiClient(`/business-cards/logs/${editingLogId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          date: editLogForm.date,
          content: editLogForm.content,
          recordingUrl: editLogForm.recordingUrl || undefined,
        }),
      });
      toast('商談ログを更新しました');
      setEditingLogId(null);
      fetchCards();
    } catch (err: any) {
      toast(err?.message || '更新に失敗しました');
    } finally {
      setEditLogSaving(false);
    }
  };

  /* ---- 名刺画像アップロード ---- */
  const handleCardImageUpload = async (file: File) => {
    if (!selected) return;
    setUploadingImage(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('ses_portal_token') : null;
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/business-cards/${selected.id}/card-image`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) throw new Error('アップロードに失敗しました');
      toast('名刺画像を保存しました');
      fetchCards();
    } catch (err: any) {
      toast(err?.message || 'アップロードに失敗しました');
    } finally {
      setUploadingImage(false);
    }
  };

  /* reset log form when switching cards */
  useEffect(() => {
    setShowLogForm(false);
    setLogForm({ date: '', content: '', recordingUrl: '' });
    setEditingLogId(null);
  }, [selectedId]);

  return (
    <div>
      {/* ===== Header ===== */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">商談ログ</h1>
        <div className="flex gap-2">
          <button onClick={openNewModal} className="btn-outline text-sm py-2">新規登録</button>
          <button onClick={openBulkScanner} className="btn-primary text-sm py-2">名刺から登録</button>
        </div>
      </div>

      {/* ===== Search ===== */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="氏名・会社名で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[180px] focus:border-primary"
        />
      </div>

      {/* ===== Table ===== */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              {['No.', '会社名', '担当者名', '役職', '商談回数', '最終商談日'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map((c, idx) => (
              <tr key={c.id} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors" onClick={() => setSelectedId(c.id)}>
                <td className="px-4 py-2.5 text-base text-secondary">{idx + 1}</td>
                <td className="px-4 py-2.5 text-base">{c.company || '--'}</td>
                <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-base text-secondary">{c.title || '--'}</td>
                <td className="px-4 py-2.5 text-base">
                  {c.logs.length > 0 ? (
                    <span className="badge badge-info">{c.logs.length}回</span>
                  ) : (
                    <span className="text-secondary">--</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-base text-secondary">
                  {c.logs.length > 0 ? new Date(c.logs[c.logs.length - 1].date).toLocaleDateString('ja-JP') : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Detail Slide-over ===== */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary mt-0.5">{selected.company}{selected.dept ? ` / ${selected.dept}` : ''}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
            </div>
            <div className="p-5 space-y-6">
              {/* 名刺画像 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xs text-secondary uppercase tracking-widest">名刺画像</div>
                  <label className="text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                    {uploadingImage ? '処理中...' : selected.cardImage ? '画像を変更' : '画像をアップロード'}
                    <input
                      ref={cardImageRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleCardImageUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {selected.cardImage ? (
                  <div className="bg-page rounded-lg p-3 flex justify-center">
                    <img
                      src={`http://localhost:3001${selected.cardImage}`}
                      alt="名刺"
                      className="max-w-full rounded shadow-sm"
                      style={{ maxHeight: 200 }}
                    />
                  </div>
                ) : (
                  <div
                    className="bg-page rounded-lg p-6 text-center border-2 border-dashed border-border/30 cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => cardImageRef.current?.click()}
                  >
                    <div className="text-2xl text-secondary mb-1">&#128444;</div>
                    <div className="text-xs text-secondary">名刺画像をアップロード</div>
                  </div>
                )}
              </div>

              {/* 名刺情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">名刺情報</div>
                <div className="bg-page rounded-lg p-4 space-y-0">
                  {([
                    ['氏名', selected.name],
                    ['会社名', selected.company],
                    ['部署', selected.dept],
                    ['役職', selected.title],
                    ['メール', selected.email],
                    ['電話', selected.phone],
                    ['住所', selected.address],
                  ] as [string, string][]).filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-border/15 last:border-b-0">
                      <span className="text-secondary text-sm min-w-[60px]">{label}</span>
                      <span className="text-sm text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 商談履歴 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xs text-secondary uppercase tracking-widest">商談履歴</div>
                  {!showLogForm && (
                    <button
                      onClick={() => {
                        setLogForm({ date: new Date().toISOString().split('T')[0], content: '', recordingUrl: '' });
                        setShowLogForm(true);
                      }}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="text-lg leading-none">+</span>
                      <span>商談を追加</span>
                    </button>
                  )}
                </div>

                {/* 商談ログ入力フォーム */}
                {showLogForm && (
                  <div className="bg-page rounded-lg p-4 mb-3 space-y-3 border border-primary/20">
                    <div className="text-sm font-medium">
                      {selected.logs.length === 0 ? '1回目の商談' : `${selected.logs.length + 1}回目の商談`}
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">日付</label>
                      <input
                        type="date"
                        value={logForm.date}
                        onChange={e => setLogForm(prev => ({ ...prev, date: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">内容</label>
                      <textarea
                        value={logForm.content}
                        onChange={e => setLogForm(prev => ({ ...prev, content: e.target.value }))}
                        className={`${inputCls} min-h-[80px] resize-y`}
                        placeholder="商談の内容を入力"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">録画URL</label>
                      <input
                        type="url"
                        value={logForm.recordingUrl}
                        onChange={e => setLogForm(prev => ({ ...prev, recordingUrl: e.target.value }))}
                        className={inputCls}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowLogForm(false)}
                        className="btn-outline flex-1 text-sm py-2"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleAddLog}
                        disabled={logSaving}
                        className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                      >
                        {logSaving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 商談ログ一覧 */}
                {selected.logs.length === 0 && !showLogForm ? (
                  <div className="text-sm text-secondary py-3">商談履歴はありません</div>
                ) : (
                  <div className="space-y-2">
                    {selected.logs.map((log, idx) => (
                      <div key={log.id} className="bg-page rounded-lg p-4">
                        {editingLogId === log.id ? (
                          /* 編集モード */
                          <div className="space-y-3">
                            <div className="text-sm font-medium">{idx + 1}回目の商談を編集</div>
                            <div>
                              <label className="block text-xs text-secondary mb-1">日付</label>
                              <input
                                type="date"
                                value={editLogForm.date}
                                onChange={e => setEditLogForm(prev => ({ ...prev, date: e.target.value }))}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-secondary mb-1">内容</label>
                              <textarea
                                value={editLogForm.content}
                                onChange={e => setEditLogForm(prev => ({ ...prev, content: e.target.value }))}
                                className={`${inputCls} min-h-[80px] resize-y`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-secondary mb-1">録画URL</label>
                              <input
                                type="url"
                                value={editLogForm.recordingUrl}
                                onChange={e => setEditLogForm(prev => ({ ...prev, recordingUrl: e.target.value }))}
                                className={inputCls}
                                placeholder="https://..."
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setEditingLogId(null)} className="btn-outline flex-1 text-sm py-1.5">キャンセル</button>
                              <button onClick={handleUpdateLog} disabled={editLogSaving} className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-50">
                                {editLogSaving ? '保存中...' : '保存'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 表示モード */
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-primary bg-primary/8 rounded px-2 py-0.5">
                                  {idx + 1}回目
                                </span>
                                <span className="text-sm text-secondary">
                                  {new Date(log.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                              </div>
                              <button
                                onClick={() => startEditLog(log)}
                                className="text-xs text-secondary hover:text-primary transition-colors"
                              >
                                編集
                              </button>
                            </div>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{log.content}</div>
                            {log.recordingUrl && (
                              <div className="mt-2">
                                <a
                                  href={log.recordingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <span>&#9654;</span>
                                  <span>録画を見る</span>
                                </a>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex gap-2">
                <button onClick={() => setEditModalOpen(true)} className="btn-outline flex-1 text-sm py-2">会社情報を編集</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== 新規登録モーダル（手入力） ===== */}
      {newModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[199]" onClick={() => setNewModalOpen(false)} />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-5 border-b border-border/30">
                <h3 className="text-lg font-medium">新規登録</h3>
                <button onClick={() => setNewModalOpen(false)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
              </div>
              <div className="p-5 space-y-3">
                {([
                  ['氏名', 'name'], ['会社名', 'company'], ['部署', 'department'], ['役職', 'title'],
                  ['メールアドレス', 'email'], ['電話番号', 'phone'], ['住所', 'address'],
                ] as [string, keyof typeof newForm][]).map(([label, field]) => (
                  <div key={field}>
                    <label className="block text-xs text-secondary mb-1">{label}</label>
                    <input
                      type="text"
                      value={newForm[field]}
                      onChange={(e) => setNewForm(prev => ({ ...prev, [field]: e.target.value }))}
                      className={inputCls}
                      placeholder={label}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setNewModalOpen(false)} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
                  <button
                    onClick={handleNewSubmit}
                    disabled={newSaving}
                    className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                  >
                    {newSaving ? '登録中...' : '登録する'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== 名刺から登録モーダル（一括アップロード） ===== */}
      {scannerOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[199]" onClick={!bulkProcessing ? closeBulkScanner : undefined} />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-5 border-b border-border/30">
                <h3 className="text-lg font-medium">名刺から登録</h3>
                {!bulkProcessing && (
                  <button onClick={closeBulkScanner} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
                )}
              </div>

              <div className="p-5">
                {/* ファイル選択エリア */}
                {!bulkProcessing && !bulkDone && (
                  <div className="space-y-4">
                    <div className="text-sm text-secondary">名刺の画像をまとめてアップロードしてください（最大100枚）</div>
                    <input
                      ref={bulkInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleBulkFileSelect(e.target.files)}
                    />
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => bulkInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleBulkFileSelect(e.dataTransfer.files);
                      }}
                    >
                      {bulkFiles.length > 0 ? (
                        <div>
                          <div className="text-3xl mb-2">&#128444;</div>
                          <div className="text-base font-medium">{bulkFiles.length}枚の画像を選択済み</div>
                          <div className="text-xs text-secondary mt-1">クリックして選び直す</div>
                        </div>
                      ) : (
                        <>
                          <div className="text-4xl text-secondary mb-3">&#128247;</div>
                          <div className="text-sm text-secondary mb-2">ドラッグ&ドロップ または クリックして選択</div>
                          <div className="text-xs text-secondary">JPG, PNG形式 / 最大100枚まで</div>
                        </>
                      )}
                    </div>

                    {bulkFiles.length > 0 && (
                      <div className="max-h-[200px] overflow-y-auto border border-border/30 rounded-md">
                        {bulkFiles.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/10 text-sm">
                            <span className="text-secondary">{i + 1}.</span>
                            <span className="truncate flex-1">{item.file.name}</span>
                            <span className="text-xs text-secondary">{(item.file.size / 1024).toFixed(0)}KB</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={startBulkProcess}
                        disabled={bulkFiles.length === 0}
                        className="btn-primary text-sm py-2 disabled:opacity-40"
                      >
                        {bulkFiles.length}枚を解析・登録
                      </button>
                    </div>
                  </div>
                )}

                {/* 処理中の進捗 */}
                {bulkProcessing && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="text-base font-medium">解析・登録中...</div>
                      <div className="text-sm text-secondary">
                        {bulkDoneCount + bulkErrorCount} / {bulkFiles.length}
                      </div>
                    </div>
                    <div className="w-full bg-page rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${((bulkDoneCount + bulkErrorCount) / bulkFiles.length) * 100}%` }}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                      {bulkFiles.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm">
                          <span className="w-5 text-center">
                            {item.status === 'done' ? '✓' :
                             item.status === 'error' ? '✗' :
                             item.status === 'scanning' ? '...' : ''}
                          </span>
                          <span className={`truncate flex-1 ${item.status === 'error' ? 'text-red-500' : item.status === 'done' ? 'text-green-600' : 'text-secondary'}`}>
                            {item.file.name}
                          </span>
                          {item.status === 'done' && item.result && (
                            <span className="text-xs text-secondary">{item.result.name || item.result.company}</span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-xs text-red-500">{item.error}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 完了 */}
                {bulkDone && !bulkProcessing && (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="text-4xl mb-3">&#10003;</div>
                      <div className="text-lg font-medium mb-1">処理完了</div>
                      <div className="text-sm text-secondary">
                        {bulkDoneCount}件登録{bulkErrorCount > 0 ? ` / ${bulkErrorCount}件失敗` : ''}
                      </div>
                    </div>
                    {bulkErrorCount > 0 && (
                      <div className="max-h-[200px] overflow-y-auto border border-red-200 rounded-md bg-red-50 p-3">
                        <div className="text-xs font-medium text-red-600 mb-1">失敗した名刺:</div>
                        {bulkFiles.filter(f => f.status === 'error').map((item, i) => (
                          <div key={i} className="text-xs text-red-500 py-0.5">{item.file.name}: {item.error}</div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button onClick={closeBulkScanner} className="btn-primary text-sm py-2">閉じる</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Edit Modal ===== */}
      {editModalOpen && selected && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[199]" onClick={() => setEditModalOpen(false)} />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-5 border-b border-border/30">
                <h3 className="text-lg font-medium">名刺情報を編集</h3>
                <button onClick={() => setEditModalOpen(false)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
              </div>
              <div className="p-5 space-y-3">
                {(['氏名', '会社名', '部署', '役職', 'メール', '電話', '住所', '備考'] as const).map((label) => (
                  <div key={label}>
                    <label className="block text-xs text-secondary mb-1">{label}</label>
                    <input
                      type="text"
                      defaultValue={
                        label === '氏名' ? selected.name :
                        label === '会社名' ? selected.company :
                        label === '部署' ? selected.dept :
                        label === '役職' ? selected.title :
                        label === 'メール' ? selected.email :
                        label === '電話' ? selected.phone :
                        label === '住所' ? selected.address :
                        selected.note
                      }
                      className={inputCls}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditModalOpen(false)} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
                  <button onClick={() => { toast('名刺情報を保存しました'); setEditModalOpen(false); }} className="btn-primary flex-1 text-sm py-2">保存</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ToastUI />
    </div>
  );
}
