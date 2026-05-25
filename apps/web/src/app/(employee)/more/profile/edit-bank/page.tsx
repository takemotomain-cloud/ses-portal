/**
 * 口座情報変更ページ（API連携版）
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function EditBankPage() {
  const router = useRouter();
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState('ordinary');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<any>('/profile')
      .then((profile) => {
        setBankName(profile.bankName || '');
        setBranchName(profile.bankBranch || '');
        setAccountType(profile.bankAccountType || 'ordinary');
        setAccountNumber(profile.bankAccountNumber || '');
        setAccountHolder(profile.bankAccountHolder || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSave() {
    if (!bankName || !accountNumber) return;
    apiClient('/profile/bank', {
      method: 'POST',
      body: JSON.stringify({
        bankName,
        bankBranch: branchName,
        bankAccountType: accountType,
        bankAccountNumber: accountNumber,
        bankAccountHolder: accountHolder,
      }),
    })
      .then(() => {
        setSaved(true);
        setTimeout(() => router.back(), 1500);
      })
      .catch(() => {
        setSaved(true);
        setTimeout(() => router.back(), 1500);
      });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-secondary">読み込み中...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page">‹</button>
        <h1 className="text-lg font-bold text-primary">口座情報変更</h1>
      </div>

      {saved ? (
        <div className="card text-center py-8">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-md font-medium text-primary">申請しました</p>
        </div>
      ) : (
        <>
          <div className="card p-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">銀行名</label>
                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">支店名</label>
                <input type="text" value={branchName} onChange={(e) => setBranchName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">口座種別</label>
                <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary">
                  <option value="ordinary">普通</option>
                  <option value="checking">当座</option>
                  <option value="savings">貯蓄</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">口座番号</label>
                <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">口座名義（カナ）</label>
                <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={!bankName || !accountNumber} className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 disabled:opacity-35 transition-all">申請する</button>
        </>
      )}
    </div>
  );
}
