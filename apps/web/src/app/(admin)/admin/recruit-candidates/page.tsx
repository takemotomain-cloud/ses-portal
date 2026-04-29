'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

type Candidate = {
  id: string;
  name: string;
  kana: string;
  applyDate: string;
  status: string;
  position: string;
  source: string;
  sourceName: string;
  firstInterview: string;
  firstInterviewer: string;
  firstConfirm: string;
  finalInterview: string;
  age: string;
  gender: string;
  address: string;
  education: string;
  phone: string;
  desiredLocation: string;
  desiredMonth: string;
  history: { status: string; date: string; memo: string }[];
};

type ApiCandidate = {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  phone: string | null;
  gender: string | null;
  residence: string | null;
  birthDate: string | null;
  education: string | null;
  applicationDate: string;
  source: string;
  jobPosting: string | null;
  interviewDate: string | null;
  interviewTime: string | null;
  interviewer: string | null;
  confirmStatus: string | null;
  desiredLocation: string | null;
  desiredMonth: string | null;
  status: string;
  createdAt: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age}歳`;
}

function mapStatusLabel(status: string): string {
  if (status === 'new') return '書類選考';
  return status;
}

function mapCandidate(c: ApiCandidate): Candidate {
  const interviewParts: string[] = [];
  if (c.interviewDate) interviewParts.push(formatDate(c.interviewDate));
  if (c.interviewTime) interviewParts.push(c.interviewTime);

  return {
    id: c.id,
    name: `${c.lastName} ${c.firstName}`,
    kana: `${c.lastNameKana || ''} ${c.firstNameKana || ''}`.trim(),
    applyDate: formatDate(c.applicationDate),
    status: mapStatusLabel(c.status),
    position: c.jobPosting || '',
    source: c.source,
    sourceName: c.source,
    firstInterview: interviewParts.join(' '),
    firstInterviewer: c.interviewer || '',
    firstConfirm: c.confirmStatus || '',
    finalInterview: '',
    age: calcAge(c.birthDate),
    gender: c.gender || '',
    address: c.residence || '',
    education: c.education || '',
    phone: c.phone || '',
    desiredLocation: c.desiredLocation || '',
    desiredMonth: c.desiredMonth || '',
    history: [],
  };
}

const statusBadge: Record<string, string> = {
  '一次面接待ち': 'badge-warn',
  '最終面接待ち': 'badge-warn',
  '書類選考': 'badge-info',
  '内定承諾': 'badge-ok',
  '不採用': 'badge-danger',
  '内定出し': 'badge-warn',
};

const sourceBadge: Record<string, string> = {
  'エージェント': 'badge-info',
  '媒体': 'badge-warn',
  'リファラル': 'badge-ok',
};

const statuses = ['一次面接待ち', '最終面接待ち', '書類選考', '内定承諾', '不採用', '内定出し'];
const sources = ['エージェント', '媒体', 'リファラル'];

export default function RecruitCandidatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const fetchCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient<ApiCandidate[]>('/candidates');
      setCandidates(data.map(mapCandidate));
    } catch {
      toast('候補者データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (search && !c.name.includes(search) && !c.kana.includes(search)) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      return true;
    });
  }, [candidates, search, statusFilter, sourceFilter]);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">候補者一覧</h1>
        <div className="flex gap-2">
          <label className="btn-outline text-sm py-2 cursor-pointer inline-flex items-center">
            CSVインポート
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result as string;
                  const lines = text.trim().split('\n').filter(l => l.trim());
                  const count = Math.max(lines.length - 1, 0);
                  toast(`${count}件の候補者データを読み込みました`);
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
          <button onClick={() => router.push('/admin/recruit-candidates/new')} className="btn-primary text-sm py-2">候補者を追加</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          type="text"
          placeholder="名前・フリガナ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[180px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none"
        >
          <option value="">ステータス: すべて</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none"
        >
          <option value="">経路: すべて</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-sm text-secondary self-center">全{filtered.length}件</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[900px]" style={{ whiteSpace: 'nowrap' }}>
          <thead>
            <tr className="border-b border-border">
              {['応募日', 'ステータス', '氏名', '応募求人', '一次面接日時', '最終面接日時', '経路', '詳細'].map((h) => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>
                  <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCandidate(c)}
                  className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-sm text-secondary">{c.applyDate}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                  <td className="px-4 py-2.5"><div className="text-base font-medium">{c.name}</div><div className="text-sm text-secondary mt-0.5">{c.kana}</div></td>
                  <td className="px-4 py-2.5 text-sm">{c.position}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{c.firstInterview || <span className="text-secondary italic">—</span>}{c.firstConfirm && <> <span className={`badge ${c.firstConfirm === '確認済' ? 'badge-ok' : 'badge-wait'}`}>{c.firstConfirm}</span></>}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{c.finalInterview || <span className="text-secondary italic">—</span>}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${sourceBadge[c.source]}`}>{c.source}</span></td>
                  <td className="px-4 py-2.5">
                    <button
                      className="btn-outline text-xs py-1 px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCandidate(c);
                      }}
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Side Panel */}
      {selectedCandidate && (
        <>
          <div
            className="fixed inset-0 bg-black/8 z-[99] transition-opacity duration-300"
            onClick={() => setSelectedCandidate(null)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto transition-transform duration-300 translate-x-0">
            {/* Panel Header */}
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <div className="text-xl font-medium">{selectedCandidate.name}</div>
                <div className="text-sm text-secondary mt-0.5">{selectedCandidate.kana}</div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* 応募情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">応募情報</div>
                {[
                  ['応募日', selectedCandidate.applyDate],
                  ['応募求人', selectedCandidate.position],
                  ['応募経路', selectedCandidate.sourceName],
                  ['ステータス', null],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    {label === 'ステータス' ? (
                      <span className={`badge ${statusBadge[selectedCandidate.status] || 'badge-wait'}`}>{selectedCandidate.status}</span>
                    ) : (
                      <span className="text-right">{value}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* 基本情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">基本情報</div>
                {[
                  ['年齢', selectedCandidate.age],
                  ['性別', selectedCandidate.gender],
                  ['居住地', selectedCandidate.address],
                  ['最終学歴', selectedCandidate.education],
                  ['電話番号', selectedCandidate.phone],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* 面接状況 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">面接状況</div>
                {[
                  ['一次面接', selectedCandidate.firstInterview || '未設定'],
                  ['一次面接官', selectedCandidate.firstInterviewer || '—'],
                  ['一次確認', selectedCandidate.firstConfirm || '—'],
                  ['最終面接', selectedCandidate.finalInterview || '未設定'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* 希望条件 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">希望条件</div>
                {[
                  ['希望勤務地', selectedCandidate.desiredLocation || '—'],
                  ['希望入社月', selectedCandidate.desiredMonth || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* ステータス履歴 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">ステータス履歴</div>
                {selectedCandidate.history.map((h, i) => (
                  <div key={i} className="py-2 border-b border-border/20">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium">{h.status}</span>
                      <span className="text-sm text-secondary">{h.date}</span>
                    </div>
                    {h.memo && <div className="text-sm text-secondary mt-0.5">{h.memo}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Panel Actions */}
            <div className="flex gap-2 p-5 border-t border-border/30">
              <button onClick={() => router.push('/admin/recruit-candidates/new')} className="btn-outline flex-1 text-sm py-2">編集</button>
              <button onClick={() => {
                const nextStatuses: Record<string, string> = {
                  '書類選考': '一次面接待ち',
                  '一次面接待ち': '最終面接待ち',
                  '最終面接待ち': '内定出し',
                  '内定出し': '内定承諾',
                };
                const next = nextStatuses[selectedCandidate.status];
                if (next) {
                  toast(`ステータスを「${next}」に更新しました`);
                } else {
                  toast(`現在のステータス「${selectedCandidate.status}」から更新できません`);
                }
              }} className="btn-primary flex-1 text-sm py-2">ステータス更新</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
