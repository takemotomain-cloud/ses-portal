/**
 * 管理側 商談ログ
 *
 * 会社単位で商談を管理。
 * - 左リスト: 会社名でグループ化
 * - 詳細パネル: 会社情報（上部） + 商談履歴（名刺画像+日付+相手+内容+録画URL）
 *
 * API:
 *   GET  /api/business-cards              — 名刺一覧（商談ログ含む）
 *   POST /api/business-cards/scan         — 画像OCR解析
 *   POST /api/business-cards              — 名刺登録
 *   POST /api/business-cards/:id/logs     — 商談ログ追加
 *   POST /api/business-cards/logs/:id/images — 商談ログ名刺画像追加
 *   PATCH /api/business-cards/logs/:id    — 商談ログ更新
 *   DELETE /api/business-cards/logs/:id   — 商談ログ削除
 */

'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- types ---------- */

interface DealLog {
  id: string;
  date: string;
  content: string;
  contacts: string | null;
  cardImages: string | null;
  recordingUrl: string | null;
}

interface Card {
  id: string;
  name: string;
  company: string;
  dept: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  note: string;
  cardImage: string | null;
  logs: DealLog[];
}

/** カード（会社）単位のデータ */
interface CompanyGroup {
  id: string;
  company: string;
  cards: Card[];
  allLogs: DealLog[];
  lastDealDate: string | null;
  email: string;
  phone: string;
  address: string;
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

/** 商談相手（名前+役職） */
interface ContactPerson {
  name: string;
  title: string;
}

/* ---------- helpers ---------- */

const inputCls = 'w-full border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card focus:border-primary';

/** contacts JSON文字列をパース */
function parseContacts(json: string | null): ContactPerson[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // 旧形式（カンマ区切り文字列）のフォールバック
    return json.split(/[,、]/).map(s => ({ name: s.trim(), title: '' })).filter(c => c.name);
  }
  return [];
}

/** ContactPerson[] → JSON文字列 */
function stringifyContacts(contacts: ContactPerson[]): string {
  const filtered = contacts.filter(c => c.name.trim());
  if (filtered.length === 0) return '';
  return JSON.stringify(filtered);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function parseCardImages(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

/* ---------- bulk upload types ---------- */
interface BulkItem {
  file: File;
  status: 'pending' | 'scanning' | 'done' | 'error';
  result?: OcrResult;
  error?: string;
}

interface BulkCompanyGroup {
  company: string;
  items: BulkItem[];
  existingCardId: string | null;
  useExisting: boolean;
}

/* ---------- component ---------- */

export default function AdminDealsPage() {
  const router = useRouter();
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
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          note: c.note || '',
          cardImage: c.cardImage || null,
          logs: (c.logs || []).map((l: any) => ({
            id: l.id,
            date: l.date ? l.date.split('T')[0] : '',
            content: l.content || '',
            contacts: l.contacts || null,
            cardImages: l.cardImages || null,
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

  /* カード（会社）単位でリスト化 */
  const companyGroups = useMemo((): CompanyGroup[] => {
    return cards.map(c => {
      const sortedLogs = [...c.logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return {
        id: c.id,
        company: c.company || '(会社名なし)',
        cards: [c],
        allLogs: sortedLogs,
        lastDealDate: sortedLogs.length > 0 ? sortedLogs[0].date : null,
        email: c.email,
        phone: c.phone,
        address: c.address,
      };
    }).sort((a, b) => {
      if (!a.lastDealDate && !b.lastDealDate) return 0;
      if (!a.lastDealDate) return 1;
      if (!b.lastDealDate) return -1;
      return new Date(b.lastDealDate).getTime() - new Date(a.lastDealDate).getTime();
    });
  }, [cards]);

  /* filters */
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return companyGroups;
    return companyGroups.filter(g =>
      g.company.includes(search) ||
      g.cards.some(c => c.name.includes(search)),
    );
  }, [companyGroups, search]);

  /* detail panel */
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedGroup = selectedCardId ? companyGroups.find(g => g.id === selectedCardId) ?? null : null;

  /* new entry modal */
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', company: '', department: '', title: '', email: '', phone: '', address: '' });
  const [newSaving, setNewSaving] = useState(false);
  const [newDuplicateFound, setNewDuplicateFound] = useState<Card | null>(null);

  /* scanner modal */
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<BulkItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const [bulkReview, setBulkReview] = useState(false);
  const [bulkGroups, setBulkGroups] = useState<BulkCompanyGroup[]>([]);
  const [bulkRegistering, setBulkRegistering] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  /* deal log form */
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ date: '', content: '', recordingUrl: '' });
  const [logContacts, setLogContacts] = useState<ContactPerson[]>([{ name: '', title: '' }]);
  const [logSaving, setLogSaving] = useState(false);
  const [logCardFiles, setLogCardFiles] = useState<File[]>([]);
  const logCardInputRef = useRef<HTMLInputElement>(null);

  /* deal log edit */
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ date: '', content: '', recordingUrl: '' });
  const [editLogContacts, setEditLogContacts] = useState<ContactPerson[]>([]);
  const [editLogSaving, setEditLogSaving] = useState(false);

  /* company edit */
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyEditForm, setCompanyEditForm] = useState({ company: '', email: '', phone: '', address: '' });
  const [companyEditSaving, setCompanyEditSaving] = useState(false);

  /* lightbox */
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  /* image upload to existing log */
  const [uploadingLogImageId, setUploadingLogImageId] = useState<string | null>(null);

  /* ---- 新規登録（手入力）ハンドラー ---- */
  const openNewModal = () => {
    setNewForm({ name: '', company: '', department: '', title: '', email: '', phone: '', address: '' });
    setNewDuplicateFound(null);
    setNewModalOpen(true);
  };

  /** 入力内容で会社名重複チェック → 重複あれば確認画面、なければ即登録 */
  const handleNewSubmit = async () => {
    if (!newForm.name && !newForm.company) {
      toast('氏名または会社名を入力してください');
      return;
    }
    // 会社名が入力されている場合、既存チェック
    if (newForm.company) {
      const existing = cards.find(c => c.company === newForm.company);
      if (existing) {
        setNewDuplicateFound(existing);
        return; // 確認画面を表示
      }
    }
    // 重複なし → 新規登録実行
    await executeNewAsNew();
  };

  /** 新規カードとして登録（重複確認後 or 重複なし） */
  const executeNewAsNew = async () => {
    setNewSaving(true);
    try {
      const created = await apiClient<{ id: string }>('/business-cards', {
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
      if (created?.id) {
        try {
          const initContacts: ContactPerson[] = newForm.name
            ? [{ name: newForm.name, title: newForm.title || '' }]
            : [];
          await apiClient(`/business-cards/${created.id}/logs`, {
            method: 'POST',
            body: JSON.stringify({
              date: new Date().toISOString().split('T')[0],
              content: '新規登録',
              contacts: stringifyContacts(initContacts) || undefined,
            }),
          });
        } catch { /* ログ作成失敗は無視 */ }
      }
      toast('登録しました');
      setNewModalOpen(false);
      setNewDuplicateFound(null);
      fetchCards();
    } catch (err: any) {
      toast(err?.message || '登録に失敗しました');
    } finally {
      setNewSaving(false);
    }
  };

  /** 既存会社に商談ログとして追加 */
  const executeNewAsExisting = async () => {
    if (!newDuplicateFound) return;
    setNewSaving(true);
    try {
      const initContacts: ContactPerson[] = newForm.name
        ? [{ name: newForm.name, title: newForm.title || '' }]
        : [];
      await apiClient(`/business-cards/${newDuplicateFound.id}/logs`, {
        method: 'POST',
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          content: '新規登録',
          contacts: stringifyContacts(initContacts) || undefined,
        }),
      });
      toast('既存の会社に商談履歴を追加しました');
      setNewModalOpen(false);
      setNewDuplicateFound(null);
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
    setBulkReview(false);
    setBulkGroups([]);
    setBulkRegistering(false);
    setScannerOpen(true);
  };
  const closeBulkScanner = () => {
    setScannerOpen(false);
    setBulkFiles([]);
    setBulkProcessing(false);
    setBulkDone(false);
    setBulkReview(false);
    setBulkGroups([]);
    setBulkRegistering(false);
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

  /* Phase 1: OCRスキャンのみ実行（DB保存はしない） */
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
        items[i] = { ...items[i], status: 'done', result };
      } catch (err: any) {
        items[i] = { ...items[i], status: 'error', error: err.message || '解析失敗' };
      }
      setBulkFiles([...items]);
    }

    setBulkProcessing(false);

    // スキャン結果を会社名でグループ化 → 確認画面へ
    const doneItems = items.filter(it => it.status === 'done' && it.result);
    if (doneItems.length === 0) {
      setBulkDone(true);
      toast('解析に成功した名刺がありません');
      return;
    }

    const companyMap = new Map<string, BulkItem[]>();
    for (const item of doneItems) {
      const company = item.result!.company || '(会社名なし)';
      if (!companyMap.has(company)) companyMap.set(company, []);
      companyMap.get(company)!.push(item);
    }

    const groups: BulkCompanyGroup[] = [];
    for (const [company, groupItems] of companyMap) {
      const existingCard = cards.find(c => c.company === company);
      groups.push({
        company,
        items: groupItems,
        existingCardId: existingCard?.id || null,
        useExisting: !!existingCard,
      });
    }

    setBulkGroups(groups);
    setBulkReview(true);
  };

  /* Phase 3: 確認後の登録実行 */
  const executeBulkRegistration = async () => {
    setBulkRegistering(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('ses_portal_token') : null;
    let successCount = 0;
    let errorCount = 0;

    for (const group of bulkGroups) {
      try {
        const contactPersons: ContactPerson[] = group.items
          .map(it => ({ name: it.result!.name || '', title: it.result!.title || '' }))
          .filter(c => c.name);
        const contactsJson = stringifyContacts(contactPersons);

        // 登録先カードIDを決定（既存 or 新規作成）
        // 既存会社に追加 or 新規カード作成
        let cardId: string | null = null;
        if (group.useExisting && group.existingCardId) {
          cardId = group.existingCardId;
        } else {
          // 新規会社 or 「別の会社として新規登録」→ カード作成
          const rep = group.items[0].result!;
          const created = await apiClient<{ id: string }>('/business-cards', {
            method: 'POST',
            body: JSON.stringify({
              name: rep.name || '(名前なし)',
              company: rep.company || '',
              department: rep.department || undefined,
              title: rep.title || undefined,
              email: rep.email || undefined,
              phone: rep.phone || undefined,
              address: rep.address || undefined,
            }),
          });
          cardId = created?.id || null;
        }

        if (cardId) {
          // 商談ログを追加 + 名刺画像を添付
          const log = await apiClient<{ id: string }>(`/business-cards/${cardId}/logs`, {
            method: 'POST',
            body: JSON.stringify({
              date: new Date().toISOString().split('T')[0],
              content: '名刺スキャンにより登録',
              contacts: contactsJson || undefined,
            }),
          });
          if (log?.id) {
            for (const item of group.items) {
              try {
                const imgForm = new FormData();
                imgForm.append('image', item.file);
                await fetch(`/api/business-cards/logs/${log.id}/images`, {
                  method: 'POST',
                  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: imgForm,
                });
              } catch { /* 画像失敗は無視 */ }
            }
          }
        }
        successCount += group.items.length;
      } catch (err: any) {
        console.error('[bulk] 登録エラー:', err);
        errorCount += group.items.length;
      }
    }

    setBulkRegistering(false);
    setBulkReview(false);
    setBulkDone(true);
    if (errorCount > 0) {
      toast(`${successCount}件登録完了、${errorCount}件失敗`);
    } else {
      toast(`${successCount}件登録しました`);
    }
    fetchCards();
  };

  const bulkDoneCount = bulkFiles.filter(f => f.status === 'done').length;
  const bulkErrorCount = bulkFiles.filter(f => f.status === 'error').length;

  /* ---- 商談ログ追加 ---- */
  const handleAddLog = async () => {
    if (!selectedGroup) return;
    if (!logForm.date || !logForm.content) {
      toast('日付と内容を入力してください');
      return;
    }
    setLogSaving(true);
    try {
      // このグループの最初のカードIDに紐付け
      const primaryCardId = selectedGroup.cards[0].id;
      const contactsJson = stringifyContacts(logContacts);
      const created = await apiClient<{ id: string }>(`/business-cards/${primaryCardId}/logs`, {
        method: 'POST',
        body: JSON.stringify({
          date: logForm.date,
          content: logForm.content,
          contacts: contactsJson || undefined,
          recordingUrl: logForm.recordingUrl || undefined,
        }),
      });

      // 名刺画像をアップロード
      if (created?.id && logCardFiles.length > 0) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('ses_portal_token') : null;
        for (const file of logCardFiles) {
          try {
            const formData = new FormData();
            formData.append('image', file);
            await fetch(`/api/business-cards/logs/${created.id}/images`, {
              method: 'POST',
              headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: formData,
            });
          } catch { /* 画像失敗は無視 */ }
        }
      }

      toast('商談ログを保存しました');
      setLogForm({ date: '', content: '', recordingUrl: '' });
      setLogContacts([{ name: '', title: '' }]);
      setLogCardFiles([]);
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
    const parsed = parseContacts(log.contacts);
    setEditLogContacts(parsed.length > 0 ? parsed : [{ name: '', title: '' }]);
    setEditLogForm({
      date: log.date,
      content: log.content,
      recordingUrl: log.recordingUrl || '',
    });
  };
  const handleUpdateLog = async () => {
    if (!editingLogId) return;
    if (!editLogForm.date || !editLogForm.content) {
      toast('日付と内容を入力してください');
      return;
    }
    setEditLogSaving(true);
    try {
      const contactsJson = stringifyContacts(editLogContacts);
      await apiClient(`/business-cards/logs/${editingLogId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          date: editLogForm.date,
          content: editLogForm.content,
          contacts: contactsJson || undefined,
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

  /* ---- 商談ログに名刺画像追加 ---- */
  const handleLogImageUpload = async (logId: string, file: File) => {
    setUploadingLogImageId(logId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('ses_portal_token') : null;
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/business-cards/logs/${logId}/images`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) throw new Error('アップロードに失敗しました');
      toast('名刺画像を追加しました');
      fetchCards();
    } catch (err: any) {
      toast(err?.message || 'アップロードに失敗しました');
    } finally {
      setUploadingLogImageId(null);
    }
  };

  /**
   * R2: 商談ログの名刺画像を削除
   */
  const handleLogImageDelete = async (logId: string, imagePath: string) => {
    if (!confirm('この名刺画像を削除しますか？')) return;
    try {
      await apiClient(`/business-cards/logs/${logId}/images`, {
        method: 'DELETE',
        body: JSON.stringify({ imagePath }),
      });
      toast('名刺画像を削除しました');
      fetchCards();
    } catch (err: any) {
      toast(err?.message || '削除に失敗しました');
    }
  };

  /* ---- 会社情報編集 ---- */
  const startEditCompany = () => {
    if (!selectedGroup) return;
    setCompanyEditForm({
      company: selectedGroup.company,
      email: selectedGroup.email,
      phone: selectedGroup.phone,
      address: selectedGroup.address,
    });
    setEditingCompany(true);
  };

  const handleUpdateCompany = async () => {
    if (!selectedGroup) return;
    setCompanyEditSaving(true);
    try {
      // グループ内の全カードの会社情報を更新
      for (const card of selectedGroup.cards) {
        await apiClient(`/business-cards/${card.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            company: companyEditForm.company,
            email: companyEditForm.email || undefined,
            phone: companyEditForm.phone || undefined,
            address: companyEditForm.address || undefined,
          }),
        });
      }
      toast('会社情報を更新しました');
      setEditingCompany(false);
      // 会社名が変わった場合は選択を更新
      await fetchCards();
      // selectedCardId はカードIDなので変更不要
    } catch (err: any) {
      toast(err?.message || '更新に失敗しました');
    } finally {
      setCompanyEditSaving(false);
    }
  };

  /* reset form when switching companies */
  useEffect(() => {
    setShowLogForm(false);
    setLogForm({ date: '', content: '', recordingUrl: '' });
    setLogContacts([{ name: '', title: '' }]);
    setLogCardFiles([]);
    setEditingLogId(null);
    setEditingCompany(false);
  }, [selectedCardId]);

  return (
    <div>
      {/* ===== Header ===== */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">商談ログ</h1>
        {!selectedGroup && (
          <div className="flex gap-2">
            <button onClick={openNewModal} className="btn-outline text-sm py-2">新規登録</button>
            <button onClick={openBulkScanner} className="btn-primary text-sm py-2">名刺から登録</button>
          </div>
        )}
      </div>

      {/* ===== 一覧表示（会社未選択時） ===== */}
      {!selectedGroup && (<>

      {/* Search */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="会社名・氏名で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[180px] focus:border-primary"
        />
        <span className="text-sm text-secondary">{filtered.length}社</span>
      </div>

      {/* Table (会社単位) */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              {['No.', '会社名', '担当者', '商談回数', '最終商談日'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map((g, idx) => {
              return (
                <tr
                  key={g.id}
                  className={`border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors ${selectedCardId === g.id ? 'bg-primary/3' : ''}`}
                  onClick={() => setSelectedCardId(g.id)}
                >
                  <td className="px-4 py-2.5 text-base text-secondary whitespace-nowrap">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-base font-medium whitespace-nowrap">{g.company}</td>
                  <td className="px-4 py-2.5 text-base text-secondary whitespace-nowrap">
                    {g.cards[0]?.name || '--'}
                  </td>
                  <td className="px-4 py-2.5 text-base whitespace-nowrap">
                    {g.allLogs.length > 0 ? (
                      <span className="badge badge-info">{g.allLogs.length}回</span>
                    ) : (
                      <span className="text-secondary">--</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-base text-secondary whitespace-nowrap">{fmtDate(g.lastDealDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      </>)}

      {/* ===== 会社詳細（フルページ） ===== */}
      {selectedGroup && (
        <div className="mt-6">
          {/* ヘッダー */}
          <div className="flex items-center gap-4 mb-5">
            <button onClick={() => setSelectedCardId(null)} className="btn-outline text-sm py-2">一覧に戻る</button>
            <h2 className="text-xl font-medium">{selectedGroup.company}</h2>
          </div>

          {/* 会社情報 + 商談履歴 の2カラム */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 左: 会社情報 */}
            <div className="lg:col-span-1">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xs text-secondary uppercase tracking-widest">会社情報</div>
                  {!editingCompany && (
                    <button onClick={startEditCompany} className="text-xs text-secondary hover:text-primary transition-colors">編集</button>
                  )}
                </div>

                {editingCompany ? (
                  <div className="space-y-3">
                    {([
                      ['会社名', 'company'],
                      ['メール', 'email'],
                      ['電話', 'phone'],
                      ['住所', 'address'],
                    ] as [string, keyof typeof companyEditForm][]).map(([label, field]) => (
                      <div key={field}>
                        <label className="block text-xs text-secondary mb-1">{label}</label>
                        <input
                          type="text"
                          value={companyEditForm[field]}
                          onChange={e => setCompanyEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditingCompany(false)} className="btn-outline flex-1 text-sm py-1.5">キャンセル</button>
                      <button onClick={handleUpdateCompany} disabled={companyEditSaving} className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-50">
                        {companyEditSaving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {([
                      ['会社名', selectedGroup.company],
                      ['メール', selectedGroup.email],
                      ['電話', selectedGroup.phone],
                      ['住所', selectedGroup.address],
                    ] as [string, string][]).filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="flex justify-between py-2 border-b border-border/15 last:border-b-0 text-sm">
                        <span className="text-secondary">{label}</span>
                        <span className="text-right max-w-[60%]">{value}</span>
                      </div>
                    ))}
                    {/* クライアント登録ボタン */}
                    <div className="mt-4 pt-3 border-t border-border/15">
                      <button
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set('from', 'deal');
                          if (selectedGroup!.company) params.set('company', selectedGroup!.company);
                          if (selectedGroup!.email) params.set('email', selectedGroup!.email);
                          if (selectedGroup!.phone) params.set('phone', selectedGroup!.phone);
                          if (selectedGroup!.address) params.set('address', selectedGroup!.address);
                          const card = selectedGroup!.cards[0];
                          if (card?.name) params.set('contactPerson', card.name);
                          router.push(`/admin/clients/new?${params.toString()}`);
                        }}
                        className="w-full btn-outline text-sm py-2"
                      >
                        クライアントとして登録
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 右: 商談履歴 */}
            <div className="lg:col-span-2">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-2xs text-secondary uppercase tracking-widest">商談履歴</div>
                  {!showLogForm && (
                    <button
                      onClick={() => {
                        setLogForm({ date: new Date().toISOString().split('T')[0], content: '', recordingUrl: '' });
                        setLogContacts([{ name: '', title: '' }]);
                        setLogCardFiles([]);
                        setShowLogForm(true);
                      }}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="text-lg leading-none">+</span>
                      <span>商談を追加</span>
                    </button>
                  )}
                </div>

                {/* 新規商談ログ入力フォーム */}
                {showLogForm && (
                  <div className="bg-page rounded-lg p-5 mb-4 space-y-3 border border-primary/20">
                    <div className="text-sm font-medium">
                      {selectedGroup.allLogs.length === 0 ? '1回目の商談' : `${selectedGroup.allLogs.length + 1}回目の商談`}
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">日付</label>
                      <input type="date" value={logForm.date} onChange={e => setLogForm(prev => ({ ...prev, date: e.target.value }))} className={`${inputCls} max-w-[220px]`} />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">商談相手</label>
                      <div className="space-y-2">
                        {logContacts.map((c, ci) => (
                          <div key={ci} className={`grid gap-2 items-center ${logContacts.length > 1 ? 'grid-cols-[1fr_100px_24px]' : 'grid-cols-[1fr_100px]'}`}>
                            <input
                              type="text" value={c.name} placeholder="氏名"
                              onChange={e => setLogContacts(prev => prev.map((p, i) => i === ci ? { ...p, name: e.target.value } : p))}
                              className={inputCls}
                            />
                            <input
                              type="text" value={c.title} placeholder="役職"
                              onChange={e => setLogContacts(prev => prev.map((p, i) => i === ci ? { ...p, title: e.target.value } : p))}
                              className={inputCls}
                            />
                            {logContacts.length > 1 && (
                              <button type="button" onClick={() => setLogContacts(prev => prev.filter((_, i) => i !== ci))} className="text-red-400 hover:text-red-600 text-lg leading-none justify-self-center">&#10005;</button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setLogContacts(prev => [...prev, { name: '', title: '' }])} className="text-xs text-primary hover:text-primary/80 transition-colors">+ 相手を追加</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">内容</label>
                      <textarea value={logForm.content} onChange={e => setLogForm(prev => ({ ...prev, content: e.target.value }))} className={`${inputCls} min-h-[100px] resize-y`} placeholder="商談の内容を入力" />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">録画URL</label>
                      <input type="url" value={logForm.recordingUrl} onChange={e => setLogForm(prev => ({ ...prev, recordingUrl: e.target.value }))} className={inputCls} placeholder="https://..." />
                    </div>
                    {/* 名刺画像アップロード */}
                    <div>
                      <label className="block text-xs text-secondary mb-1">名刺画像</label>
                      <input ref={logCardInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) { setLogCardFiles(prev => [...prev, ...Array.from(e.target.files!)]); } e.target.value = ''; }} />
                      <div className="flex flex-wrap gap-2">
                        {logCardFiles.map((f, i) => (
                          <div key={i} className="relative group">
                            <img src={URL.createObjectURL(f)} alt={f.name} className="h-14 rounded border border-border/30" />
                            <button onClick={() => setLogCardFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&#10005;</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => logCardInputRef.current?.click()} className="h-14 px-4 rounded border-2 border-dashed border-border/30 flex items-center justify-center text-secondary hover:border-primary/30 hover:text-primary transition-colors text-sm gap-1">
                          <span className="text-lg">+</span> 追加
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setShowLogForm(false); setLogCardFiles([]); }} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
                      <button onClick={handleAddLog} disabled={logSaving} className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">{logSaving ? '保存中...' : '保存'}</button>
                    </div>
                  </div>
                )}

                {/* 商談ログ一覧（タイムライン） */}
                {selectedGroup.allLogs.length === 0 && !showLogForm ? (
                  <div className="text-sm text-secondary py-3">商談履歴はありません</div>
                ) : (
                  <div className="relative">
                    {/* タイムライン縦線 */}
                    {selectedGroup.allLogs.length > 1 && (
                      <div className="absolute left-[11px] top-6 bottom-6 w-px bg-border/30" />
                    )}
                    <div className="space-y-0">
                    {selectedGroup.allLogs.map((log, idx) => (
                      <div key={log.id} className="relative pl-9 pb-6 last:pb-0 group/entry">
                        {/* タイムラインドット */}
                        <div className={`absolute left-[6px] top-[6px] w-[11px] h-[11px] rounded-full border-2 ${idx === 0 ? 'border-primary bg-primary/20' : 'border-border/50 bg-card'}`} />

                        {editingLogId === log.id ? (
                          /* 編集モード */
                          <div className="bg-page rounded-lg p-5 border border-primary/20 space-y-3">
                            <div className="text-sm font-medium">{selectedGroup.allLogs.length - idx}回目の商談を編集</div>
                            <div>
                              <label className="block text-xs text-secondary mb-1">日付</label>
                              <input type="date" value={editLogForm.date} onChange={e => setEditLogForm(prev => ({ ...prev, date: e.target.value }))} className={`${inputCls} max-w-[220px]`} />
                            </div>
                            <div>
                              <label className="block text-xs text-secondary mb-1">商談相手</label>
                              <div className="space-y-2">
                                {editLogContacts.map((c, ci) => (
                                  <div key={ci} className={`grid gap-2 items-center ${editLogContacts.length > 1 ? 'grid-cols-[1fr_100px_24px]' : 'grid-cols-[1fr_100px]'}`}>
                                    <input
                                      type="text" value={c.name} placeholder="氏名"
                                      onChange={e => setEditLogContacts(prev => prev.map((p, i) => i === ci ? { ...p, name: e.target.value } : p))}
                                      className={inputCls}
                                    />
                                    <input
                                      type="text" value={c.title} placeholder="役職"
                                      onChange={e => setEditLogContacts(prev => prev.map((p, i) => i === ci ? { ...p, title: e.target.value } : p))}
                                      className={inputCls}
                                    />
                                    {editLogContacts.length > 1 && (
                                      <button type="button" onClick={() => setEditLogContacts(prev => prev.filter((_, i) => i !== ci))} className="text-red-400 hover:text-red-600 text-lg leading-none justify-self-center">&#10005;</button>
                                    )}
                                  </div>
                                ))}
                                <button type="button" onClick={() => setEditLogContacts(prev => [...prev, { name: '', title: '' }])} className="text-xs text-primary hover:text-primary/80 transition-colors">+ 相手を追加</button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-secondary mb-1">内容</label>
                              <textarea value={editLogForm.content} onChange={e => setEditLogForm(prev => ({ ...prev, content: e.target.value }))} className={`${inputCls} min-h-[80px] resize-y`} />
                            </div>
                            <div>
                              <label className="block text-xs text-secondary mb-1">録画URL</label>
                              <input type="url" value={editLogForm.recordingUrl} onChange={e => setEditLogForm(prev => ({ ...prev, recordingUrl: e.target.value }))} className={inputCls} placeholder="https://..." />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setEditingLogId(null)} className="btn-outline flex-1 text-sm py-1.5">キャンセル</button>
                              <button onClick={handleUpdateLog} disabled={editLogSaving} className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-50">{editLogSaving ? '保存中...' : '保存'}</button>
                            </div>
                          </div>
                        ) : (
                          /* 表示モード */
                          <div>
                            {/* ヘッダー: 日付 + 回数 + 編集 */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium">{fmtDate(log.date)}</span>
                              <span className="text-2xs text-secondary">({selectedGroup.allLogs.length - idx}回目)</span>
                              <button
                                onClick={() => startEditLog(log)}
                                className="ml-auto text-xs text-secondary hover:text-primary transition-colors opacity-0 group-hover/entry:opacity-100"
                              >
                                編集
                              </button>
                            </div>

                            {/* 商談相手 */}
                            {log.contacts && parseContacts(log.contacts).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {parseContacts(log.contacts).map((person, nIdx) => (
                                  <span key={nIdx} className="inline-flex items-center px-2 py-0.5 bg-page rounded text-xs border border-border/15">
                                    <span className="font-medium">{person.name}</span>
                                    {person.title && <span className="text-secondary ml-1">{person.title}</span>}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* 内容 */}
                            <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary/85">{log.content}</div>

                            {/* 名刺画像プレビュー */}
                            {parseCardImages(log.cardImages).length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {parseCardImages(log.cardImages).map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative group">
                                    <img
                                      src={img}
                                      alt="名刺"
                                      className="h-20 rounded border border-border/30 shadow-sm cursor-pointer hover:opacity-80 hover:shadow-md transition-all"
                                      onClick={() => setLightboxImage(img)}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleLogImageDelete(log.id, img); }}
                                      className="absolute -top-2 -right-2 w-5 h-5 bg-status-red-bg text-status-red-text rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 hover:bg-status-red-text hover:text-white transition-all"
                                      aria-label="画像を削除"
                                      title="画像を削除"
                                    >
                                      &#10005;
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* フッター: アクション */}
                            <div className="flex items-center gap-4 mt-2.5 text-xs">
                              {log.recordingUrl && (
                                <a href={log.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                  <span>&#9654;</span><span>録画を見る</span>
                                </a>
                              )}
                              <label className="inline-flex items-center gap-1 text-secondary hover:text-primary cursor-pointer transition-colors">
                                {uploadingLogImageId === log.id ? '処理中...' : '+ 名刺画像'}
                                <input type="file" accept="image/*" className="hidden" disabled={uploadingLogImageId === log.id} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogImageUpload(log.id, f); e.target.value = ''; }} />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 新規登録モーダル（手入力） ===== */}
      {newModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[199]" onClick={() => { setNewModalOpen(false); setNewDuplicateFound(null); }} />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-5 border-b border-border/30">
                <h3 className="text-lg font-medium">新規登録</h3>
                <button onClick={() => { setNewModalOpen(false); setNewDuplicateFound(null); }} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
              </div>
              <div className="p-5 space-y-3">
                {!newDuplicateFound ? (
                  <>
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
                      <button onClick={() => { setNewModalOpen(false); setNewDuplicateFound(null); }} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
                      <button
                        onClick={handleNewSubmit}
                        disabled={newSaving}
                        className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                      >
                        {newSaving ? '登録中...' : '登録する'}
                      </button>
                    </div>
                  </>
                ) : (
                  /* 重複確認画面 */
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-amber-800 mb-1">同じ会社名が既に登録されています</div>
                      <div className="text-sm text-amber-700">「{newForm.company}」は既存の商談ログに存在します。</div>
                    </div>

                    <div className="bg-page rounded-lg p-4">
                      <div className="text-xs text-secondary mb-2">登録内容</div>
                      <div className="text-sm">
                        {newForm.name && <span className="font-medium">{newForm.name}</span>}
                        {newForm.title && <span className="text-secondary ml-1">({newForm.title})</span>}
                        {newForm.name && <span className="text-secondary mx-1">-</span>}
                        <span>{newForm.company}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={executeNewAsExisting}
                        disabled={newSaving}
                        className="w-full btn-primary text-sm py-2.5 disabled:opacity-50"
                      >
                        {newSaving ? '登録中...' : '同じ会社として商談履歴に追加'}
                      </button>
                      <button
                        onClick={executeNewAsNew}
                        disabled={newSaving}
                        className="w-full btn-outline text-sm py-2.5 disabled:opacity-50"
                      >
                        {newSaving ? '登録中...' : '別の会社として新規登録'}
                      </button>
                      <button
                        onClick={() => setNewDuplicateFound(null)}
                        className="w-full text-sm text-secondary hover:text-primary py-1.5 transition-colors"
                      >
                        戻って編集する
                      </button>
                    </div>
                  </div>
                )}
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
                {/* Step 1: ファイル選択 */}
                {!bulkProcessing && !bulkReview && !bulkDone && (
                  <div className="space-y-4">
                    <div className="text-sm text-secondary">名刺の画像をまとめてアップロードしてください（最大100枚）</div>
                    <input ref={bulkInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleBulkFileSelect(e.target.files)} />
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => bulkInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleBulkFileSelect(e.dataTransfer.files); }}
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
                      <button onClick={startBulkProcess} disabled={bulkFiles.length === 0} className="btn-primary text-sm py-2 disabled:opacity-40">
                        {bulkFiles.length}枚を解析
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: スキャン中 */}
                {bulkProcessing && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="text-base font-medium">解析中...</div>
                      <div className="text-sm text-secondary">{bulkDoneCount + bulkErrorCount} / {bulkFiles.length}</div>
                    </div>
                    <div className="w-full bg-page rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${((bulkDoneCount + bulkErrorCount) / bulkFiles.length) * 100}%` }} />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                      {bulkFiles.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm">
                          <span className="w-5 text-center">
                            {item.status === 'done' ? '\u2713' : item.status === 'error' ? '\u2717' : item.status === 'scanning' ? '...' : ''}
                          </span>
                          <span className={`truncate flex-1 ${item.status === 'error' ? 'text-red-500' : item.status === 'done' ? 'text-green-600' : 'text-secondary'}`}>
                            {item.file.name}
                          </span>
                          {item.status === 'done' && item.result && (
                            <span className="text-xs text-secondary">{item.result.name || item.result.company || '検出済み'}</span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-xs text-red-500">{item.error}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: 確認画面 */}
                {bulkReview && !bulkRegistering && (
                  <div className="space-y-4">
                    <div className="text-base font-medium">スキャン結果の確認</div>
                    <div className="text-sm text-secondary">
                      {bulkGroups.reduce((sum, g) => sum + g.items.length, 0)}枚の名刺を検出しました。
                      {bulkGroups.some(g => g.existingCardId) ? '既存の会社と一致する名刺があります。登録方法を選択してください。' : '登録内容を確認してください。'}
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {bulkGroups.map((group, gIdx) => (
                        <div key={group.company} className="border border-border/30 rounded-lg overflow-hidden">
                          <div className="px-4 py-3 bg-[#FAFAFA] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm truncate">{group.company}</span>
                              {group.existingCardId ? (
                                <span className="badge badge-warn text-2xs flex-shrink-0">既存</span>
                              ) : (
                                <span className="badge badge-info text-2xs flex-shrink-0">新規</span>
                              )}
                            </div>
                            <span className="text-xs text-secondary flex-shrink-0">{group.items.length}名</span>
                          </div>

                          <div className="px-4 py-3">
                            {/* 担当者リスト */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {group.items.map((item, iIdx) => (
                                <span key={iIdx} className="text-xs bg-page rounded px-2 py-1">
                                  {item.result?.name || '(名前なし)'}
                                  {item.result?.title && <span className="text-secondary ml-1">({item.result.title})</span>}
                                </span>
                              ))}
                            </div>

                            {/* 既存会社の場合のみ選択肢を表示 */}
                            {group.existingCardId && (
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                  <input
                                    type="radio"
                                    name={`bulk-group-${gIdx}`}
                                    checked={group.useExisting}
                                    onChange={() => setBulkGroups(prev => prev.map((g, i) => i === gIdx ? { ...g, useExisting: true } : g))}
                                  />
                                  <span>同じ会社として商談履歴に追加</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                  <input
                                    type="radio"
                                    name={`bulk-group-${gIdx}`}
                                    checked={!group.useExisting}
                                    onChange={() => setBulkGroups(prev => prev.map((g, i) => i === gIdx ? { ...g, useExisting: false } : g))}
                                  />
                                  <span>別の会社として新規登録</span>
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {bulkErrorCount > 0 && (
                      <div className="text-xs text-secondary">
                        ※ 解析に失敗した{bulkErrorCount}件はスキップされます
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={closeBulkScanner} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
                      <button onClick={executeBulkRegistration} className="btn-primary flex-1 text-sm py-2">
                        登録する
                      </button>
                    </div>
                  </div>
                )}

                {/* 登録中 */}
                {bulkRegistering && (
                  <div className="text-center py-8">
                    <div className="text-base font-medium mb-2">登録中...</div>
                    <div className="text-sm text-secondary">しばらくお待ちください</div>
                  </div>
                )}

                {/* Step 4: 完了 */}
                {bulkDone && !bulkProcessing && !bulkReview && (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="text-4xl mb-3">&#10003;</div>
                      <div className="text-lg font-medium mb-1">処理完了</div>
                    </div>
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

      {/* 名刺画像ライトボックス */}
      {lightboxImage && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[300]" onClick={() => setLightboxImage(null)} />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-8" onClick={() => setLightboxImage(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-card rounded-full shadow-lg flex items-center justify-center text-secondary hover:text-primary transition-colors z-[302]"
              >
                &#10005;
              </button>
              <img src={lightboxImage} alt="名刺（拡大）" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            </div>
          </div>
        </>
      )}

      <ToastUI />
    </div>
  );
}
