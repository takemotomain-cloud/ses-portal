/**
 * 管理側 社員詳細ページ（仕様準拠フルページ版）
 *
 * HTMLプロトタイプ page-emp-detail を完全再現。
 * セクション: ヘッダー → 現在の稼働 / 給与・口座 → 基本情報 / 連絡先 / 稼働ヒストリー
 *           → 勤怠履歴（月別） → 勤怠アラート履歴 / 面談記録
 *           → 年次有給休暇 → 発行済み通知書・書類
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

/* ---------- 型定義 ---------- */

interface MeetingInfo {
  id: string;
  date: string;
  interviewer: string;
  content: string;
  videoUrl: string | null;
}

interface AttendanceMonthlySummary {
  yearMonth: string;
  workDays: number;
  totalWorkMinutes: number;
  totalOvertimeMinutes: number;
  missedClockCount: number;
  lateCount: number;
  absentCount: number;
}

interface LeaveBalanceInfo {
  id: string;
  grantedDate: string;
  expiryDate: string;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
}

interface CertificateInfo {
  id: string;
  certType: string;
  status: string;
  filePath: string | null;
  issuedAt: string | null;
}

interface DocumentIssuanceInfo {
  id: string;
  documentType: string;
  fileName: string;
  driveViewLink: string | null;
  issuedAt: string;
  workflowStatus?: 'issued' | 'sent' | 'waiting_ack' | 'completed';
  deliveryMethod?: string | null;
  deliveredAt?: string | null;
  acknowledgedAt?: string | null;
  workflowNote?: string | null;
}

interface OnboardingDocumentInfo {
  id: string;
  documentType: string;
  fileName: string;
  driveViewLink: string | null;
  uploadedAt: string;
}

interface AssignmentInfo {
  id: string;
  employeeId: string;
  projectName: string;
  contractPrice: number;
  settlementLower: number;
  settlementUpper: number;
  workLocation: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  client: { id: string; name: string };
}

interface EmployeeDetail {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  birthDate: string | null;
  gender: string | null;
  bloodType: string | null;
  email: string;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  education: string | null;
  schoolName: string | null;
  status: string;
  employmentType: string;
  contractType: string;
  hireDate: string;
  resignDate: string | null;
  baseSalary: number | null;
  rewardRate: number | null;
  hasBonus: boolean;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  department: { id: string; name: string; code: string } | null;
  position: { id: string; name: string; rank: number } | null;
  qualifications?: any;
  emergencyContacts?: { id: string; name: string; relationship: string; phone: string }[];
  dependents?: { id: string; name: string; relationship: string; birthDate: string; annualIncome: number | null }[];
  meetings?: MeetingInfo[];
  leaveBalances?: LeaveBalanceInfo[];
  certificates?: CertificateInfo[];
  attendanceSummary?: AttendanceMonthlySummary[];
}

/* ---------- ラベルマップ ---------- */

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: '在籍', cls: 'badge-ok' },
  leave: { label: '休職中', cls: 'badge-warn' },
  resigned: { label: '退職', cls: 'badge-danger' },
};

const empTypeLabel: Record<string, string> = {
  regular: '正社員',
  contract: '契約社員',
  parttime: 'パート',
};

const contractLabel: Record<string, string> = {
  indefinite: '無期',
  fixed: '有期',
  fixed_term: '有期',
};

const genderLabel: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
};

const accountTypeLabel: Record<string, string> = {
  ordinary: '普通',
  checking: '当座',
  savings: '貯蓄',
};

const certTypeLabel: Record<string, string> = {
  employment: '在職証明書',
  income: '収入証明書',
  retirement: '退職証明書',
  withholding: '源泉徴収票',
  salary_revision: '給与改定通知書',
  assignment: '配属通知書',
  offer: '内定通知書',
};

const issuanceTypeLabel: Record<string, string> = {
  offer: '内定通知書',
  notice_fixed: '労働条件通知書（有期）',
  notice_open: '労働条件通知書（無期）',
};

const issuanceWorkflowLabel: Record<string, { label: string; cls: string }> = {
  issued: { label: '発行済み', cls: 'badge-wait' },
  sent: { label: '送付済み', cls: 'badge-info' },
  waiting_ack: { label: '承諾待ち', cls: 'badge-warn' },
  completed: { label: '完了', cls: 'badge-ok' },
};

const onboardingDocumentLabel: Record<string, string> = {
  license_front: '本人確認書類（表）',
  license_back: '本人確認書類（裏）',
  mynumber_front: 'マイナンバー（表）',
  mynumber_back: 'マイナンバー（裏）',
  pension_book: '年金手帳',
  resident_record: '住民票',
  employment_insurance_certificate: '雇用保険被保険者証',
};

const certStatusLabel: Record<string, { label: string; cls: string }> = {
  pending: { label: '申請中', cls: 'badge-warn' },
  issued: { label: '発行済', cls: 'badge-ok' },
  rejected: { label: '却下', cls: 'badge-danger' },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '--';
  return `¥${val.toLocaleString()}`;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '--';
  const b = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return `${age}歳`;
}

function calcTenure(hireDate: string): string {
  const h = new Date(hireDate);
  const today = new Date();
  const days = Math.floor((today.getTime() - h.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 365) return `${days}日目`;
  const years = Math.floor(days / 365);
  const remainDays = days % 365;
  const months = Math.floor(remainDays / 30);
  return `${years}年${months}ヶ月`;
}

function contractBadgeEl(contractType: string) {
  const ct = contractLabel[contractType] || contractType;
  const cls = ct === '無期' ? 'badge-ok' : 'badge-info';
  return <span className={`badge ${cls}`}>{ct === '無期' ? '無期雇用' : '有期雇用'}</span>;
}

/* ---------- サブコンポーネント ---------- */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-2xs text-secondary uppercase tracking-widest mb-3">{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/15 text-sm last:border-b-0">
      <span className="text-secondary">{label}</span>
      <span className="text-right max-w-[60%]">{value || '--'}</span>
    </div>
  );
}

/* ---------- メインコンポーネント ---------- */

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user: currentUser } = useAuth();
  // E: 銀行口座・マイナンバーの閲覧は admin + manager のみ
  const canViewPii = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<AssignmentInfo | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentInfo[]>([]);
  const [documentIssuances, setDocumentIssuances] = useState<DocumentIssuanceInfo[]>([]);
  const [onboardingDocuments, setOnboardingDocuments] = useState<OnboardingDocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiClient<EmployeeDetail>(`/employees/${id}`),
      apiClient<{ data: AssignmentInfo[] }>(`/assignments?limit=100`).catch(() => ({ data: [] })),
      apiClient<DocumentIssuanceInfo[]>(`/notices/history/${id}`).catch(() => []),
      apiClient<OnboardingDocumentInfo[]>(`/onboarding-documents/${id}`).catch(() => []),
    ])
      .then(([emp, assignRes, issuanceRes, onboardingRes]) => {
        setDetail(emp);
        const empAssignments = assignRes.data.filter((a: AssignmentInfo) => a.employeeId === id);
        const active = empAssignments.find((a: AssignmentInfo) => a.status === 'active') || null;
        setCurrentAssignment(active);
        setAssignmentHistory(empAssignments);
        setDocumentIssuances(issuanceRes);
        setOnboardingDocuments(onboardingRes);
      })
      .catch((err) => {
        console.error('Failed to fetch employee detail:', err);
        setError(err?.message || '社員情報の取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-secondary">読み込み中...</div>;
  }

  if (error || !detail) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-red-500 mb-4">{error || '社員が見つかりません'}</p>
        <button onClick={() => router.push('/admin/employees')} className="btn-outline text-sm py-2">一覧に戻る</button>
      </div>
    );
  }

  const d = detail;
  const fullName = `${d.lastName} ${d.firstName}`;
  const kana = d.lastNameKana && d.firstNameKana ? `${d.lastNameKana} ${d.firstNameKana}` : null;
  const st = statusBadge[d.status] || { label: d.status, cls: 'badge-wait' };
  const initials = `${d.lastName.charAt(0)}${d.firstName.charAt(0)}`;

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">社員詳細</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/admin/employees')} className="btn-outline text-sm py-2">一覧に戻る</button>
          <button onClick={() => router.push(`/admin/employees/${id}/edit`)} className="btn-outline text-sm py-2">編集</button>
          <button onClick={() => router.push(`/admin/employees/${id}/meeting/new`)} className="btn-primary text-sm py-2">面談追加</button>
        </div>
      </div>

      {/* プロフィールヘッダー */}
      <div className="card p-5 mb-5 flex items-center gap-5 flex-wrap">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base font-medium flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-[140px]">
          <div className="text-lg font-medium">{fullName}</div>
          {kana && <div className="text-xs text-secondary mt-0.5">{kana}</div>}
        </div>
        <div className="flex gap-2">
          <span className={`badge ${st.cls}`}>{st.label}</span>
          {contractBadgeEl(d.contractType)}
        </div>
        <div className="flex gap-6 flex-wrap text-sm text-secondary ml-auto">
          <span>在籍 {calcTenure(d.hireDate)}</span>
        </div>
      </div>

      {/* 現在の稼働 / 給与・口座 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <SectionCard title="現在の稼働">
          {currentAssignment ? (
            <>
              <InfoRow label="クライアント" value={currentAssignment.client?.name} />
              <InfoRow label="案件" value={currentAssignment.projectName} />
              <InfoRow label="契約単価" value={fmtCurrency(currentAssignment.contractPrice)} />
              <InfoRow label="精算幅" value={`${currentAssignment.settlementLower}〜${currentAssignment.settlementUpper}h`} />
              <InfoRow label="契約期間" value={`${fmtDate(currentAssignment.startDate)} 〜 ${fmtDate(currentAssignment.endDate)}`} />
              <InfoRow label="勤務地" value={currentAssignment.workLocation} />
            </>
          ) : (
            <div className="text-sm text-secondary py-2">現在の稼働はありません</div>
          )}
        </SectionCard>

        <SectionCard title="給与・口座">
          <InfoRow label="月額給与" value={
            d.baseSalary ? <span className="font-medium text-primary">{fmtCurrency(d.baseSalary)}</span> : '基本給のみ'
          } />
          <InfoRow label="還元率" value={d.rewardRate !== null && d.rewardRate !== undefined ? `${d.rewardRate}%` : null} />
          <InfoRow label="振込口座" value={
            canViewPii
              ? (d.bankName
                  ? `${d.bankName} ${d.bankBranch || ''} ${accountTypeLabel[d.bankAccountType || ''] || ''} ${d.bankAccountNumber || ''}`
                  : null)
              : <span className="text-secondary text-xs">閲覧権限がありません</span>
          } />
          <InfoRow label="賞与支給" value={
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              d.hasBonus
                ? 'bg-status-green-bg text-status-green-text'
                : 'bg-muted text-secondary'
            }`}>
              {d.hasBonus ? 'あり' : 'なし'}
            </span>
          } />
          <InfoRow label="書類フォルダ" value="--" />
        </SectionCard>
      </div>

      {/* 基本情報 / 連絡先 / 稼働ヒストリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <SectionCard title="基本情報">
          <InfoRow label="社員番号" value={d.employeeCode} />
          <InfoRow label="部署" value={d.department?.name} />
          <InfoRow label="役職" value={d.position?.name} />
          <InfoRow label="雇用形態" value={empTypeLabel[d.employmentType] || d.employmentType} />
          <InfoRow label="雇用区分" value={contractBadgeEl(d.contractType)} />
          <InfoRow label="生年月日" value={fmtDate(d.birthDate)} />
          <InfoRow label="年齢" value={calcAge(d.birthDate)} />
          <InfoRow label="性別" value={d.gender ? (genderLabel[d.gender] || d.gender) : null} />
          <InfoRow label="血液型" value={d.bloodType} />
          <InfoRow label="最終学歴" value={d.education} />
          <InfoRow label="学校名" value={d.schoolName} />
          <InfoRow label="入社日" value={fmtDate(d.hireDate)} />
          <InfoRow label="勤続年数" value={calcTenure(d.hireDate)} />
          <InfoRow label="保有資格" value={(() => {
            const quals = Array.isArray(d.qualifications)
              ? d.qualifications
                  .map((q) => {
                    if (typeof q === 'string') return q;
                    if (q && typeof q === 'object' && 'name' in q && typeof q.name === 'string') {
                      return q.name;
                    }
                    return null;
                  })
                  .filter((q): q is string => Boolean(q))
              : [];
            if (quals.length === 0) return '--';
            return (
              <div className="flex flex-wrap gap-1 justify-end">
                {quals.map((q, i) => (
                  <span key={i} className="bg-primary/8 text-primary rounded px-1.5 py-0.5 text-xs">{q}</span>
                ))}
              </div>
            );
          })()} />
        </SectionCard>

        <SectionCard title="連絡先">
          <InfoRow label="メール" value={d.email} />
          <InfoRow label="電話" value={d.phone} />
          <InfoRow label="住所" value={d.address} />
          {d.emergencyContacts && d.emergencyContacts.length > 0 ? (
            <>
              <InfoRow label="緊急連絡先" value={`${d.emergencyContacts[0].name}（${d.emergencyContacts[0].relationship}）`} />
              <InfoRow label="緊急連絡先TEL" value={d.emergencyContacts[0].phone} />
            </>
          ) : (
            <>
              <InfoRow label="緊急連絡先" value={null} />
              <InfoRow label="緊急連絡先TEL" value={null} />
            </>
          )}
        </SectionCard>

        <SectionCard title="稼働ヒストリー">
          {assignmentHistory.length === 0 ? (
            <div className="text-sm text-secondary py-2">履歴なし</div>
          ) : (
            <div className="space-y-2">
              {assignmentHistory.map((a) => {
                const stLabel = a.status === 'active' ? '稼働中' : '終了';
                const stCls = a.status === 'active' ? 'badge-ok' : 'badge-wait';
                return (
                  <div key={a.id} className="border-b border-border/15 pb-2 last:border-b-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{a.client?.name}</span>
                      <span className={`badge ${stCls} text-2xs`}>{stLabel}</span>
                    </div>
                    <div className="text-2xs text-secondary">{a.projectName}</div>
                    <div className="text-2xs text-secondary">{fmtDate(a.startDate)} 〜 {fmtDate(a.endDate)}　{fmtCurrency(a.contractPrice)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 勤怠履歴（月別） */}
      <div className="card p-5 mb-5">
        <div className="text-2xs text-secondary uppercase tracking-widest mb-3">勤怠履歴（月別）</div>
        <div className="overflow-x-auto">
          {!d.attendanceSummary || d.attendanceSummary.length === 0 ? (
            <div className="text-sm text-secondary py-2">勤怠履歴はありません</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  {['年月', '出勤日数', '稼働時間', '残業時間', '打刻漏れ', '遅刻', '欠勤'].map(h => (
                    <th key={h} className="text-left text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.attendanceSummary.map(m => (
                  <tr key={m.yearMonth} className="border-b border-border/20">
                    <td className="px-3 py-2 text-sm font-medium">{m.yearMonth}</td>
                    <td className="px-3 py-2 text-sm">{m.workDays}日</td>
                    <td className="px-3 py-2 text-sm">{Math.floor(m.totalWorkMinutes / 60)}h{m.totalWorkMinutes % 60 > 0 ? `${m.totalWorkMinutes % 60}m` : ''}</td>
                    <td className="px-3 py-2 text-sm">{m.totalOvertimeMinutes > 0 ? `${Math.floor(m.totalOvertimeMinutes / 60)}h${m.totalOvertimeMinutes % 60 > 0 ? `${m.totalOvertimeMinutes % 60}m` : ''}` : '--'}</td>
                    <td className={`px-3 py-2 text-sm ${m.missedClockCount > 0 ? 'text-red-600 font-medium' : ''}`}>{m.missedClockCount > 0 ? m.missedClockCount : '--'}</td>
                    <td className={`px-3 py-2 text-sm ${m.lateCount > 0 ? 'text-amber-600 font-medium' : ''}`}>{m.lateCount > 0 ? m.lateCount : '--'}</td>
                    <td className={`px-3 py-2 text-sm ${m.absentCount > 0 ? 'text-red-600 font-medium' : ''}`}>{m.absentCount > 0 ? m.absentCount : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 勤怠アラート履歴 / 面談記録 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <SectionCard title="勤怠アラート履歴">
          {(() => {
            const alerts = (d.attendanceSummary || []).filter(
              m => m.missedClockCount > 0 || m.lateCount > 0 || m.absentCount > 0,
            );
            if (alerts.length === 0) {
              return <div className="text-sm text-secondary py-2">アラート履歴はありません</div>;
            }
            return (
              <div className="space-y-2">
                {alerts.map(m => (
                  <div key={m.yearMonth} className="border-b border-border/15 pb-2 last:border-b-0 last:pb-0">
                    <div className="text-sm font-medium mb-1">{m.yearMonth}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {m.missedClockCount > 0 && <span className="text-red-600">打刻漏れ {m.missedClockCount}回</span>}
                      {m.lateCount > 0 && <span className="text-amber-600">遅刻 {m.lateCount}回</span>}
                      {m.absentCount > 0 && <span className="text-red-600">欠勤 {m.absentCount}回</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </SectionCard>

        <SectionCard title="面談記録">
          {!d.meetings || d.meetings.length === 0 ? (
            <div className="text-sm text-secondary py-2">面談記録はありません</div>
          ) : (
            <div className="space-y-3">
              {d.meetings.map(m => (
                <div key={m.id} className="border-b border-border/15 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{fmtDate(m.date)}</span>
                    <span className="text-xs text-secondary">面談者: {m.interviewer}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  {m.videoUrl && (
                    <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5">
                      <span>&#9654;</span><span>録画を見る</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 年次有給休暇 */}
      <div className="card p-5 mb-5">
        <div className="text-2xs text-secondary uppercase tracking-widest mb-3">年次有給休暇</div>
        {!d.leaveBalances || d.leaveBalances.length === 0 ? (
          <div>
            <div className="text-sm text-secondary py-2">有給データがありません（入社6ヶ月未満の場合は付与前）</div>
            <div className="text-2xs text-secondary mt-2">※ 付与日数は労働基準法に基づき入社日から起算。有効期限は付与日から2年間。</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-border">
                  {['付与日', '有効期限', '付与日数', '使用日数', '残日数'].map(h => (
                    <th key={h} className="text-left text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.leaveBalances.map(lb => {
                  const isExpired = new Date(lb.expiryDate) < new Date();
                  return (
                    <tr key={lb.id} className={`border-b border-border/20 ${isExpired ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 text-sm">{fmtDate(lb.grantedDate)}</td>
                      <td className="px-3 py-2 text-sm">{fmtDate(lb.expiryDate)}{isExpired && <span className="text-red-500 ml-1 text-xs">期限切れ</span>}</td>
                      <td className="px-3 py-2 text-sm">{lb.grantedDays}日</td>
                      <td className="px-3 py-2 text-sm">{lb.usedDays}日</td>
                      <td className="px-3 py-2 text-sm font-medium">{lb.remainingDays}日</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 発行済み通知書・書類 */}
      <div className="card p-5 mb-5">
        <div className="text-2xs text-secondary uppercase tracking-widest mb-3">発行済み通知書・書類</div>
        <div className="space-y-5">
          <div>
            <div className="text-sm font-medium mb-2">通知書発行履歴</div>
            {documentIssuances.length === 0 ? (
              <div className="text-sm text-secondary py-2">通知書の発行履歴はありません</div>
            ) : (
              <div className="space-y-2">
                {documentIssuances.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border/15 last:border-b-0"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium">
                          {issuanceTypeLabel[doc.documentType] || doc.documentType}
                        </div>
                        {doc.workflowStatus && (
                          <span className={`badge ${issuanceWorkflowLabel[doc.workflowStatus].cls} text-2xs`}>
                            {issuanceWorkflowLabel[doc.workflowStatus].label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-secondary">
                        {fmtDate(doc.issuedAt)} / {doc.fileName}
                      </div>
                      {(doc.deliveredAt || doc.acknowledgedAt || doc.workflowNote) && (
                        <div className="text-xs text-secondary mt-1 space-y-0.5">
                          {doc.deliveredAt && <div>送付日: {fmtDate(doc.deliveredAt)}</div>}
                          {doc.acknowledgedAt && <div>承諾日: {fmtDate(doc.acknowledgedAt)}</div>}
                          {doc.workflowNote && <div>メモ: {doc.workflowNote}</div>}
                        </div>
                      )}
                    </div>
                    {doc.driveViewLink ? (
                      <a
                        href={doc.driveViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline text-xs py-1.5 px-3"
                      >
                        Driveで開く
                      </a>
                    ) : (
                      <span className="badge badge-wait">Drive未連携</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">入社書類アップロード履歴</div>
            {onboardingDocuments.length === 0 ? (
              <div className="text-sm text-secondary py-2">入社書類のアップロード履歴はありません</div>
            ) : (
              <div className="space-y-2">
                {onboardingDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border/15 last:border-b-0"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {onboardingDocumentLabel[doc.documentType] || doc.documentType}
                      </div>
                      <div className="text-xs text-secondary">
                        {fmtDate(doc.uploadedAt)} / {doc.fileName}
                      </div>
                    </div>
                    {doc.driveViewLink ? (
                      <a
                        href={doc.driveViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline text-xs py-1.5 px-3"
                      >
                        Driveで開く
                      </a>
                    ) : (
                      <span className="badge badge-wait">Drive未連携</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {d.certificates && d.certificates.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">各種証明書</div>
              <div className="space-y-2">
                {d.certificates.map((c) => {
                  const st = certStatusLabel[c.status] || { label: c.status, cls: 'badge-wait' };
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 border-b border-border/15 last:border-b-0"
                    >
                      <div>
                        <span className="text-sm font-medium">
                          {certTypeLabel[c.certType] || c.certType}
                        </span>
                        {c.issuedAt && (
                          <span className="text-xs text-secondary ml-2">{fmtDate(c.issuedAt)}</span>
                        )}
                      </div>
                      <span className={`badge ${st.cls} text-2xs`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
