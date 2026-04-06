/**
 * 管理側 商談ログ
 *
 * 名刺管理を軸に商談記録。名刺スキャナー（カメラ撮影→OCR→フォーム自動入力）付き。
 * KPI行、フィルター、テーブル、詳細スライドオーバー、名刺スキャナーモーダル。
 */

'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/ui/toast';

/* ---------- types ---------- */

interface DealLog {
  date: string;
  type: '訪問' | '電話' | 'メール' | 'Web会議' | 'その他';
  body: string;
  recorder: string;
}

interface Card {
  id: string;
  name: string;
  company: string;
  dept: string;
  title: string;
  tag: 'エンド企業' | 'SIer' | 'エージェント' | 'パートナー';
  status: '商談中' | '提案済' | '成約' | 'フォロー中' | '休止';
  lastDeal: string;
  owner: string;
  dealCount: number;
  email: string;
  phone: string;
  address: string;
  note: string;
  logs: DealLog[];
}

/* ---------- data (empty) ---------- */

const demoCards: Card[] = [];

/* ---------- badge helpers ---------- */

const tagBadge: Record<Card['tag'], string> = {
  'エンド企業': 'badge-info',
  'SIer': 'badge-ok',
  'エージェント': 'badge-warn',
  'パートナー': 'badge-wait',
};

const statusBadge: Record<Card['status'], string> = {
  '商談中': 'badge-info',
  '提案済': 'badge-wait',
  '成約': 'badge-ok',
  'フォロー中': 'badge-warn',
  '休止': 'badge-danger',
};

const logTypeBadge: Record<DealLog['type'], string> = {
  '訪問': 'badge-info',
  '電話': 'badge-ok',
  'メール': 'badge-wait',
  'Web会議': 'badge-warn',
  'その他': 'badge-danger',
};

/* ---------- scanner step type ---------- */
type ScannerStep = 'upload' | 'analyzing' | 'result';

/* ---------- component ---------- */

export default function AdminDealsPage() {
  const { toast, ToastUI } = useToast();

  /* filters */
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('すべて');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [ownerFilter, setOwnerFilter] = useState('すべて');

  /* detail panel */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? demoCards.find(c => c.id === selectedId) ?? null : null;

  /* edit modal */
  const [editModalOpen, setEditModalOpen] = useState(false);

  /* scanner modal */
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStep, setScannerStep] = useState<ScannerStep>('upload');

  /* filtered data */
  const filtered = useMemo(() => {
    return demoCards.filter(c => {
      if (search && !c.name.includes(search) && !c.company.includes(search)) return false;
      if (tagFilter !== 'すべて' && c.tag !== tagFilter) return false;
      if (statusFilter !== 'すべて' && c.status !== statusFilter) return false;
      if (ownerFilter !== 'すべて' && c.owner !== ownerFilter) return false;
      return true;
    });
  }, [search, tagFilter, statusFilter, ownerFilter]);

  const activeFilterCount = [tagFilter !== 'すべて', statusFilter !== 'すべて', ownerFilter !== 'すべて', search !== ''].filter(Boolean).length;

  /* KPI (all 0 with empty data) */
  const kpiRegistered = demoCards.length;
  const kpiThisMonth = 0;
  const kpiFollowUp = 0;
  const kpiRegistrants = 0;

  /* scanner handlers */
  const openScanner = () => { setScannerStep('upload'); setScannerOpen(true); };
  const closeScanner = () => setScannerOpen(false);
  const startAnalyze = () => {
    setScannerStep('analyzing');
    setTimeout(() => setScannerStep('result'), 2000);
  };

  return (
    <div>
      {/* ===== Header ===== */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">商談ログ</h1>
        <button onClick={openScanner} className="btn-primary text-sm py-2">名刺を登録</button>
      </div>

      {/* ===== KPI Row ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">登録名刺数</div>
          <div className="text-3xl font-medium">{kpiRegistered}<span className="text-base font-normal ml-1">枚</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">今月の商談</div>
          <div className="text-3xl font-medium">{kpiThisMonth}<span className="text-base font-normal ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">フォロー予定</div>
          <div className="text-3xl font-medium text-status-amber-text">{kpiFollowUp}<span className="text-base font-normal ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">名刺登録者</div>
          <div className="text-3xl font-medium">{kpiRegistrants}<span className="text-base font-normal ml-1">名</span></div>
        </div>
      </div>

      {/* ===== Filters ===== */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="氏名・会社名で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[180px] focus:border-primary"
        />
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none min-w-[120px]">
          <option>すべて</option>
          <option>エンド企業</option>
          <option>SIer</option>
          <option>エージェント</option>
          <option>パートナー</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none min-w-[120px]">
          <option>すべて</option>
          <option>商談中</option>
          <option>提案済</option>
          <option>成約</option>
          <option>フォロー中</option>
          <option>休止</option>
        </select>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none min-w-[120px]">
          <option>すべて</option>
        </select>
        {activeFilterCount > 0 && (
          <span className="text-xs text-secondary">フィルター: {activeFilterCount}件適用中</span>
        )}
      </div>

      {/* ===== Table ===== */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              {['氏名', '会社名/部署', '役職', 'タグ', '状態', '直近の商談', '担当', '商談数', 'アクション'].map(h => (
                <th key={h} className={`text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]${h === '商談数' ? ' text-right' : ''}${h === 'アクション' ? ' text-center' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors" onClick={() => setSelectedId(c.id)}>
                <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-base">
                  <div>{c.company}</div>
                  <div className="text-xs text-secondary">{c.dept}</div>
                </td>
                <td className="px-4 py-2.5 text-base text-secondary">{c.title}</td>
                <td className="px-4 py-2.5"><span className={`badge ${tagBadge[c.tag]}`}>{c.tag}</span></td>
                <td className="px-4 py-2.5"><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                <td className="px-4 py-2.5 text-base text-secondary">{c.lastDeal}</td>
                <td className="px-4 py-2.5 text-base">{c.owner}</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{c.dealCount}</td>
                <td className="px-4 py-2.5 text-center">
                  <button onClick={e => { e.stopPropagation(); setSelectedId(c.id); }} className="btn-outline text-xs py-1 px-3">詳細</button>
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
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-card border-l border-border z-[100] overflow-y-auto">
            {/* header */}
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary mt-0.5">{selected.company} / {selected.dept}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
            </div>

            <div className="p-5 space-y-6">
              {/* 名刺情報 section */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">名刺情報</div>
                {([
                  ['氏名', selected.name],
                  ['会社名', selected.company],
                  ['部署', selected.dept],
                  ['役職', selected.title],
                  ['メール', selected.email],
                  ['電話', selected.phone],
                  ['住所', selected.address],
                  ['タグ', selected.tag],
                  ['状態', selected.status],
                  ['担当', selected.owner],
                  ['備考', selected.note],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary text-sm">{label}</span>
                    <span className="text-sm">{value}</span>
                  </div>
                ))}
              </div>

              {/* 商談履歴 section */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">商談履歴</div>
                {selected.logs.length === 0 ? (
                  <div className="text-sm text-secondary py-3">商談履歴はありません</div>
                ) : (
                  <div className="space-y-3">
                    {selected.logs.map((log, idx) => (
                      <div key={idx} className="bg-page rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-secondary">{log.date}</span>
                          <span className={`badge ${logTypeBadge[log.type]}`}>{log.type}</span>
                        </div>
                        <div className="text-sm">{log.body}</div>
                        <div className="text-xs text-secondary mt-1">記録: {log.recorder}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* action buttons */}
              <div className="flex gap-2">
                <button onClick={() => setEditModalOpen(true)} className="btn-outline flex-1 text-sm py-2">編集</button>
                <button onClick={() => toast('商談記録を保存しました')} className="btn-primary flex-1 text-sm py-2">商談を記録</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Card Scanner Modal ===== */}
      {scannerOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[199]" onClick={closeScanner} />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
              {/* modal header */}
              <div className="flex justify-between items-center p-5 border-b border-border/30">
                <h3 className="text-lg font-medium">名刺スキャナー</h3>
                <button onClick={closeScanner} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
              </div>

              <div className="p-5">
                {/* Step 1: Upload / Camera */}
                {scannerStep === 'upload' && (
                  <div className="space-y-4">
                    <div className="text-sm text-secondary mb-2">名刺の写真を撮影またはアップロードしてください</div>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <div className="text-4xl text-secondary mb-3">&#128247;</div>
                      <div className="text-sm text-secondary mb-4">ドラッグ&ドロップ または クリックして選択</div>
                      <div className="flex gap-2 justify-center">
                        <button onClick={startAnalyze} className="btn-outline text-sm py-2">カメラで撮影</button>
                        <button onClick={startAnalyze} className="btn-primary text-sm py-2">ファイルを選択</button>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-secondary">
                      <span>ステップ 1 / 3</span>
                      <span>撮影・アップロード</span>
                    </div>
                  </div>
                )}

                {/* Step 2: Analyzing */}
                {scannerStep === 'analyzing' && (
                  <div className="space-y-4 py-8 text-center">
                    <div className="text-4xl mb-3 animate-pulse">&#128270;</div>
                    <div className="text-base font-medium">名刺を解析中...</div>
                    <div className="text-sm text-secondary">OCR処理を実行しています</div>
                    <div className="w-full bg-page rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                    <div className="flex justify-between text-xs text-secondary">
                      <span>ステップ 2 / 3</span>
                      <span>解析中</span>
                    </div>
                  </div>
                )}

                {/* Step 3: OCR Results Form */}
                {scannerStep === 'result' && (
                  <div className="space-y-4">
                    <div className="text-sm text-secondary mb-2">解析結果を確認・修正してください</div>
                    {([
                      ['氏名', ''],
                      ['会社名', ''],
                      ['部署', ''],
                      ['役職', ''],
                      ['メールアドレス', ''],
                      ['電話番号', ''],
                      ['住所', ''],
                    ] as [string, string][]).map(([label, defaultVal]) => (
                      <div key={label}>
                        <label className="block text-xs text-secondary mb-1">{label}</label>
                        <input
                          type="text"
                          defaultValue={defaultVal}
                          className="w-full border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card focus:border-primary"
                          placeholder={label}
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs text-secondary mb-1">タグ</label>
                      <select className="w-full border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
                        <option>エンド企業</option>
                        <option>SIer</option>
                        <option>エージェント</option>
                        <option>パートナー</option>
                      </select>
                    </div>
                    <div className="flex justify-between text-xs text-secondary">
                      <span>ステップ 3 / 3</span>
                      <span>結果確認</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setScannerStep('upload')} className="btn-outline flex-1 text-sm py-2">やり直す</button>
                      <button onClick={() => { toast('名刺の写真をアップロードしてください'); closeScanner(); }} className="btn-primary flex-1 text-sm py-2">登録する</button>
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
                      className="w-full border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card focus:border-primary"
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
