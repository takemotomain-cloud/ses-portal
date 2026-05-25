'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type CheckState = 'done' | 'pending' | 'na';

interface EmployeeListRow {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  contractType: string;
  hireDate: string;
}

interface EmployeeDetailSnapshot {
  id: string;
  email: string;
  phone: string | null;
  address: string | null;
  birthDate: string | null;
  gender: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  qualifications?: unknown;
  emergencyContacts?: { id: string; name: string; phone: string }[];
  dependents?: { id: string; name: string }[];
}

interface OnboardingDocumentInfo {
  id: string;
  documentType: string;
}

interface NoticeHistoryItem {
  id: string;
  documentType: string;
}

interface ManualCheckStatus {
  id: string;
  itemKey: string;
  method: string | null;
  confirmedAt: string | null;
  memo: string | null;
}

interface OnboardingPerson {
  id: string;
  employeeCode: string;
  name: string;
  hireDateLabel: string;
  statuses: Record<string, CheckState>;
  formStatus: CheckState;
  manualStatuses: Record<string, ManualCheckStatus>;
}

const checkItems = [
  { key: 'offer', label: '内定通知書' },
  { key: 'labor', label: '労働条件通知書' },
  { key: 'identity', label: '本人確認書類' },
  { key: 'mynumber', label: 'マイナンバー' },
  { key: 'pension', label: '年金手帳' },
  { key: 'resident', label: '住民票' },
  { key: 'employmentInsurance', label: '雇用保険被保険者証' },
  { key: 'bank', label: '給与振込口座' },
  { key: 'emergency', label: '緊急連絡先' },
  { key: 'dependents', label: '扶養家族' },
  { key: 'qualifications', label: '保有資格' },
] as const;

const checkLabels = Object.fromEntries(checkItems.map((item) => [item.key, item.label])) as Record<string, string>;
const manualMethodOptions = [
  { value: 'paper', label: '紙で受領' },
  { value: 'email', label: 'メール受領' },
  { value: 'system', label: 'システム外で確認' },
  { value: 'verbal', label: '口頭確認' },
  { value: 'other', label: 'その他' },
];

function getCheckDisplay(state: CheckState) {
  switch (state) {
    case 'done':
      return { symbol: '✓', cls: 'bg-status-green-bg text-status-green-text' };
    case 'pending':
      return { symbol: '○', cls: 'bg-status-amber-bg text-status-amber-text' };
    case 'na':
      return { symbol: '―', cls: 'bg-border/30 text-secondary' };
  }
}

function getFormBadge(state: CheckState) {
  if (state === 'done') return { label: '提出済', cls: 'badge-ok' };
  if (state === 'pending') return { label: '未完了', cls: 'badge-warn' };
  return { label: '対象外', cls: 'badge-wait' };
}

function hasAnyQualification(value: unknown) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => {
    if (typeof item === 'string') return item.trim().length > 0;
    if (item && typeof item === 'object' && 'name' in item) {
      return typeof item.name === 'string' && item.name.trim().length > 0;
    }
    return false;
  });
}

function buildStatuses(
  detail: EmployeeDetailSnapshot,
  docs: OnboardingDocumentInfo[],
  notices: NoticeHistoryItem[],
  manualStatusList: ManualCheckStatus[],
): { statuses: Record<string, CheckState>; formStatus: CheckState } {
  const docTypes = new Set(docs.map((doc) => doc.documentType));
  const noticeTypes = new Set(notices.map((notice) => notice.documentType));
  const manualStatuses = new Map(manualStatusList.map((status) => [status.itemKey, status]));

  const autoStatuses: Record<string, CheckState> = {
    offer: noticeTypes.has('offer') ? 'done' : 'pending',
    labor: noticeTypes.has('notice_fixed') || noticeTypes.has('notice_open') ? 'done' : 'pending',
    identity:
      docTypes.has('license_front') && docTypes.has('license_back') ? 'done' : 'pending',
    mynumber:
      docTypes.has('mynumber_front') && docTypes.has('mynumber_back') ? 'done' : 'pending',
    pension: docTypes.has('pension_book') ? 'done' : 'pending',
    resident: docTypes.has('resident_record') ? 'done' : 'pending',
    employmentInsurance: docTypes.has('employment_insurance_certificate') ? 'done' : 'pending',
    bank:
      detail.bankName &&
      detail.bankBranch &&
      detail.bankAccountType &&
      detail.bankAccountNumber &&
      detail.bankAccountHolder
        ? 'done'
        : 'pending',
    emergency:
      detail.emergencyContacts && detail.emergencyContacts.some((item) => item.name && item.phone)
        ? 'done'
        : 'pending',
    dependents:
      detail.dependents && detail.dependents.length > 0
        ? 'done'
        : 'na',
    qualifications: hasAnyQualification(detail.qualifications) ? 'done' : 'na',
  };

  const statuses = Object.fromEntries(
    Object.entries(autoStatuses).map(([key, value]) => {
      if (manualStatuses.has(key)) return [key, 'done' as CheckState];
      return [key, value];
    }),
  ) as Record<string, CheckState>;

  const formStatus = Object.values(statuses).every((status) => status !== 'pending')
    ? 'done'
    : 'pending';

  return { statuses, formStatus };
}

export default function AdminOnboardingPage() {
  const [people, setPeople] = useState<OnboardingPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<{
    employeeId: string;
    employeeName: string;
    itemKey: string;
    current?: ManualCheckStatus;
  } | null>(null);
  const [method, setMethod] = useState('paper');
  const [confirmedAt, setConfirmedAt] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const router = useRouter();

  const loadPeople = useCallback(async () => {
    return apiClient<OnboardingPerson[]>('/onboarding-documents/summary/recent');
  }, []);

  function openManualCheck(person: OnboardingPerson, itemKey: string) {
    const current = person.manualStatuses[itemKey];
    setSelectedCheck({
      employeeId: person.id,
      employeeName: person.name,
      itemKey,
      current,
    });
    setMethod(current?.method || 'paper');
    setConfirmedAt(current?.confirmedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setMemo(current?.memo || '');
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rows = await loadPeople();

        if (!cancelled) {
          setPeople(rows);
        }
      } catch {
        if (!cancelled) {
          setPeople([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadPeople]);

  const summary = useMemo(() => {
    const submitted = people.filter((person) => person.formStatus === 'done').length;
    const docsReady = people.filter((person) =>
      checkItems.every(
        (item) => person.statuses[item.key] === 'done',
      ),
    ).length;
    return { submitted, docsReady };
  }, [people]);

  async function saveManualStatus() {
    if (!selectedCheck) return;
    setSaving(true);
    try {
      await apiClient(`/onboarding-check-statuses/${selectedCheck.employeeId}/${selectedCheck.itemKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          method,
          confirmedAt,
          memo: memo || undefined,
        }),
      });
      setPeople(await loadPeople());
      setSelectedCheck(null);
    } finally {
      setSaving(false);
    }
  }

  async function clearManualStatus() {
    if (!selectedCheck?.current) return;
    setSaving(true);
    try {
      await apiClient(`/onboarding-check-statuses/${selectedCheck.employeeId}/${selectedCheck.itemKey}`, {
        method: 'DELETE',
      });
      setPeople(await loadPeople());
      setSelectedCheck(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-medium">入社予定社員</h1>
          <span className="text-sm text-secondary">フォーム入力とアップロード状況から自動判定</span>
        </div>
        <button
          className="btn-primary text-sm py-2"
          onClick={() => router.push('/admin/onboarding/form')}
        >
          入社情報フォーム（プレビュー）
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="card">
          <div className="text-xs text-secondary mb-1">対象人数</div>
          <div className="text-2xl font-medium">{people.length}名</div>
        </div>
        <div className="card">
          <div className="text-xs text-secondary mb-1">完了</div>
          <div className="text-2xl font-medium">{summary.submitted}名</div>
        </div>
        <div className="card">
          <div className="text-xs text-secondary mb-1">主要書類そろい済み</div>
          <div className="text-2xl font-medium">{summary.docsReady}名</div>
          <div className="text-xs text-secondary mt-1">
            住民票・雇用保険被保険者証は後日提出でも送信可
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full" style={{ minWidth: '1180px' }}>
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] sticky left-0 z-[2] min-w-[150px]">
                氏名
                <br />
                <span className="text-2xs">入社予定月</span>
              </th>
              {checkItems.map((item) => (
                <th
                  key={item.key}
                  className="text-center text-2xs text-secondary font-normal px-2 py-2.5 bg-[#FAFAFA] min-w-[72px]"
                >
                  {item.label}
                </th>
              ))}
              <th className="text-center text-xs text-secondary font-normal px-2 py-2.5 bg-[#FAFAFA] min-w-[78px]">
                フォーム
              </th>
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] min-w-[108px]">
                アクション
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={checkItems.length + 3}>
                  <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
                </td>
              </tr>
            ) : people.length === 0 ? (
              <tr>
                <td colSpan={checkItems.length + 3}>
                  <div className="px-4 py-8 text-center text-sm text-secondary">
                    入社予定の社員はいません
                  </div>
                </td>
              </tr>
            ) : (
              people.map((person) => {
                const formBadge = getFormBadge(person.formStatus);
                return (
                  <tr key={person.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                    <td className="px-4 py-2.5 font-medium text-base sticky left-0 bg-card z-[1]">
                      <button
                        onClick={() => router.push(`/admin/employees/${person.id}/edit`)}
                        className="text-left hover:text-primary transition-colors"
                      >
                        {person.name}
                      </button>
                      <div className="text-2xs text-secondary">
                        {person.hireDateLabel} / {person.employeeCode}
                      </div>
                    </td>
                    {checkItems.map((item) => {
                      const display = getCheckDisplay(person.statuses[item.key]);
                      const hasManual = Boolean(person.manualStatuses[item.key]);
                      return (
                        <td key={item.key} className="text-center px-2 py-2.5">
                          <button
                            onClick={() => person.statuses[item.key] !== 'na' && openManualCheck(person, item.key)}
                            disabled={person.statuses[item.key] === 'na'}
                            className={`w-7 h-7 rounded-md text-md inline-flex items-center justify-center relative ${
                              person.statuses[item.key] === 'na' ? 'cursor-default' : 'cursor-pointer'
                            } ${display.cls}`}
                          >
                            {display.symbol}
                            {hasManual && (
                              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-center px-2 py-2.5">
                      <span className={`badge ${formBadge.cls}`}>{formBadge.label}</span>
                    </td>
                    <td className="text-center px-4 py-2.5">
                      <button
                        onClick={() => router.push(`/admin/employees/${person.id}/edit`)}
                        className="text-xs border border-border rounded-md px-3 py-1.5 hover:bg-[#FAFAFA] transition-colors"
                      >
                        内容確認
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-secondary flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="text-status-green-text">✓</span>
          完了
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-status-amber-text">○</span>
          要対応
        </span>
        <span className="inline-flex items-center gap-1">― 任意または対象外</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          管理者確認あり
        </span>
      </div>

      {selectedCheck && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-5">
            <h2 className="text-lg font-medium mb-1">確認記録を登録</h2>
            <div className="text-sm text-secondary mb-4">
              {selectedCheck.employeeName} / {checkLabels[selectedCheck.itemKey]}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-secondary block mb-1">回収方法</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="input w-full">
                  {manualMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">確認日</label>
                <input type="date" value={confirmedAt} onChange={(e) => setConfirmedAt(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">メモ</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full min-h-[96px] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="例: 5/7 に紙で受領"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-between gap-2">
              <div>
                {selectedCheck.current && (
                  <button
                    onClick={clearManualStatus}
                    disabled={saving}
                    className="btn-outline text-sm py-2 px-4 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    解除
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCheck(null)}
                  disabled={saving}
                  className="btn-outline text-sm py-2 px-4 disabled:opacity-50"
                >
                  閉じる
                </button>
                <button
                  onClick={saveManualStatus}
                  disabled={saving}
                  className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '確認済みにする'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
