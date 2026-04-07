/**
 * 勤怠突合ページ（一括アップロード）
 *
 * 複数ファイルをアップロード → Claude APIで解析＋社員自動マッチング → 確認テーブル → 取込
 * ステップ: 1. アップロード → 2. 確認＆取込
 *
 * タイムアウト対策: 1ファイルずつ順次送信（各~16秒）。
 * 全ファイルを1リクエストで送ると、Next.jsプロキシがタイムアウトするため。
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, getToken } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface ActiveEmployee {
  id: string;
  name: string;
  employeeCode: string;
}

interface BulkUploadResult {
  fileName: string;
  filePath: string;
  employeeName: string | null;
  matchedEmployee: { id: string; name: string; employeeCode: string } | null;
  recordCount: number;
  yearMonth: string;
  records: any[];
  summary: any;
  client: string | null;
  error: string | null;
  warning: string | null;
  // フロント側状態
  checked: boolean;
  manualEmployeeId: string;
}

type Step = 'upload' | 'parsing' | 'confirm' | 'importing';

export default function ReconciliationPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadResults, setUploadResults] = useState<BulkUploadResult[]>([]);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployee[]>([]);

  // 対象月（デフォルト: 先月）
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultYm = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const [yearMonth, setYearMonth] = useState(defaultYm);

  // ファイル追加（FileListはliveオブジェクトなので即座にArrayに変換）
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles(prev => [...prev, ...arr]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ドラッグ＆ドロップ
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // 一括アップロード＋解析（1ファイルずつ順次送信）
  const handleUpload = useCallback(async () => {
    if (!files.length) {
      toast('ファイルを選択してください');
      return;
    }

    setStep('parsing');
    setUploadResults([]);
    setParseProgress({ current: 0, total: files.length });

    const token = getToken();

    for (let i = 0; i < files.length; i++) {
      setParseProgress({ current: i + 1, total: files.length });

      const formData = new FormData();
      formData.append('files', files[i]);
      formData.append('yearMonth', yearMonth);

      try {
        const res = await fetch('/api/attendance/reconciliation/bulk-upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.error(`bulk-upload failed for file ${i}: status=${res.status}`, errBody);
          let message = '解析に失敗しました';
          try {
            const parsed = JSON.parse(errBody);
            message = parsed.message || message;
          } catch {}

          setUploadResults(prev => [...prev, {
            fileName: files[i].name,
            filePath: '',
            employeeName: null,
            matchedEmployee: null,
            recordCount: 0,
            yearMonth: '',
            records: [],
            summary: null,
            client: null,
            error: message,
            warning: null,
            checked: false,
            manualEmployeeId: '',
          }]);
          continue;
        }

        const data = await res.json();
        const result = data.results[0];
        if (result) {
          setUploadResults(prev => [...prev, {
            ...result,
            warning: result.warning || null,
            checked: !result.error,
            manualEmployeeId: result.matchedEmployee?.id || '',
          }]);
        }
      } catch (err: any) {
        console.error(`bulk-upload error for file ${i}:`, err);
        setUploadResults(prev => [...prev, {
          fileName: files[i].name,
          filePath: '',
          employeeName: null,
          matchedEmployee: null,
          recordCount: 0,
          yearMonth: '',
          records: [],
          summary: null,
          client: null,
          error: err.message || '通信エラー',
          warning: null,
          checked: false,
          manualEmployeeId: '',
        }]);
      }
    }

    setStep('confirm');
  }, [files, yearMonth, toast]);

  // confirmステップに入ったら稼働中社員一覧を取得（ユーザー選択の対象月で）
  useEffect(() => {
    if (step !== 'confirm') return;
    apiClient<ActiveEmployee[]>(`/attendance/reconciliation/active-employees?yearMonth=${yearMonth}`)
      .then(setActiveEmployees)
      .catch(() => {});
  }, [step, yearMonth]);

  // チェックボックス切り替え
  const toggleCheck = useCallback((index: number) => {
    setUploadResults(prev => prev.map((r, i) => i === index ? { ...r, checked: !r.checked } : r));
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setUploadResults(prev => prev.map(r => r.error ? r : { ...r, checked }));
  }, []);

  const updateManualEmployee = useCallback((index: number, employeeId: string) => {
    setUploadResults(prev => prev.map((r, i) => i === index ? { ...r, manualEmployeeId: employeeId } : r));
  }, []);

  // 取込実行
  const handleConfirm = useCallback(async () => {
    const selected = uploadResults.filter(r => r.checked && !r.error);
    if (!selected.length) {
      toast('取込対象を選択してください');
      return;
    }

    // 社員が選択されていない行があるかチェック
    const unselected = selected.filter(r => !r.manualEmployeeId);
    if (unselected.length > 0) {
      toast(`社員を選択してください: ${unselected.map(r => r.fileName).join(', ')}`);
      return;
    }

    setStep('importing');

    try {
      const uploads = selected.map(r => ({
        employeeId: r.manualEmployeeId,
        yearMonth: r.yearMonth,
        fileName: r.fileName,
        records: r.records,
        summary: r.summary,
        client: r.client,
      }));

      const res = await apiClient<{ results: any[] }>('/attendance/reconciliation/bulk-confirm', {
        method: 'POST',
        body: JSON.stringify({ uploads }),
      });

      const successCount = res.results.filter(r => !r.error).length;
      const errorCount = res.results.filter(r => r.error).length;

      if (errorCount > 0) {
        toast(`${successCount}件取込完了、${errorCount}件失敗`);
      } else {
        toast(`${successCount}件の現場勤怠を取込みました`);
      }

      router.push('/admin/attendance');
    } catch (err: any) {
      toast(err.message || '取込に失敗しました');
      setStep('confirm');
    }
  }, [uploadResults, toast, router]);

  const checkedCount = uploadResults.filter(r => r.checked).length;
  const allChecked = uploadResults.filter(r => !r.error).length > 0
    && uploadResults.filter(r => !r.error).every(r => r.checked);

  // プレビュー用データ
  const previewData = previewIndex !== null ? uploadResults[previewIndex] : null;

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/attendance')} className="text-secondary hover:text-primary transition-colors">
            ← 戻る
          </button>
          <h1 className="text-2xl font-medium">現場勤怠表を取込</h1>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-5">
        {[
          { key: 'upload', label: '1. アップロード' },
          { key: 'confirm', label: '2. 確認＆取込' },
        ].map((s, i) => {
          const isActive = s.key === step || (s.key === 'upload' && step === 'parsing') || (s.key === 'confirm' && step === 'importing');
          const isDone = s.key === 'upload' && (step === 'confirm' || step === 'importing');
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

      {/* Step 1: アップロード */}
      {(step === 'upload' || step === 'parsing') && (
        <div className="space-y-5">
          <div className="card p-5 space-y-5">
            <h2 className="text-lg font-medium">現場勤怠表のアップロード</h2>

            {/* 対象月 */}
            <div>
              <label className="block text-xs text-secondary mb-1">対象月</label>
              <input
                type="month"
                value={yearMonth}
                onChange={e => setYearMonth(e.target.value)}
                className="border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* ファイルドロップエリア */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => step === 'upload' && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${dragOver ? 'border-primary bg-accent' : files.length ? 'border-status-green-text bg-status-green-bg' : 'border-border hover:border-primary/50'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.gif,.webp"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ''; } }}
              />
              {files.length > 0 ? (
                <div>
                  <p className="text-base font-medium text-primary">{files.length}件のファイルが選択されています</p>
                  <p className="text-sm text-secondary mt-1">クリックして追加、またはドラッグ＆ドロップ</p>
                </div>
              ) : (
                <div>
                  <p className="text-base text-secondary">ファイルをドラッグ＆ドロップ または クリックして選択</p>
                  <p className="text-sm text-secondary/70 mt-1">Excel(.xlsx) / CSV / PDF / 画像(JPG,PNG) — 複数選択可</p>
                </div>
              )}
            </div>

            {/* 選択済みファイル一覧 */}
            {files.length > 0 && step === 'upload' && (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#FAFAFA] rounded px-3 py-2 text-sm">
                    <span>{f.name} <span className="text-secondary">({(f.size / 1024).toFixed(1)} KB)</span></span>
                    <button onClick={e => { e.stopPropagation(); removeFile(i); }} className="text-status-red-text hover:underline text-xs">削除</button>
                  </div>
                ))}
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex justify-end gap-3">
              <button onClick={() => router.push('/admin/attendance')} className="btn-outline">キャンセル</button>
              {step === 'upload' && (
                <button
                  onClick={handleUpload}
                  disabled={!files.length}
                  className="btn-primary disabled:opacity-40"
                >
                  アップロード＆解析開始
                </button>
              )}
              {step === 'parsing' && (
                <button disabled className="btn-primary opacity-60 flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  解析中... ({parseProgress.current}/{parseProgress.total})
                </button>
              )}
            </div>
          </div>

          {/* 解析中の途中結果表示 */}
          {step === 'parsing' && uploadResults.length > 0 && (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">社員名（抽出）</th>
                    <th className="text-left text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">ファイル名</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">レコード数</th>
                    <th className="text-center text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResults.map((r, i) => (
                    <tr key={i} className={`border-b border-border/20 ${r.error ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2.5 text-sm font-medium">{r.employeeName || <span className="text-secondary">—</span>}</td>
                      <td className="px-3 py-2.5 text-sm text-secondary">{r.fileName}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums">{r.recordCount}件</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.error ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">エラー</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-status-green-bg text-status-green-text">完了</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Step 2: 確認＆取込 */}
      {(step === 'confirm' || step === 'importing') && (
        <div className="space-y-4">
          <div className="card p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-center text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={e => toggleAll(e.target.checked)}
                      disabled={step === 'importing'}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="text-left text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">社員名（抽出）</th>
                  <th className="text-left text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] min-w-[160px]">社員名（実績）</th>
                  <th className="text-left text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">ファイル名</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">対象月</th>
                  <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">レコード数</th>
                  <th className="text-center text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">状態</th>
                </tr>
              </thead>
              <tbody>
                {uploadResults.map((r, i) => {
                  const isError = !!r.error;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-border/20 transition-colors ${
                        isError ? 'bg-red-50' : 'hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.checked}
                          onChange={() => toggleCheck(i)}
                          disabled={isError || step === 'importing'}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium">
                        {r.employeeName || <span className="text-secondary">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        {!isError ? (
                          <select
                            value={r.manualEmployeeId}
                            onChange={e => updateManualEmployee(i, e.target.value)}
                            disabled={step === 'importing'}
                            className={`w-full border rounded-md px-2 py-1.5 text-sm outline-none appearance-none ${
                              r.manualEmployeeId ? 'border-border bg-white' : 'border-red-300 bg-red-50'
                            }`}
                          >
                            <option value="">選択してください</option>
                            {activeEmployees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        {r.filePath && !isError ? (
                          <button
                            onClick={() => setPreviewIndex(i)}
                            className="hover:underline text-left"
                          >
                            {r.fileName}
                          </button>
                        ) : (
                          <span>{r.fileName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-center tabular-nums">{r.yearMonth || '--'}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums">{r.recordCount}件</td>
                      <td className="px-3 py-2.5 text-center">
                        {isError ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">エラー</span>
                        ) : r.warning ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title={r.warning}>注意</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-status-green-bg text-status-green-text">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* アクション */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-secondary">{checkedCount}件選択中</span>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('upload');
                  setUploadResults([]);
                }}
                className="btn-outline"
                disabled={step === 'importing'}
              >
                やり直す
              </button>
              {step === 'confirm' ? (
                <button
                  onClick={handleConfirm}
                  disabled={checkedCount === 0}
                  className="btn-primary disabled:opacity-40"
                >
                  {checkedCount}件を取込
                </button>
              ) : (
                <button disabled className="btn-primary opacity-60 flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  取込中...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ファイルプレビューモーダル */}
      {previewData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPreviewIndex(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-base font-medium">{previewData.fileName}</h3>
              <button
                onClick={() => setPreviewIndex(null)}
                className="text-secondary hover:text-primary text-xl leading-none px-2"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewData.filePath ? (
                <iframe
                  src={`/uploads/attendance/${previewData.filePath.split('/').pop()}`}
                  className="w-full h-full border-0"
                  title={previewData.fileName}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-secondary">
                  プレビューを表示できません
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
