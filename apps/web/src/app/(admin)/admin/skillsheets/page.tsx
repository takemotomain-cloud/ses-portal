/**
 * 管理側 スキルシート一覧
 *
 * SES事業部の社員を自動表示。管理部は除外。
 * スキルシート未作成の社員は「未作成」バッジ。
 * 行クリックで編集画面に遷移。
 * 「サマリ」ボタンで要約ポップアップ（コピー・編集可能）。
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface SkillsheetEntry {
  id: string;
  employeeCode: string;
  name: string;
  nameKana: string;
  departmentName: string;
  positionName: string | null;
  education: string;
  schoolName: string;
  gender: string;
  station: string;
  qualifications: string[];
  birthDate: string;
  hasSkillsheet: boolean;
  skillsheet: {
    experience: string | null;
    selfPr: string | null;
    skills: any;
    projects: any;
    summaryAffiliation: string | null;
    summaryMonth: string | null;
    summaryRate: string | null;
    updatedAt: string;
  } | null;
}

/* ---------- helpers ---------- */

function calcAge(birthDate: string): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age}歳`;
}

/** カナ→ローマ字マップ */
const KANA_MAP: Record<string, string> = {
  'ア':'A','イ':'I','ウ':'U','エ':'E','オ':'O',
  'カ':'KA','キ':'KI','ク':'KU','ケ':'KE','コ':'KO',
  'サ':'SA','シ':'SI','ス':'SU','セ':'SE','ソ':'SO',
  'タ':'TA','チ':'TI','ツ':'TU','テ':'TE','ト':'TO',
  'ナ':'NA','ニ':'NI','ヌ':'NU','ネ':'NE','ノ':'NO',
  'ハ':'HA','ヒ':'HI','フ':'HU','ヘ':'HE','ホ':'HO',
  'マ':'MA','ミ':'MI','ム':'MU','メ':'ME','モ':'MO',
  'ヤ':'YA','ユ':'YU','ヨ':'YO',
  'ラ':'RA','リ':'RI','ル':'RU','レ':'RE','ロ':'RO',
  'ワ':'WA','ヲ':'WO','ン':'N',
  'ガ':'GA','ギ':'GI','グ':'GU','ゲ':'GE','ゴ':'GO',
  'ザ':'ZA','ジ':'ZI','ズ':'ZU','ゼ':'ZE','ゾ':'ZO',
  'ダ':'DA','ヂ':'DI','ヅ':'DU','デ':'DE','ド':'DO',
  'バ':'BA','ビ':'BI','ブ':'BU','ベ':'BE','ボ':'BO',
  'パ':'PA','ピ':'PI','プ':'PU','ペ':'PE','ポ':'PO',
};

function kanaToRomajiInitial(kana: string): string {
  if (!kana) return '';
  const first = kana.charAt(0);
  const romaji = KANA_MAP[first];
  return romaji ? romaji.charAt(0) : first;
}

/** 名前からイニシャル生成（カナがあればローマ字、なければ漢字の頭文字） */
function toInitial(nameKana: string): string {
  const parts = nameKana.trim().split(/\s+/);
  if (parts.length < 2) return '';
  const lastInitial = kanaToRomajiInitial(parts[0]);
  const firstInitial = kanaToRomajiInitial(parts[1]);
  if (!lastInitial || !firstInitial) return '';
  return `${firstInitial}.${lastInitial}.`;
}

function calcProjectCount(projects: any): number {
  return Array.isArray(projects) ? projects.length : 0;
}

/** 全案件の技術スタックを集約 */
function aggregateTech(projects: any[]) {
  const collect = (key: string): string[] => {
    const set = new Set<string>();
    for (const p of projects) {
      const arr = p[key];
      if (Array.isArray(arr)) arr.forEach((v: string) => set.add(v));
    }
    return Array.from(set);
  };
  return {
    languages: collect('languages'),
    fw: collect('fw'),
    db: collect('db'),
    sqlTool: collect('sqlTool'),
    infra: collect('infra'),
    container: collect('container'),
    ticketMgmt: collect('ticketMgmt'),
    vcs: collect('vcs'),
    communication: collect('communication'),
    otherTools: collect('otherTools'),
  };
}

/** サマリテキスト生成 */
function buildSummaryText(s: SummaryData): string {
  const lines: string[] = [];
  lines.push('【基本情報】');
  lines.push(`・氏名：${s.initial}`);
  lines.push(`・年齢：${s.age}`);
  lines.push(`・性別：${s.gender}`);
  lines.push('');
  lines.push('【所属】');
  lines.push(`・${s.affiliation}`);
  lines.push('');
  lines.push('【最寄り】');
  lines.push(`・${s.station}`);
  lines.push('');
  lines.push('【対応スキル】');
  lines.push(s.techSkills);
  lines.push('');
  lines.push('【その他ツール】');
  lines.push(s.otherToolsText);
  lines.push('');
  lines.push('【稼働開始】');
  lines.push(`・${s.availableMonth}`);
  lines.push('');
  lines.push('【希望条件】');
  const rateFormatted = s.desiredRate ? Number(s.desiredRate.replace(/,/g, '')).toLocaleString() : '--';
  lines.push(`・単価：${rateFormatted}`);
  lines.push('');
  lines.push('【人物・強み】');
  lines.push(s.personality);
  return lines.join('\n');
}

interface SummaryData {
  initial: string;
  age: string;
  gender: string;
  affiliation: string;
  station: string;
  techSkills: string;
  otherToolsText: string;
  availableMonth: string;
  desiredRate: string;
  personality: string;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

/* ---------- SummaryModal ---------- */

function SummaryModal({ entry, onClose }: { entry: SkillsheetEntry; onClose: () => void }) {
  const { toast, ToastUI } = useToast();

  const projects = Array.isArray(entry.skillsheet?.projects) ? entry.skillsheet!.projects : [];
  const tech = useMemo(() => aggregateTech(projects), [projects]);

  // Auto-generated from skillsheet (read-only)
  const initial = toInitial(entry.nameKana || '');
  const age = calcAge(entry.birthDate);
  const genderMap: Record<string, string> = { male: '男性', female: '女性', other: 'その他' };
  const gender = genderMap[entry.gender] || entry.gender || '--';
  const station = entry.station || '--';
  const personality = entry.skillsheet?.selfPr || '--';

  const techParts: string[] = [];
  if (tech.languages.length) techParts.push(tech.languages.join(', '));
  if (tech.fw.length) techParts.push(tech.fw.join(', '));
  if (tech.db.length) techParts.push(tech.db.join(', '));
  if (tech.sqlTool.length) techParts.push(tech.sqlTool.join(', '));
  if (tech.infra.length) techParts.push(tech.infra.join(', '));
  if (tech.container.length) techParts.push(tech.container.join(', '));
  const techSkills = techParts.join(', ') || '--';

  const otherParts: string[] = [];
  if (tech.ticketMgmt.length) otherParts.push(tech.ticketMgmt.join(', '));
  if (tech.vcs.length) otherParts.push(tech.vcs.join(', '));
  if (tech.communication.length) otherParts.push(tech.communication.join(', '));
  const otherToolsText = otherParts.join(', ') || '--';

  // Editable fields — loaded from saved data
  const [editing, setEditing] = useState(false);
  const [affiliation, setAffiliation] = useState(entry.skillsheet?.summaryAffiliation || '自社正社員');
  const [availableMonth, setAvailableMonth] = useState(entry.skillsheet?.summaryMonth || '');
  const [desiredRate, setDesiredRate] = useState(entry.skillsheet?.summaryRate || '');
  const [saving, setSaving] = useState(false);

  const handleCopy = () => {
    const summary: SummaryData = {
      initial, age, gender, affiliation, station,
      techSkills, otherToolsText, availableMonth, desiredRate, personality,
    };
    const text = buildSummaryText(summary);
    navigator.clipboard.writeText(text).then(() => {
      toast('コピーしました');
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient(`/skillsheets/${entry.id}/summary`, {
        method: 'PATCH',
        body: JSON.stringify({
          summaryAffiliation: affiliation,
          summaryMonth: availableMonth,
          summaryRate: desiredRate,
        }),
      });
      toast('保存しました');
      setEditing(false);
    } catch (err: any) {
      toast(err?.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const valCls = 'text-sm';
  const labelCls = 'text-xs text-secondary min-w-[90px] shrink-0';
  const selectCls = 'border border-border/30 rounded px-2 py-1 text-sm outline-none bg-white focus:border-primary/40';
  const inputEditCls = 'border border-border/30 rounded px-2 py-1 text-sm outline-none focus:border-primary/40';

  const AFFILIATION_OPTIONS = ['自社正社員', '自社フリーランス', '1社先協力会社所属'];

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[199]" onClick={onClose} />
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center p-5 border-b border-border/30">
            <h3 className="text-lg font-medium">サマリ</h3>
            <div className="flex gap-2 items-center">
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="btn-outline text-xs py-1.5 px-3">キャンセル</button>
                  <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="btn-outline text-xs py-1.5 px-3">編集</button>
                  <button onClick={handleCopy} className="btn-primary text-xs py-1.5 px-3">コピー</button>
                </>
              )}
              <button onClick={onClose} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">&#10005;</button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* 基本情報 */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【基本情報】</div>
              <div className="space-y-1.5 pl-2">
                <div className="flex items-center gap-2">
                  <span className={labelCls}>氏名</span>
                  <span className={valCls}>{initial}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={labelCls}>年齢</span>
                  <span className={valCls}>{age}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={labelCls}>性別</span>
                  <span className={valCls}>{gender}</span>
                </div>
              </div>
            </div>

            {/* 所属 */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【所属】</div>
              <div className="pl-2">
                {editing ? (
                  <select className={selectCls} value={affiliation} onChange={e => setAffiliation(e.target.value)}>
                    {AFFILIATION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                ) : (
                  <span className={valCls}>{affiliation}</span>
                )}
              </div>
            </div>

            {/* 最寄り */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【最寄り】</div>
              <div className="pl-2"><span className={valCls}>{station}</span></div>
            </div>

            {/* 対応スキル */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【対応スキル】</div>
              <div className="pl-2"><p className="text-sm whitespace-pre-wrap">{techSkills}</p></div>
            </div>

            {/* その他ツール */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【その他ツール】</div>
              <div className="pl-2"><p className="text-sm whitespace-pre-wrap">{otherToolsText}</p></div>
            </div>

            {/* 稼働開始 */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【稼働開始】</div>
              <div className="pl-2">
                {editing ? (
                  <select className={selectCls} value={availableMonth} onChange={e => setAvailableMonth(e.target.value)}>
                    <option value="">選択してください</option>
                    {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <span className={valCls}>{availableMonth || '--'}</span>
                )}
              </div>
            </div>

            {/* 希望条件 */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【希望条件】</div>
              <div className="pl-2 flex items-center gap-1">
                <span className="text-sm">単価：</span>
                {editing ? (
                  <input type="text" className={`${inputEditCls} w-[140px]`} placeholder="例: 550,000" value={desiredRate} onChange={e => setDesiredRate(e.target.value)} />
                ) : (
                  <span className={valCls}>{desiredRate ? Number(desiredRate.replace(/,/g, '')).toLocaleString() : '--'}</span>
                )}
              </div>
            </div>

            {/* 人物・強み */}
            <div>
              <div className="text-sm font-medium mb-2 text-[#2c3e6b]">【人物・強み】</div>
              <div className="pl-2"><p className="text-sm whitespace-pre-wrap">{personality}</p></div>
            </div>
          </div>
        </div>
      </div>
      <ToastUI />
    </>
  );
}

/* ---------- Main ---------- */

export default function AdminSkillsheetsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<SkillsheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [summaryTarget, setSummaryTarget] = useState<SkillsheetEntry | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiClient<SkillsheetEntry[]>('/skillsheets');
      setEntries(data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = entries.filter(e =>
    !search || e.name.includes(search) || e.employeeCode.includes(search)
  );

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">スキルシート</h1>

      <div className="flex gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="氏名・社員番号で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[200px] focus:border-primary"
        />
        <span className="text-sm text-secondary">{filtered.length}名</span>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              {['氏名', '最終学歴', '経験年数', '案件数', '最終更新', 'ステータス', ''].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map(e => {
              const projectCount = e.skillsheet ? calcProjectCount(e.skillsheet.projects) : 0;
              const eduDisplay = [e.education, e.schoolName].filter(Boolean).join(' / ') || '--';

              return (
                <tr
                  key={e.id}
                  className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors"
                  onClick={() => router.push(`/admin/skillsheets/edit?id=${e.id}`)}
                >
                  <td className="px-4 py-2.5 text-base font-medium">{e.name}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{eduDisplay}</td>
                  <td className="px-4 py-2.5 text-base">{e.skillsheet?.experience || '--'}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{projectCount > 0 ? `${projectCount}件` : '--'}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">
                    {e.skillsheet?.updatedAt ? (() => { const d = new Date(e.skillsheet!.updatedAt); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; })() : '--'}
                  </td>
                  <td className="px-4 py-2.5">
                    {e.hasSkillsheet ? (
                      <span className="badge badge-ok">作成済</span>
                    ) : (
                      <span className="badge badge-wait">未作成</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={ev => { ev.stopPropagation(); setSummaryTarget(e); }}
                      className="btn-outline text-xs py-1 px-3"
                    >
                      サマリ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* サマリポップアップ */}
      {summaryTarget && (
        <SummaryModal entry={summaryTarget} onClose={() => setSummaryTarget(null)} />
      )}
    </div>
  );
}
