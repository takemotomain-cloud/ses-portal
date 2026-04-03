/**
 * 住所変更ページ
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EditAddressPage() {
  const router = useRouter();
  const [postalCode, setPostalCode] = useState('150-0001');
  const [address, setAddress] = useState('東京都渋谷区神宮前1-2-3');
  const [building, setBuilding] = useState('ABCマンション 401号室');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!postalCode || !address) return;
    setSaved(true);
    setTimeout(() => router.back(), 1500);
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
          <p className="text-md font-medium text-primary">保存しました</p>
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
          <button onClick={handleSave} disabled={!postalCode || !address} className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 disabled:opacity-35 transition-all">保存する</button>
        </>
      )}
    </div>
  );
}
