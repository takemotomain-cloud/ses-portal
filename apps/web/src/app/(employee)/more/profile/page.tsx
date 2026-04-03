/**
 * 個人情報ページ
 *
 * UIモックのpage-profileを再現。
 * 基本情報・連絡先・口座情報の表示 + 変更メニューへのリンク。
 */

'use client';

import Link from 'next/link';

const profileData = {
  name: '田中 太郎',
  nameKana: 'タナカ タロウ',
  code: 'EMP-012',
  birthDate: '1997年5月15日',
  gender: '男性',
  hireDate: '2022年4月1日',
  department: 'エンジニアリング課',
  employmentType: '正社員',
  email: 't.tanaka@example.com',
  phone: '090-1234-5678',
  postalCode: '541-0053',
  address: '大阪府大阪市中央区本町1-1-1 ○○マンション201',
  bankName: '三菱UFJ銀行',
  bankBranch: '梅田支店',
  bankAccountType: '普通',
  bankAccountNumber: '****567',
  bankAccountHolder: 'タナカ タロウ',
  emergencyContact1: { name: '田中 花子', relationship: '母', phone: '06-1234-5678' },
};

export default function ProfilePage() {
  return (
    <div className="space-y-5">
      {/* 基本情報 */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-2 px-1">基本情報</h2>
        <div className="card p-4 space-y-2.5">
          {[
            ['氏名', profileData.name],
            ['氏名（カナ）', profileData.nameKana],
            ['社員番号', profileData.code],
            ['生年月日', profileData.birthDate],
            ['性別', profileData.gender],
            ['入社日', profileData.hireDate],
            ['部署', profileData.department],
            ['雇用形態', profileData.employmentType],
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
            ['メール', profileData.email],
            ['電話番号', profileData.phone],
            ['郵便番号', profileData.postalCode],
            ['住所', profileData.address],
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
            ['金融機関', profileData.bankName],
            ['支店名', profileData.bankBranch],
            ['口座種別', profileData.bankAccountType],
            ['口座番号', profileData.bankAccountNumber],
            ['口座名義', profileData.bankAccountHolder],
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
          {[
            ['連絡先1 氏名', profileData.emergencyContact1.name],
            ['続柄', profileData.emergencyContact1.relationship],
            ['電話番号', profileData.emergencyContact1.phone],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-md border-b border-border-light pb-2 last:border-b-0 last:pb-0">
              <span className="text-secondary">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 変更メニュー */}
      <div className="card p-0">
        {[
          { label: '住所変更届', href: '/more/profile/edit-address' },
          { label: '口座変更届', href: '/more/profile/edit-bank' },
          { label: '扶養変更届', href: '/more/profile/edit-dependents' },
          { label: '緊急連絡先変更', href: '/more/profile/edit' },
        ].map((item, idx) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center justify-between px-4 py-3.5 hover:bg-page transition-colors
              ${idx < 3 ? 'border-b border-border-light' : ''}`}
          >
            <span className="text-md text-primary">{item.label}</span>
            <span className="text-lg text-secondary">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
