/**
 * 管理側 お知らせ送信ページ
 *
 * 管理者が社員向けにお知らせを一括送信する。
 * 送信先: 全社員 / 部署 / エリア / 個別選択
 * 画像添付・URL自動リンク化対応。
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient, getToken } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */
interface EmployeeOption {
  id: string;
  employeeCode: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

interface AreaOption {
  value: string;
  label: string;
}

interface SentNotification {
  title: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  sentCount: number;
  readCount: number;
}

type TargetType = 'all' | 'department' | 'area' | 'individual';

/* ---------- ヘルパー ---------- */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---------- コンポーネント ---------- */
export default function AnnouncementsPage() {
  const { toast, ToastUI } = useToast();
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  /* 送信フォーム */
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [sending, setSending] = useState(false);

  /* 画像 */
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ���認ダイアログ */
  const [showConfirm, setShowConfirm] = useState(false);

  /* 選択肢データ */
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);

  /* 送信履歴 */
  const [sentList, setSentList] = useState<SentNotification[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);

  /* データ取得 */
  useEffect(() => {
    apiClient<{
      employees: EmployeeOption[];
      departments: DepartmentOption[];
      areas: AreaOption[];
    }>('/notifications/targets')
      .then(data => {
        setEmployees(data.employees);
        setDepartments(data.departments);
        setAreas(data.areas);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 1) {
      setLoadingSent(true);
      apiClient<SentNotification[]>('/notifications/sent')
        .then(setSentList)
        .catch(() => setSentList([]))
        .finally(() => setLoadingSent(false));
    }
  }, [activeTab]);

  /* 社員検索 */
  const filteredEmployees = useMemo(() => {
    if (!empSearch) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.departmentName.toLowerCase().includes(q),
    );
  }, [employees, empSearch]);

  /* 送信先プレビュー */
  const targetPreview = useMemo(() => {
    switch (targetType) {
      case 'all':
        return `全社員（${employees.length}名）`;
      case 'department': {
        const names = selectedDepts.map(id => departments.find(d => d.id === id)?.name).filter(Boolean);
        const count = employees.filter(e => selectedDepts.includes(e.departmentId)).length;
        return names.length ? `${names.join('、')}（${count}名）` : '部署を選択してください';
      }
      case 'area':
        return selectedArea
          ? `${areas.find(a => a.value === selectedArea)?.label || selectedArea}`
          : 'エリアを選択してください';
      case 'individual':
        return selectedEmployees.length
          ? `${selectedEmployees.length}名を選択中`
          : '社員を選択してください';
    }
  }, [targetType, employees, departments, areas, selectedDepts, selectedArea, selectedEmployees]);

  /* 画像アップロード */
  async function handleImageUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast('画像サイズは5MB以下にしてください');
      return;
    }
    if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
      toast('対応形式: JPG, PNG, GIF, WebP');
      return;
    }

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const token = getToken();
      const res = await fetch('/api/notifications/upload-image', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) throw new Error('アップロードに失敗しました');
      const data = await res.json();
      setImageUrl(data.imageUrl);
    } catch (e: any) {
      toast(e.message || 'アップロードに失敗しました');
    } finally {
      setImageUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }

  /* 送信前確認ダイアログを表示 */
  function handleSendClick() {
    if (!title.trim() || !body.trim()) {
      toast('タイトルと本文を入力してください');
      return;
    }
    if (targetType === 'department' && !selectedDepts.length) { toast('部署を選択してください'); return; }
    if (targetType === 'area' && !selectedArea) { toast('エリアを選択してください'); return; }
    if (targetType === 'individual' && !selectedEmployees.length) { toast('社員を選択してください'); return; }
    setShowConfirm(true);
  }

  /* 送信実行（確認後） */
  async function handleSend() {
    setShowConfirm(false);

    const payload: any = {
      title: title.trim(),
      body: body.trim(),
      targetType,
    };

    if (imageUrl) {
      payload.imageUrl = imageUrl;
    }

    if (targetType === 'department') {
      payload.targetIds = selectedDepts;
    } else if (targetType === 'area') {
      payload.targetArea = selectedArea;
    } else if (targetType === 'individual') {
      payload.targetIds = selectedEmployees;
    }

    setSending(true);
    try {
      const result = await apiClient<{ sentCount: number }>('/notifications/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast(`${result.sentCount}名にお知らせを送信しました`);
      setTitle('');
      setBody('');
      setSelectedDepts([]);
      setSelectedArea('');
      setSelectedEmployees([]);
      setImageUrl(null);
    } catch (e: any) {
      toast(e.message || '送信に失敗しました');
    } finally {
      setSending(false);
    }
  }

  /* 部署トグル */
  function toggleDept(id: string) {
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id],
    );
  }

  /* 社員トグル */
  function toggleEmployee(id: string) {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id],
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">お知らせ配信</h1>

      {/* タブ */}
      <div className="flex border-b border-border/40 mb-5">
        <button
          onClick={() => setActiveTab(0)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 0 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          新規送信
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 1 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          送信履歴
        </button>
      </div>

      {/* 新規送信タブ */}
      {activeTab === 0 && (
        <div className="max-w-2xl space-y-5">
          {/* タイトル */}
          <div className="card p-5">
            <label className="block text-sm font-medium mb-2">
              タイトル <span className="text-status-red-text">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="お知らせのタイトルを入力"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary"
            />
          </div>

          {/* 本文 */}
          <div className="card p-5">
            <label className="block text-sm font-medium mb-2">
              本文 <span className="text-status-red-text">*</span>
            </label>
            <textarea
              rows={6}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="お知らせの内容を入力（URLを貼り付けると社員側で自動リンク化されます）"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary resize-y"
            />
            <p className="text-xs text-secondary mt-1.5">
              💡 本文に URL を貼り付けると、社員側の表示でクリック可能なリンクになります
            </p>
          </div>

          {/* 画像添付 */}
          <div className="card p-5">
            <label className="block text-sm font-medium mb-2">画像添付</label>
            {imageUrl ? (
              <div className="relative inline-block">
                <img
                  src={`${imageUrl}`}
                  alt="添付画像"
                  className="max-h-48 rounded-lg border border-border"
                />
                <button
                  onClick={async () => {
                    // R2: 物理ファイルも削除
                    const filename = imageUrl.split('/').pop();
                    if (filename) {
                      try {
                        await apiClient(`/notifications/upload-image/${encodeURIComponent(filename)}`, { method: 'DELETE' });
                      } catch {
                        /* 既に消えている等は無視 */
                      }
                    }
                    setImageUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-status-red-bg text-status-red-text
                             rounded-full flex items-center justify-center text-xs hover:bg-status-red-text hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer
                           hover:border-primary hover:bg-page/50 transition-colors"
              >
                {imageUploading ? (
                  <p className="text-sm text-secondary">アップロード中...</p>
                ) : (
                  <>
                    <div className="text-3xl text-secondary/40 mb-2">📷</div>
                    <p className="text-sm text-secondary">
                      クリックまたはドラッグ＆ドロップで画像を添付
                    </p>
                    <p className="text-xs text-secondary/60 mt-1">
                      JPG, PNG, GIF, WebP（5MB以下）
                    </p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </div>

          {/* 送信先 */}
          <div className="card p-5">
            <label className="block text-sm font-medium mb-3">送信先</label>

            {/* タイプ選択 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { value: 'all', label: '全社員' },
                { value: 'department', label: '部署' },
                { value: 'area', label: 'エリア' },
                { value: 'individual', label: '個別選択' },
              ] as { value: TargetType; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTargetType(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors
                    ${targetType === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-secondary border-border hover:border-primary hover:text-primary'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 部署選択 */}
            {targetType === 'department' && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                {departments.map(d => (
                  <label key={d.id} className="flex items-center gap-2 cursor-pointer hover:bg-page rounded px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedDepts.includes(d.id)}
                      onChange={() => toggleDept(d.id)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">{d.parentId ? '　' : ''}{d.name}</span>
                  </label>
                ))}
              </div>
            )}

            {/* エリア選択 */}
            {targetType === 'area' && (
              <div>
                {areas.length === 0 ? (
                  <div className="text-sm text-secondary py-2">配属データがないため、エリアが取得できません</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {areas.map(a => (
                      <button
                        key={a.value}
                        onClick={() => setSelectedArea(a.value === selectedArea ? '' : a.value)}
                        className={`px-4 py-2 rounded-lg text-sm border transition-colors
                          ${selectedArea === a.value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-secondary border-border hover:border-primary hover:text-primary'
                          }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 個別選択 */}
            {targetType === 'individual' && (
              <div>
                <input
                  type="text"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="氏名・社員番号・部署で検索"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary mb-2"
                />
                {selectedEmployees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedEmployees.map(id => {
                      const emp = employees.find(e => e.id === id);
                      return emp ? (
                        <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-md">
                          {emp.name}
                          <button onClick={() => toggleEmployee(id)} className="hover:text-primary/70">✕</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                  {filteredEmployees.map(e => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-page px-3 py-2 border-b border-border/20 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(e.id)}
                        onChange={() => toggleEmployee(e.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm font-medium">{e.name}</span>
                      <span className="text-xs text-secondary">{e.employeeCode}</span>
                      <span className="text-xs text-secondary ml-auto">{e.departmentName}</span>
                    </label>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <div className="px-3 py-4 text-sm text-secondary text-center">該当する社員がいません</div>
                  )}
                </div>
              </div>
            )}

            {/* プレビュー */}
            <div className="mt-3 text-sm text-secondary">
              送信先: {targetPreview}
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleSendClick}
              disabled={sending || !title.trim() || !body.trim()}
              className="px-6 py-2.5 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
            >
              {sending ? '送信中...' : 'お知らせを送信'}
            </button>
          </div>
        </div>
      )}

      {/* 送信履歴タブ */}
      {activeTab === 1 && (
        <div className="card p-0">
          {loadingSent ? (
            <div className="px-5 py-8 text-center text-sm text-secondary">読み込み中...</div>
          ) : sentList.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-secondary">送信履歴はありません</div>
          ) : (
            sentList.map((item, idx) => (
              <div
                key={idx}
                className={`px-5 py-4 ${idx < sentList.length - 1 ? 'border-b border-border/20' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="text-base font-medium">{item.title}</h3>
                  <span className="text-xs text-secondary flex-shrink-0">{fmtDate(item.createdAt)}</span>
                </div>
                <p className="text-sm text-secondary mb-2 line-clamp-2">{item.body}</p>
                {item.imageUrl && (
                  <img
                    src={`${item.imageUrl}`}
                    alt="添付画像"
                    className="max-h-24 rounded border border-border mb-2"
                  />
                )}
                <div className="flex gap-3 text-xs text-secondary">
                  <span>送信: {item.sentCount}名</span>
                  <span>既読: {item.readCount}名</span>
                  <span className="text-primary">
                    既読率: {item.sentCount > 0 ? Math.round((item.readCount / item.sentCount) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 送信確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-card w-full max-w-lg rounded-2xl p-6 shadow-xl mx-4">
            <h3 className="text-lg font-medium text-primary mb-4">送信内容の確認</h3>

            <div className="space-y-3 mb-5">
              <div>
                <span className="text-xs text-secondary">タイトル</span>
                <p className="text-base font-medium text-primary">{title}</p>
              </div>
              <div>
                <span className="text-xs text-secondary">本文</span>
                <p className="text-sm text-primary whitespace-pre-wrap bg-page rounded-lg p-3 max-h-40 overflow-y-auto">{body}</p>
              </div>
              {imageUrl && (
                <div>
                  <span className="text-xs text-secondary">添付画像</span>
                  <img
                    src={`${imageUrl}`}
                    alt="添付画像"
                    className="max-h-32 rounded-lg border border-border mt-1"
                  />
                </div>
              )}
              <div>
                <span className="text-xs text-secondary">送信先</span>
                <p className="text-sm text-primary">{targetPreview}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-5 py-2.5 rounded-lg text-sm border border-border text-secondary hover:bg-page transition-colors"
              >
                いいえ
              </button>
              <button
                onClick={handleSend}
                className="px-5 py-2.5 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
              >
                はい、送信する
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
