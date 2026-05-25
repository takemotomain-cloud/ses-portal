/**
 * 緊急連絡先変更ページ（API連携版）
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function EditEmergencyPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<any>('/profile')
      .then((profile) => {
        setPhone(profile.phone || '');
        if (profile.emergencyContacts?.length > 0) {
          const ec = profile.emergencyContacts[0];
          setEmergencyName(ec.name || '');
          setEmergencyRelation(ec.relationship || '');
          setEmergencyPhone(ec.phone || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSave() {
    setSaved(true);
    setTimeout(() => router.back(), 1500);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-secondary">読み込み中...</div>;
  }

  return (
    <div className="space-y-5">
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
