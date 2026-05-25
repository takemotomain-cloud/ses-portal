'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type ApiCandidate = {
  id: string;
  lastName: string;
  firstName: string;
  applicationDate: string;
  source: string;
  jobPosting: string | null;
  interviewDate: string | null;
  interviewTime: string | null;
  interviewer: string | null;
  confirmStatus: string | null;
  status: string;
};

type RecruitSource = {
  id: string;
  name: string;
  category: string;
};

type InterviewRow = {
  id: string;
  interviewer: string;
  name: string;
  stage: string;
  datetime: string;
  position: string;
  source: string;
  sourceBadge: string;
  confirmed: string;
  confirmedBadge: string;
};

type ProposalRow = {
  id: string;
  date: string;
  status: string;
  statusBadge: string;
  name: string;
  isNew: boolean;
  position: string;
  agent: string;
};

const statusBadge: Record<string, string> = {
  書類選考: 'badge-info',
  一次面接待ち: 'badge-warn',
  最終面接待ち: 'badge-warn',
  内定出し: 'badge-warn',
  内定承諾: 'badge-ok',
  不採用: 'badge-danger',
};

const sourceBadge: Record<string, string> = {
  agent: 'badge-info',
  media: 'badge-warn',
  referral: 'badge-ok',
  other: 'badge',
};

const confirmBadge: Record<string, string> = {
  未確認: 'badge-warn',
  確認済み: 'badge-ok',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function formatDateTime(dateIso: string | null, time: string | null) {
  if (!dateIso) return '未設定';
  const date = formatDate(dateIso);
  return time ? `${date} ${time}` : date;
}

function mapCandidateStatus(status: string): string {
  if (status === 'new') return '書類選考';
  if (status === 'screening') return '一次面接待ち';
  if (status === 'first_interview') return '一次面接待ち';
  if (status === 'final_interview') return '最終面接待ち';
  if (status === 'offer') return '内定出し';
  if (status === 'accepted') return '内定承諾';
  if (status === 'rejected') return '不採用';
  return status;
}

function isTomorrow(dateIso: string | null) {
  if (!dateIso) return false;
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate()
  );
}

function isWithinDays(dateIso: string, days: number) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return false;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return date >= threshold;
}

export default function RecruitDashPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<ApiCandidate[]>([]);
  const [sources, setSources] = useState<RecruitSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [candidateRes, sourceRes] = await Promise.all([
          apiClient<ApiCandidate[]>('/candidates'),
          apiClient<RecruitSource[]>('/candidates/sources').catch(() => [] as RecruitSource[]),
        ]);
        if (!alive) return;
        setCandidates(candidateRes);
        setSources(sourceRes);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'データの取得に失敗しました');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const sourceCategoryMap = useMemo(() => {
    return new Map(sources.map((source) => [source.name, source.category]));
  }, [sources]);

  const interviews = useMemo<InterviewRow[]>(() => {
    return candidates
      .filter((candidate) => isTomorrow(candidate.interviewDate))
      .sort((a, b) => {
        const left = `${a.interviewDate || ''} ${a.interviewTime || ''}`;
        const right = `${b.interviewDate || ''} ${b.interviewTime || ''}`;
        return left.localeCompare(right);
      })
      .map((candidate) => {
        const stage = mapCandidateStatus(candidate.status);
        const category = sourceCategoryMap.get(candidate.source) || 'other';
        const confirmed = candidate.confirmStatus || '未確認';
        return {
          id: candidate.id,
          interviewer: candidate.interviewer || '未設定',
          name: `${candidate.lastName} ${candidate.firstName}`,
          stage,
          datetime: formatDateTime(candidate.interviewDate, candidate.interviewTime),
          position: candidate.jobPosting || '未設定',
          source: candidate.source,
          sourceBadge: sourceBadge[category] || 'badge',
          confirmed,
          confirmedBadge: confirmBadge[confirmed] || 'badge',
        };
      });
  }, [candidates, sourceCategoryMap]);

  const proposals = useMemo<ProposalRow[]>(() => {
    return candidates
      .filter((candidate) => sourceCategoryMap.get(candidate.source) === 'agent')
      .sort((a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())
      .slice(0, 5)
      .map((candidate) => {
        const status = mapCandidateStatus(candidate.status);
        return {
          id: candidate.id,
          date: formatDate(candidate.applicationDate),
          status,
          statusBadge: statusBadge[status] || 'badge',
          name: `${candidate.lastName} ${candidate.firstName}`,
          isNew: isWithinDays(candidate.applicationDate, 7),
          position: candidate.jobPosting || '未設定',
          agent: candidate.source,
        };
      });
  }, [candidates, sourceCategoryMap]);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-medium text-[#1A1A1A]">採用ダッシュボード</h1>
      </div>

      {error && (
        <div className="card px-4 py-3 mb-5 text-sm text-status-red-text">
          {error}
        </div>
      )}

      <h2 className="text-md font-medium text-[#1A1A1A] mb-3">明日の面接予定</h2>
      <div className="card p-0 overflow-x-auto mb-6">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              {['面接官', '氏名', 'ステージ', '日時', '応募求人', '経路', '前日確認'].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs text-[#6B6B6B] font-normal px-4 py-2.5 bg-[#FAFAFA] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : interviews.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">明日の面接予定はありません</div></td></tr>
            ) : interviews.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-b-0 hover:bg-[#FAFAF8] cursor-pointer"
                onClick={() => router.push('/admin/recruit-candidates')}
              >
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.interviewer}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className="text-blue-600 cursor-pointer hover:underline">{row.name}</span>
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`badge ${statusBadge[row.stage] || 'badge'}`}>{row.stage}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.datetime}</td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.position}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`badge ${row.sourceBadge}`}>{row.source}</span>
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`badge ${row.confirmedBadge}`}>{row.confirmed}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-md font-medium text-[#1A1A1A] mb-3">最新エージェント提案（5件）</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              {['応募日', 'ステータス', '候補者名', '希望職種', 'エージェント', '詳細'].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs text-[#6B6B6B] font-normal px-4 py-2.5 bg-[#FAFAFA] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : proposals.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : proposals.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.date}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`badge ${row.statusBadge}`}>{row.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">
                  {row.name}
                  {row.isNew && (
                    <span className="ml-2 badge badge-danger text-xs">New</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.position}</td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.agent}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <button
                    className="px-3 py-1 text-xs border border-border rounded-md hover:bg-gray-50 transition text-[#1A1A1A]"
                    onClick={() => router.push('/admin/recruit-candidates')}
                  >
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
