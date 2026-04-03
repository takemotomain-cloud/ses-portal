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
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- 型定義 ---------- */

interface EmployeeDetail {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  birthDate: string | null;
  gender: string | null;
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
  emergencyContacts?: { id: string; name: string; relationship: string; phone: string }[];
  dependents?: { id: string; name: string; relationship: string; birthDate: string; annualIncome: number | null }[];
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
  const { toast, ToastUI } = useToast();

  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient<EmployeeDetail>(`/employees/${id}`)
      .then((res) => setDetail(res))
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
          <InfoRow label="クライアント" value="--" />
          <InfoRow label="案件" value="--" />
          <InfoRow label="契約単価" value="--" />
          <InfoRow label="契約期間" value="--" />
          <div className="text-2xs text-secondary mt-2">※ 稼働管理から自動反映（本開発時）</div>
        </SectionCard>

        <SectionCard title="給与・口座">
          <InfoRow label="月額給与" value={
            d.baseSalary ? <span className="font-medium text-primary">{fmtCurrency(d.baseSalary)}</span> : '基本給のみ'
          } />
          <InfoRow label="還元率" value={d.rewardRate !== null && d.rewardRate !== undefined ? `${d.rewardRate}%` : null} />
          <InfoRow label="振込口座" value={
            d.bankName
              ? `${d.bankName} ${d.bankBranch || ''} ${accountTypeLabel[d.bankAccountType || ''] || ''} ${d.bankAccountNumber || ''}`
              : null
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
          <InfoRow label="最終学歴" value={d.education} />
          <InfoRow label="学校名" value={d.schoolName} />
          <InfoRow label="入社日" value={fmtDate(d.hireDate)} />
          <InfoRow label="勤続年数" value={calcTenure(d.hireDate)} />
          <InfoRow label="保有資格" value="--" />
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
          <div className="text-sm text-secondary py-2">履歴なし</div>
          <div className="text-2xs text-secondary mt-2">※ 稼働管理から自動反映（本開発時）</div>
        </SectionCard>
      </div>

      {/* 勤怠履歴（月別） */}
      <div className="card p-5 mb-5">
        <div className="text-2xs text-secondary uppercase tracking-widest mb-3">勤怠履歴（月別）</div>
        <div className="overflow-x-auto">
          <div className="text-sm text-secondary py-2">勤怠履歴はありません</div>
          <div className="text-2xs text-secondary mt-2">※ 勤怠データから自動集計（本開発時）</div>
        </div>
      </div>

      {/* 勤怠アラート履歴 / 面談記録 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <SectionCard title="勤怠アラート履歴">
          <div className="text-sm text-secondary py-2">アラート履歴はありません</div>
        </SectionCard>

        <SectionCard title="面談記録">
          <div className="text-sm text-secondary py-2">面談記録はありません</div>
        </SectionCard>
      </div>

      {/* 年次有給休暇 */}
      <div className="card p-5 mb-5">
        <div className="text-2xs text-secondary uppercase tracking-widest mb-3">年次有給休暇</div>
        <div className="text-sm text-secondary py-2">有給データがありません（入社6ヶ月未満の場合は付与前）</div>
        <div className="text-2xs text-secondary mt-2">※ 残日数・取得日数は承認済みの有給申請から自動計算されます。付与日数は労働基準法に基づき入社日から起算。有効期限は付与日から2年間。</div>
      </div>

      {/* 発行済み通知書・書類 */}
      <div className="card p-5 mb-5">
        <div className="text-2xs text-secondary uppercase tracking-widest mb-3">発行済み通知書・書類</div>
        <div className="text-sm text-secondary py-2">発行済みの通知書はありません</div>
      </div>

      <ToastUI />
    </div>
  );
}
