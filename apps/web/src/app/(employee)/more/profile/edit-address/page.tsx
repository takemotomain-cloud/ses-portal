/**
 * 住所変更ページ（API連携版）
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function EditAddressPage() {
  const router = useRouter();
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [building, setBuilding] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<any>('/profile')
      .then((profile) => {
        setPostalCode(profile.postalCode || '');
        setAddress(profile.address || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSave() {
    if (!postalCode || !address) return;
    apiClient('/profile/address', {
      method: 'POST',
      body: JSON.stringify({ postalCode, address }),
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
        <h1 className="text-lg font-bold text-primary">住所変更</h1>
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
                <label className="block text-sm font-medium text-primary mb-1.5">郵便番号</label>
                <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" placeholder="000-0000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">住所</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">建物名・部屋番号</label>
                <input type="text" value={building} onChange={(e) => setBuilding(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={!postalCode || !address} className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 disabled:opacity-35 transition-all">申請する</button>
        </>
      )}
    </div>
  );
}
