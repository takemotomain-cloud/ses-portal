/**
 * 緊急連絡先・個人情報編集ページ
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EditProfilePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('090-1234-5678');
  const [emergencyName, setEmergencyName] = useState('山本 花子');
  const [emergencyRelation, setEmergencyRelation] = useState('配偶者');
  const [emergencyPhone, setEmergencyPhone] = useState('090-8765-4321');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => router.back(), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page">‹</button>
        <h1 className="text-lg font-bold text-primary">個人情報の編集</h1>
      </div>

      {saved ? (
        <div className="card text-center py-8">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-md font-medium text-primary">保存しました</p>
        </div>
      ) : (
        <>
          <div className="card p-5">
            <h2 className="text-md font-bold text-primary mb-4">連絡先</h2>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">携帯電話番号</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-md font-bold text-primary mb-4">緊急連絡先</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">氏名</label>
                <input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">続柄</label>
                <input type="text" value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">電話番号</label>
                <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
            </div>
          </div>

          <button onClick={handleSave} className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 transition-all">保存する</button>
        </>
      )}
    </div>
  );
}
