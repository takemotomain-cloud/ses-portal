/**
 * 個人情報ページ（API連携版）
 *
 * /api/profile からログインユーザーの個人情報を取得して表示。
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface ProfileData {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  employeeCode: string;
  birthDate: string;
  gender: string;
  hireDate: string;
  employmentType: string;
  email: string;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  department: { name: string } | null;
  position: { name: string } | null;
  emergencyContacts: { name: string; relationship: string; phone: string }[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const genderLabel: Record<string, string> = { male: '男性', female: '女性', other: 'その他' };
const empTypeLabel: Record<string, string> = { regular: '正社員', contract: '契約社員', parttime: 'パート' };

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<ProfileData>('/profile')
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-secondary">読み込み中...</div>;
  }

  if (!profile) {
    return <div className="flex items-center justify-center py-20 text-sm text-secondary">個人情報を取得できませんでした</div>;
  }

  return (
    <div className="space-y-5">
      {/* 基本情報 */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-2 px-1">基本情報</h2>
        <div className="card p-4 space-y-2.5">
          {[
            ['氏名', `${profile.lastName} ${profile.firstName}`],
            ['氏名（カナ）', `${profile.lastNameKana} ${profile.firstNameKana}`],
            ['社員番号', profile.employeeCode],
            ['生年月日', fmtDate(profile.birthDate)],
            ['性別', genderLabel[profile.gender] || profile.gender],
            ['入社日', fmtDate(profile.hireDate)],
            ['部署', profile.department?.name || '—'],
            ['雇用形態', empTypeLabel[profile.employmentType] || profile.employmentType],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-md border-b border-border-light pb-2 last:border-b-0 last:pb-0">
              <span className="text-secondary">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 連絡先 */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-2 px-1">連絡先</h2>
        <div className="card p-4 space-y-2.5">
          {[
            ['メール', profile.email],
            ['電話番号', profile.phone || '—'],
            ['郵便番号', profile.postalCode || '—'],
            ['住所', profile.address || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-md border-b border-border-light pb-2 last:border-b-0 last:pb-0 gap-4">
              <span className="text-secondary flex-shrink-0">{label}</span>
              <span className="text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 口座情報 */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-2 px-1">口座情報</h2>
        <div className="card p-4 space-y-2.5">
          {[
            ['金融機関', profile.bankName || '—'],
            ['支店名', profile.bankBranch || '—'],
            ['口座種別', profile.bankAccountType || '—'],
            ['口座番号', profile.bankAccountNumber || '—'],
            ['口座名義', profile.bankAccountHolder || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-md border-b border-border-light pb-2 last:border-b-0 last:pb-0">
              <span className="text-secondary">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 緊急連絡先 */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-2 px-1">緊急連絡先</h2>
        <div className="card p-4 space-y-2.5">
          {profile.emergencyContacts.length === 0 ? (
            <div className="text-sm text-secondary">登録されていません</div>
          ) : (
            profile.emergencyContacts.map((ec, i) => (
              <div key={i} className="space-y-2.5">
                {[
                  [`連絡先${i + 1} 氏名`, ec.name],
                  ['続柄', ec.relationship],
                  ['電話番号', ec.phone],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-md border-b border-border-light pb-2 last:border-b-0 last:pb-0">
                    <span className="text-secondary">{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 変更申請ボタン */}
      <Link
        href="/more/profile/edit"
        className="block w-full text-center px-4 py-3 border border-border rounded-lg text-md font-medium text-primary hover:border-secondary transition-colors"
      >
        個人情報の変更を申請する
      </Link>
    </div>
  );
}
