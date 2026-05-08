'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

type CandidateRow = {
  id: string;
  jobPosting: string | null;
  applicationDate: string;
  interviewer: string | null;
};

type RecruitSource = {
  id: string;
  name: string;
  category: string;
  fee: string | null;
};

type RecruitStatus = {
  id: string;
  code: string;
  name: string;
  flagLabel: string | null;
  flagType: string | null;
};

type RecruitJobPosting = {
  id: string;
  name: string;
  description: string | null;
};

type RecruitInterviewer = {
  id: string;
  name: string;
  email: string | null;
  roleLabel: string | null;
  memo: string | null;
};

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

const flagBadgeClass: Record<string, string> = {
  info: 'badge-info',
  warn: 'badge-warn',
  ok: 'badge-ok',
  danger: 'badge-danger',
  wait: 'badge-wait',
};

const flagTypeOptions = [
  { value: '', label: 'フラグなし' },
  { value: 'info', label: '情報' },
  { value: 'warn', label: '注意' },
  { value: 'ok', label: '完了' },
  { value: 'danger', label: '重要' },
  { value: 'wait', label: '保留' },
];

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function RecruitSettingsPage() {
  const { toast, ToastUI } = useToast();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [sources, setSources] = useState<RecruitSource[]>([]);
  const [statuses, setStatuses] = useState<RecruitStatus[]>([]);
  const [jobs, setJobs] = useState<RecruitJobPosting[]>([]);
  const [interviewers, setInterviewers] = useState<RecruitInterviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [showStatusAdd, setShowStatusAdd] = useState(false);
  const [statusEditTarget, setStatusEditTarget] = useState<RecruitStatus | null>(null);
  const [statusForm, setStatusForm] = useState({ name: '', flagLabel: '', flagType: '' });

  const [showJobAdd, setShowJobAdd] = useState(false);
  const [jobEditTarget, setJobEditTarget] = useState<RecruitJobPosting | null>(null);
  const [jobForm, setJobForm] = useState({ name: '', description: '' });

  const [showInterviewerAdd, setShowInterviewerAdd] = useState(false);
  const [interviewerEditTarget, setInterviewerEditTarget] = useState<RecruitInterviewer | null>(null);
  const [interviewerForm, setInterviewerForm] = useState({ name: '', email: '', roleLabel: '', memo: '' });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [candidateRes, sourceRes, statusRes, jobRes, interviewerRes] = await Promise.all([
        apiClient<CandidateRow[]>('/candidates'),
        apiClient<RecruitSource[]>('/candidates/sources').catch(() => [] as RecruitSource[]),
        apiClient<RecruitStatus[]>('/candidates/statuses').catch(() => [] as RecruitStatus[]),
        apiClient<RecruitJobPosting[]>('/candidates/job-postings').catch(() => [] as RecruitJobPosting[]),
        apiClient<RecruitInterviewer[]>('/candidates/interviewers').catch(() => [] as RecruitInterviewer[]),
      ]);
      setCandidates(candidateRes);
      setSources(sourceRes);
      setStatuses(statusRes);
      setJobs(jobRes);
      setInterviewers(interviewerRes);
    } catch (e: any) {
      setError(e?.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const jobStats = useMemo(() => {
    const grouped = new Map<string, { count: number; latestAt: string }>();
    for (const candidate of candidates) {
      const key = candidate.jobPosting?.trim();
      if (!key) continue;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, { count: 1, latestAt: candidate.applicationDate });
      } else {
        current.count += 1;
        if (new Date(candidate.applicationDate) > new Date(current.latestAt)) {
          current.latestAt = candidate.applicationDate;
        }
      }
    }
    return grouped;
  }, [candidates]);

  const interviewerCounts = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const candidate of candidates) {
      const key = candidate.interviewer?.trim();
      if (!key) continue;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }
    return grouped;
  }, [candidates]);

  function openStatusEdit(item: RecruitStatus) {
    setStatusEditTarget(item);
    setStatusForm({
      name: item.name,
      flagLabel: item.flagLabel || '',
      flagType: item.flagType || '',
    });
  }

  function openJobEdit(item: RecruitJobPosting) {
    setJobEditTarget(item);
    setJobForm({
      name: item.name,
      description: item.description || '',
    });
  }

  function openInterviewerEdit(item: RecruitInterviewer) {
    setInterviewerEditTarget(item);
    setInterviewerForm({
      name: item.name,
      email: item.email || '',
      roleLabel: item.roleLabel || '',
      memo: item.memo || '',
    });
  }

  async function handleStatusSave() {
    if (!statusForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: statusForm.name.trim(),
        flagLabel: statusForm.flagLabel.trim() || null,
        flagType: statusForm.flagType || null,
      };
      if (statusEditTarget) {
        await apiClient(`/candidates/statuses/${statusEditTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast('採用ステータスを更新しました');
      } else {
        await apiClient('/candidates/statuses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('採用ステータスを追加しました');
      }
      setShowStatusAdd(false);
      setStatusEditTarget(null);
      setStatusForm({ name: '', flagLabel: '', flagType: '' });
      fetchAll();
    } catch {
      toast('採用ステータスの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleJobSave() {
    if (!jobForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: jobForm.name.trim(),
        description: jobForm.description.trim() || null,
      };
      if (jobEditTarget) {
        await apiClient(`/candidates/job-postings/${jobEditTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast('募集求人を更新しました');
      } else {
        await apiClient('/candidates/job-postings', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('募集求人を追加しました');
      }
      setShowJobAdd(false);
      setJobEditTarget(null);
      setJobForm({ name: '', description: '' });
      fetchAll();
    } catch {
      toast('募集求人の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleInterviewerSave() {
    if (!interviewerForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: interviewerForm.name.trim(),
        email: interviewerForm.email.trim() || null,
        roleLabel: interviewerForm.roleLabel.trim() || null,
        memo: interviewerForm.memo.trim() || null,
      };
      if (interviewerEditTarget) {
        await apiClient(`/candidates/interviewers/${interviewerEditTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast('面接官を更新しました');
      } else {
        await apiClient('/candidates/interviewers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('面接官を追加しました');
      }
      setShowInterviewerAdd(false);
      setInterviewerEditTarget(null);
      setInterviewerForm({ name: '', email: '', roleLabel: '', memo: '' });
      fetchAll();
    } catch {
      toast('面接官の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(kind: 'status' | 'job' | 'interviewer', id: string) {
    const label =
      kind === 'status' ? '採用ステータス' : kind === 'job' ? '募集求人' : '面接官';
    if (!confirm(`${label}を削除しますか？`)) return;
    try {
      const path =
        kind === 'status'
          ? `/candidates/statuses/${id}`
          : kind === 'job'
            ? `/candidates/job-postings/${id}`
            : `/candidates/interviewers/${id}`;
      await apiClient(path, { method: 'DELETE' });
      toast(`${label}を削除しました`);
      fetchAll();
    } catch {
      toast(`${label}の削除に失敗しました`);
    }
  }

  if (loading) {
    return <div className="card p-10 text-center text-secondary">読み込み中...</div>;
  }

  return (
    <div>
      <ToastUI />

      <h1 className="text-2xl font-medium mb-5">採用設定</h1>

      {error && <div className="card p-4 mb-4 text-sm text-status-red-text">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-md font-medium">採用ステータス一覧</h2>
            <button
              className="btn-outline text-sm py-1.5 px-4"
              onClick={() => {
                setStatusEditTarget(null);
                setStatusForm({ name: '', flagLabel: '', flagType: '' });
                setShowStatusAdd(true);
              }}
            >
              追加
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">#</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">ステータス名</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">フラグ</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">操作</th>
                </tr>
              </thead>
              <tbody>
                {statuses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-secondary">ステータスはありません</td>
                  </tr>
                ) : statuses.map((status, index) => (
                  <tr key={status.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                    <td className="px-4 py-2.5 text-right tabular-nums">{index + 1}</td>
                    <td className="px-4 py-2.5">{status.name}</td>
                    <td className="px-4 py-2.5">
                      {status.flagLabel ? (
                        <span className={`badge ${status.flagType ? flagBadgeClass[status.flagType] || '' : ''}`}>{status.flagLabel}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button className="btn-outline text-xs py-1 px-3" onClick={() => openStatusEdit(status)}>編集</button>
                        <button className="btn-outline text-xs py-1 px-3 text-status-red-text" onClick={() => handleDelete('status', status.id)}>削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-secondary">
            候補者フローで使う採用ステータス候補です。表示順は登録順で管理しています。
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-md font-medium">応募経路</h2>
              <Link href="/admin/recruit-sources" className="btn-outline text-sm py-1.5 px-4">
                管理する
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">経路名</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">カテゴリ</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">手数料/コスト</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-secondary">経路データはありません</td></tr>
                  ) : sources.slice(0, 8).map((source) => (
                    <tr key={source.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-2.5 text-sm font-medium">{source.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${categoryBadge[source.category] || 'badge'}`}>
                          {categoryLabel[source.category] || source.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{source.fee || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-md font-medium">募集求人一覧</h2>
              <button
                className="btn-outline text-sm py-1.5 px-4"
                onClick={() => {
                  setJobEditTarget(null);
                  setJobForm({ name: '', description: '' });
                  setShowJobAdd(true);
                }}
              >
                追加
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">求人名</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">応募数</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">最終応募日</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-secondary">求人データはありません</td></tr>
                  ) : jobs.map((job) => {
                    const stat = jobStats.get(job.name);
                    return (
                      <tr key={job.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium">{job.name}</div>
                          {job.description && <div className="text-xs text-secondary mt-1">{job.description}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-sm tabular-nums">{stat?.count || 0}件</td>
                        <td className="px-4 py-2.5 text-sm">{stat ? formatDate(stat.latestAt) : '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <button className="btn-outline text-xs py-1 px-3" onClick={() => openJobEdit(job)}>編集</button>
                            <button className="btn-outline text-xs py-1 px-3 text-status-red-text" onClick={() => handleDelete('job', job.id)}>削除</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-secondary">
              候補者登録フォームの求人選択肢として使用します。応募数は既存候補者データから集計しています。
            </div>
          </div>

          <div className="card p-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-md font-medium">面接官一覧</h2>
              <button
                className="btn-outline text-sm py-1.5 px-4"
                onClick={() => {
                  setInterviewerEditTarget(null);
                  setInterviewerForm({ name: '', email: '', roleLabel: '', memo: '' });
                  setShowInterviewerAdd(true);
                }}
              >
                追加
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">面接官</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">区分</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">担当件数</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewers.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-secondary">面接官データはありません</td></tr>
                  ) : interviewers.map((item) => (
                    <tr key={item.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-secondary mt-1">{item.email || 'メール未設定'}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {item.roleLabel ? <span className="badge badge-info">{item.roleLabel}</span> : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm tabular-nums">{interviewerCounts.get(item.name) || 0}件</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button className="btn-outline text-xs py-1 px-3" onClick={() => openInterviewerEdit(item)}>編集</button>
                          <button className="btn-outline text-xs py-1 px-3 text-status-red-text" onClick={() => handleDelete('interviewer', item.id)}>削除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-secondary">
              候補者登録フォームの面接官候補として使用します。担当件数は候補者データから自動集計しています。
            </div>
          </div>
        </div>
      </div>

      {(showStatusAdd || statusEditTarget) && (
        <Modal title={statusEditTarget ? '採用ステータスを編集' : '採用ステータスを追加'} onClose={() => {
          setShowStatusAdd(false);
          setStatusEditTarget(null);
        }}>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-secondary block mb-1">ステータス名</label>
              <input
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                value={statusForm.name}
                onChange={(e) => setStatusForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-secondary block mb-1">フラグ表示</label>
              <input
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                placeholder="例: 面接ステージ"
                value={statusForm.flagLabel}
                onChange={(e) => setStatusForm((f) => ({ ...f, flagLabel: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-secondary block mb-1">フラグ色</label>
              <select
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full bg-white"
                value={statusForm.flagType}
                onChange={(e) => setStatusForm((f) => ({ ...f, flagType: e.target.value }))}
              >
                {flagTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn-outline text-sm py-2 px-4" onClick={() => {
              setShowStatusAdd(false);
              setStatusEditTarget(null);
            }}>キャンセル</button>
            <button className="btn-primary text-sm py-2 px-4" disabled={saving || !statusForm.name.trim()} onClick={handleStatusSave}>
              {saving ? '保存中…' : statusEditTarget ? '更新' : '追加'}
            </button>
          </div>
        </Modal>
      )}

      {(showJobAdd || jobEditTarget) && (
        <Modal title={jobEditTarget ? '募集求人を編集' : '募集求人を追加'} onClose={() => {
          setShowJobAdd(false);
          setJobEditTarget(null);
        }}>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-secondary block mb-1">求人名</label>
              <input
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                value={jobForm.name}
                onChange={(e) => setJobForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-secondary block mb-1">補足説明</label>
              <textarea
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                rows={3}
                value={jobForm.description}
                onChange={(e) => setJobForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn-outline text-sm py-2 px-4" onClick={() => {
              setShowJobAdd(false);
              setJobEditTarget(null);
            }}>キャンセル</button>
            <button className="btn-primary text-sm py-2 px-4" disabled={saving || !jobForm.name.trim()} onClick={handleJobSave}>
              {saving ? '保存中…' : jobEditTarget ? '更新' : '追加'}
            </button>
          </div>
        </Modal>
      )}

      {(showInterviewerAdd || interviewerEditTarget) && (
        <Modal title={interviewerEditTarget ? '面接官を編集' : '面接官を追加'} onClose={() => {
          setShowInterviewerAdd(false);
          setInterviewerEditTarget(null);
        }}>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-secondary block mb-1">面接官名</label>
              <input
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                value={interviewerForm.name}
                onChange={(e) => setInterviewerForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-secondary block mb-1">メールアドレス</label>
              <input
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                value={interviewerForm.email}
                onChange={(e) => setInterviewerForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-secondary block mb-1">区分</label>
              <input
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                placeholder="例: manager"
                value={interviewerForm.roleLabel}
                onChange={(e) => setInterviewerForm((f) => ({ ...f, roleLabel: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-secondary block mb-1">メモ</label>
              <textarea
                className="border border-border rounded-md px-3 py-1.5 text-sm w-full"
                rows={3}
                value={interviewerForm.memo}
                onChange={(e) => setInterviewerForm((f) => ({ ...f, memo: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn-outline text-sm py-2 px-4" onClick={() => {
              setShowInterviewerAdd(false);
              setInterviewerEditTarget(null);
            }}>キャンセル</button>
            <button className="btn-primary text-sm py-2 px-4" disabled={saving || !interviewerForm.name.trim()} onClick={handleInterviewerSave}>
              {saving ? '保存中…' : interviewerEditTarget ? '更新' : '追加'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
