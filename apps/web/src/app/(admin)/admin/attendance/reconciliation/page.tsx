/**
 * 勤怠突合ページ
 *
 * 現場勤怠表のアップロード → Claude API で構造化 → 自社データと自動突合 → 確定
 * ステップ形式: 1. アップロード → 2. 突合結果確認 → 3. 確定
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, getToken } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface Employee {
  id: string;
  label: string;
}

interface Client {
  id: string;
  name: string;
}

interface ReconcileResult {
  date: string;
  matchStatus: 'match' | 'mismatch' | 'client_only' | 'system_only';
  clientStart: string | null;
  clientEnd: string | null;
  clientBreak: number | null;
  clientHours: number | null;
  systemStart: string | null;
  systemEnd: string | null;
  systemBreak: number | null;
  systemHours: number | null;
  resolvedBy: string;
  resolvedStart: string | null;
  resolvedEnd: string | null;
  resolvedBreak: number | null;
  resolvedHours: number | null;
}

interface Summary {
  totalDays: number;
  matchCount: number;
  mismatchCount: number;
  clientOnlyCount: number;
  systemOnlyCount: number;
}

type Step = 'upload' | 'parsing' | 'reconciling' | 'results' | 'confirmed';

export default function ReconciliationPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 共通データ
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Step 1: アップロード
  const [step, setStep] = useState<Step>('upload');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Step 2: 結果
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [parsedInfo, setParsedInfo] = useState<{
    employeeName: string | null;
    yearMonth: string;
    client: string | null;
    records: any[];
    summary: any;
  } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<ReconcileResult[]>([]);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);

  // 過去のアップロード一覧
  const [uploads, setUploads] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 社員・クライアント一覧を取得
  useEffect(() => {
    apiClient<{ data: any[] }>('/employees?limit=100')
      .then(res => setEmployees(res.data.map((e: any) => ({ id: e.id, label: `${e.lastName} ${e.firstName}` }))))
      .catch(() => {});
    apiClient<{ data: any[] }>('/clients?limit=100')
      .then(res => setClients(res.data.map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  // 履歴取得
  const loadHistory = useCallback(async () => {
    try {
      const data = await apiClient<any[]>('/attendance/reconciliation/uploads');
      setUploads(data);
    } catch {
      setUploads([]);
    }
  }, []);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  // ファイルアップロード＋解析
  const handleUpload = useCallback(async () => {
    if (!file || !selectedEmployee || !yearMonth) {
      toast('社員・対象年月・ファイルを指定してください');
      return;
    }

    setStep('parsing');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('employeeId', selectedEmployee);
    formData.append('yearMonth', yearMonth);
    if (selectedClient) formData.append('clientId', selectedClient);

    try {
      const token = getToken();
      const res = await fetch('/api/attendance/reconciliation/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'アップロードに失敗しました' }));
        throw new Error(err.message);
      }

      const data = await res.json();
      setUploadId(data.uploadId);
      setParsedInfo(data);

      // アップロードAPIが自動で突合まで実行するようになった
      if (data.reconciliation?.summary) {
        setSummary(data.reconciliation.summary);
        setResults(data.reconciliation.results);
        toast(`解析＋突合完了（一致: ${data.reconciliation.summary.matchCount}件 / 差異: ${data.reconciliation.summary.mismatchCount}件）`);
        setStep('results');
      } else {
        // 突合データがない場合はフォールバック
        setStep('reconciling');
        const reconcileRes = await apiClient<{ summary: Summary; results: ReconcileResult[] }>(
          `/attendance/reconciliation/${data.uploadId}/reconcile`,
          { method: 'POST' },
        );
        setSummary(reconcileRes.summary);
        setResults(reconcileRes.results);
        toast(`突合完了`);
        setStep('results');
      }
    } catch (err: any) {
      toast(err.message || 'エラーが発生しました');
      setStep('upload');
    }
  }, [file, selectedEmployee, selectedClient, yearMonth, toast]);

  // 確定
  const handleConfirm = useCallback(async () => {
    if (!uploadId) return;
    if (!confirm('突合結果を確定しますか？確定データは請求書・給与計算に使用されます。')) return;

    try {
      const res = await apiClient<{ confirmedCount: number }>(
        `/attendance/reconciliation/${uploadId}/confirm`,
        { method: 'PUT' },
      );
      setConfirmedCount(res.confirmedCount);
      setStep('confirmed');
      toast(`${res.confirmedCount}件の勤怠データを確定しました`);
    } catch (err: any) {
      toast(err.message || '確定に失敗しました');
    }
  }, [uploadId, toast]);

  // 過去の結果を読み込み
  const handleLoadUpload = useCallback(async (id: string) => {
    try {
      const data = await apiClient<any>(`/attendance/reconciliation/${id}`);
      setUploadId(id);

      if (data.results?.length) {
        setSummary({
          totalDays: data.results.length,
          matchCount: data.results.filter((r: any) => r.matchStatus === 'match').length,
          mismatchCount: data.results.filter((r: any) => r.matchStatus === 'mismatch').length,
          clientOnlyCount: data.results.filter((r: any) => r.matchStatus === 'client_only').length,
          systemOnlyCount: data.results.filter((r: any) => r.matchStatus === 'system_only').length,
        });
        setResults(data.results.map((r: any) => ({
          date: new Date(r.workDate).toISOString().split('T')[0],
          matchStatus: r.matchStatus,
          clientStart: r.clientStart,
          clientEnd: r.clientEnd,
          clientBreak: r.clientBreak,
          clientHours: r.clientHours ? Number(r.clientHours) : null,
          systemStart: r.systemStart,
          systemEnd: r.systemEnd,
          systemBreak: r.systemBreak,
          systemHours: r.systemHours ? Number(r.systemHours) : null,
          resolvedBy: r.resolvedBy,
          resolvedStart: r.resolvedStart,
          resolvedEnd: r.resolvedEnd,
          resolvedBreak: r.resolvedBreak,
          resolvedHours: r.resolvedHours ? Number(r.resolvedHours) : null,
        })));
        setStep(data.status === 'confirmed' ? 'confirmed' : 'results');
      } else {
        setParsedInfo({
          employeeName: data.employee ? `${data.employee.lastName} ${data.employee.firstName}` : null,
          yearMonth: data.yearMonth,
          client: data.client?.name || null,
          records: data.records || [],
          summary: null,
        });
        setStep('results');
      }
      setShowHistory(false);
    } catch {
      toast('データの読み込みに失敗しました');
    }
  }, [toast]);

  // ドラッグ＆ドロップ
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  }, []);

  const statusLabel = (status: string) => {
    switch (status) {
      case 'match': return { text: '一致', cls: 'bg-status-green-bg text-status-green-text' };
      case 'mismatch': return { text: '差異あり', cls: 'bg-status-red-bg text-status-red-text' };
      case 'client_only': return { text: '現場のみ', cls: 'bg-status-amber-bg text-status-amber-text' };
      case 'system_only': return { text: '自社のみ', cls: 'bg-status-blue-bg text-status-blue-text' };
      default: return { text: status, cls: 'bg-border-light text-secondary' };
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  };

  const uploadStatusLabel = (status: string) => {
    switch (status) {
      case 'uploaded': return { text: 'アップロード済', cls: 'badge-wait' };
      case 'parsed': return { text: '解析済', cls: 'badge-warn' };
      case 'reconciled': return { text: '突合済', cls: 'badge-ok' };
      case 'confirmed': return { text: '確定済', cls: 'badge-ok' };
      case 'error': return { text: 'エラー', cls: 'badge-danger' };
      default: return { text: status, cls: 'badge-wait' };
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/attendance')} className="text-secondary hover:text-primary transition-colors">
            ← 戻る
          </button>
          <h1 className="text-2xl font-medium">勤怠突合</h1>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="btn-outline text-sm py-1.5">
          {showHistory ? '新規取込' : '取込履歴'}
        </button>
      </div>

      {/* 取込履歴 */}
      {showHistory && (
        <div className="card p-0 mb-5">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-base font-medium">取込履歴</h2>
          </div>
          {uploads.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-secondary">履歴はありません</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">日時</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">社員</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">クライアント</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">対象月</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">ファイル</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">ステータス</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]"></th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u: any) => {
                  const st = uploadStatusLabel(u.status);
                  return (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-[#FAFAF8] transition-colors">
                      <td className="px-4 py-2 text-sm">{new Date(u.createdAt).toLocaleString('ja-JP')}</td>
                      <td className="px-4 py-2 text-sm">{u.employee ? `${u.employee.lastName} ${u.employee.firstName}` : '--'}</td>
                      <td className="px-4 py-2 text-sm">{u.client?.name || '--'}</td>
                      <td className="px-4 py-2 text-sm">{u.yearMonth}</td>
                      <td className="px-4 py-2 text-sm">{u.fileName || '--'}</td>
                      <td className="px-4 py-2"><span className={`badge ${st.cls}`}>{st.text}</span></td>
                      <td className="px-4 py-2">
                        <button onClick={() => handleLoadUpload(u.id)} className="text-sm text-accent hover:underline">表示</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ステップインジケーター */}
      {!showHistory && (
        <div className="flex items-center gap-2 mb-5">
          {[
            { key: 'upload', label: '1. アップロード' },
            { key: 'results', label: '2. 突合結果' },
            { key: 'confirmed', label: '3. 確定' },
          ].map((s, i) => {
            const isActive = s.key === step || (s.key === 'upload' && (step === 'parsing' || step === 'reconciling'));
            const isDone = (s.key === 'upload' && (step === 'results' || step === 'confirmed'))
                        || (s.key === 'results' && step === 'confirmed');
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${isDone ? 'bg-status-green-text' : 'bg-border'}`} />}
                <div className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full ${
                  isActive ? 'bg-primary text-white' : isDone ? 'bg-status-green-bg text-status-green-text' : 'bg-border-light text-secondary'
                }`}>
                  {isDone && <span>✓</span>}
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step 1: アップロード */}
      {!showHistory && (step === 'upload' || step === 'parsing' || step === 'reconciling') && (
        <div className="card p-5 space-y-5">
          <h2 className="text-lg font-medium">現場勤怠表のアップロード</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-secondary mb-1">対象社員 *</label>
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="input w-full"
                disabled={step !== 'upload'}
              >
                <option value="">選択してください</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-secondary mb-1">クライアント</label>
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="input w-full"
                disabled={step !== 'upload'}
              >
                <option value="">（なし）</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-secondary mb-1">対象年月 *</label>
              <input
                type="month"
                value={yearMonth}
                onChange={e => setYearMonth(e.target.value)}
                className="input w-full"
                disabled={step !== 'upload'}
              />
            </div>
          </div>

          {/* ファイルドロップエリア */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => step === 'upload' && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-primary bg-accent' : file ? 'border-status-green-text bg-status-green-bg' : 'border-border hover:border-primary/50'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
            />
            {file ? (
              <div>
                <p className="text-base font-medium text-primary">{file.name}</p>
                <p className="text-sm text-secondary mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                {step === 'upload' && (
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="text-sm text-status-red-text mt-2 hover:underline"
                  >
                    削除
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-base text-secondary">ファイルをドラッグ＆ドロップ または クリックして選択</p>
                <p className="text-sm text-secondary/70 mt-1">Excel(.xlsx) / CSV / PDF / 画像(JPG,PNG)</p>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          <div className="flex justify-end gap-3">
            <button onClick={() => router.push('/admin/attendance')} className="btn-outline">キャンセル</button>
            {step === 'upload' && (
              <button
                onClick={handleUpload}
                disabled={!file || !selectedEmployee || !yearMonth}
                className="btn-primary disabled:opacity-40"
              >
                アップロード＆突合開始
              </button>
            )}
            {(step === 'parsing' || step === 'reconciling') && (
              <button disabled className="btn-primary opacity-60 flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {step === 'parsing' ? '解析中...' : '突合中...'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 2: 突合結果 */}
      {!showHistory && step === 'results' && summary && (
        <div className="space-y-4">
          {/* サマリーカード */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="card p-4 text-center">
              <div className="text-xs text-secondary">対象日数</div>
              <div className="text-2xl font-medium mt-1">{summary.totalDays}<span className="text-sm font-normal text-secondary ml-1">日</span></div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs text-secondary">一致</div>
              <div className="text-2xl font-medium text-status-green-text mt-1">{summary.matchCount}<span className="text-sm font-normal ml-1">日</span></div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs text-secondary">差異あり</div>
              <div className="text-2xl font-medium text-status-red-text mt-1">{summary.mismatchCount}<span className="text-sm font-normal ml-1">日</span></div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs text-secondary">現場のみ</div>
              <div className="text-2xl font-medium text-status-amber-text mt-1">{summary.clientOnlyCount}<span className="text-sm font-normal ml-1">日</span></div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs text-secondary">自社のみ</div>
              <div className="text-2xl font-medium text-status-blue-text mt-1">{summary.systemOnlyCount}<span className="text-sm font-normal ml-1">日</span></div>
            </div>
          </div>

          {/* 一致率プログレス */}
          {summary.totalDays > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-secondary">一致率</span>
                <span className="text-lg font-medium">{Math.round(summary.matchCount / summary.totalDays * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-border-light rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-green-text rounded-full transition-all"
                  style={{ width: `${Math.round(summary.matchCount / summary.totalDays * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* 突合結果テーブル */}
          <div className="card p-0 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA]">日付</th>
                  <th className="text-left text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA]">ステータス</th>
                  <th colSpan={3} className="text-center text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA] border-l border-border/30">現場データ</th>
                  <th colSpan={3} className="text-center text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA] border-l border-border/30">自社データ</th>
                  <th className="text-left text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA] border-l border-border/30">採用</th>
                  <th colSpan={2} className="text-center text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA] border-l border-border/30">確定値</th>
                </tr>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA]"></th>
                  <th className="text-left text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA]"></th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA] border-l border-border/30">出勤</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA]">退勤</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA]">時間</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA] border-l border-border/30">出勤</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA]">退勤</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA]">時間</th>
                  <th className="text-left text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA] border-l border-border/30"></th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA] border-l border-border/30">出退勤</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-1 bg-[#FAFAFA]">時間</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const st = statusLabel(r.matchStatus);
                  const isMismatch = r.matchStatus === 'mismatch';
                  return (
                    <tr key={r.date} className={`border-b border-border/20 transition-colors ${isMismatch ? 'bg-status-red-bg/30' : 'hover:bg-[#FAFAF8]'}`}>
                      <td className="px-3 py-2 text-sm font-medium">{formatDate(r.date)}</td>
                      <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span></td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums border-l border-border/30">{r.clientStart || '--'}</td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums">{r.clientEnd || '--'}</td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums">{r.clientHours != null ? `${r.clientHours}h` : '--'}</td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums border-l border-border/30">{r.systemStart || '--'}</td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums">{r.systemEnd || '--'}</td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums">{r.systemHours != null ? `${r.systemHours}h` : '--'}</td>
                      <td className="px-3 py-2 text-xs border-l border-border/30">
                        <span className={`px-1.5 py-0.5 rounded ${
                          r.resolvedBy === 'client' ? 'bg-accent text-accent-text' :
                          r.resolvedBy === 'system' ? 'bg-status-blue-bg text-status-blue-text' :
                          'bg-status-amber-bg text-status-amber-text'
                        }`}>
                          {r.resolvedBy === 'client' ? '現場' : r.resolvedBy === 'system' ? '自社' : '手動'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums border-l border-border/30">
                        {r.resolvedStart || '--'} ~ {r.resolvedEnd || '--'}
                      </td>
                      <td className="px-3 py-2 text-sm text-center tabular-nums font-medium">
                        {r.resolvedHours != null ? `${r.resolvedHours}h` : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* アクション */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setStep('upload');
                setResults([]);
                setSummary(null);
                setUploadId(null);
                setFile(null);
              }}
              className="btn-outline"
            >
              やり直す
            </button>
            <button onClick={handleConfirm} className="btn-primary">
              確定する
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 確定完了 */}
      {!showHistory && step === 'confirmed' && (
        <div className="card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-status-green-bg flex items-center justify-center mx-auto">
            <span className="text-3xl text-status-green-text">✓</span>
          </div>
          <h2 className="text-xl font-medium">勤怠データを確定しました</h2>
          {confirmedCount != null && (
            <p className="text-secondary">{confirmedCount}件のデータが確定勤怠テーブルに反映されました。</p>
          )}
          <p className="text-sm text-secondary">確定データは請求書・給与計算に使用されます。</p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => {
                setStep('upload');
                setResults([]);
                setSummary(null);
                setUploadId(null);
                setFile(null);
                setConfirmedCount(null);
              }}
              className="btn-outline"
            >
              別の勤怠表を取込む
            </button>
            <button onClick={() => router.push('/admin/attendance')} className="btn-primary">
              勤怠管理に戻る
            </button>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
