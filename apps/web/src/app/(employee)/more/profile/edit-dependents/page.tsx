/**
 * 扶養変更届ページ
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EditDependentsPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [income, setIncome] = useState('');
  const [changeType, setChangeType] = useState('');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!name || !relation || !changeType) return;
    setSaved(true);
    setTimeout(() => router.back(), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page">‹</button>
        <h1 className="text-lg font-bold text-primary">扶養変更届</h1>
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
                <label className="block text-sm font-medium text-primary mb-1.5">届出区分 <span className="text-status-red-text">*</span></label>
                <select value={changeType} onChange={(e) => setChangeType(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary">
                  <option value="">選択してください</option>
                  <option value="add">追加</option>
                  <option value="remove">削除</option>
                  <option value="change">変更</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">対象者氏名 <span className="text-status-red-text">*</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" placeholder="山本 花子" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">続柄 <span className="text-status-red-text">*</span></label>
                <select value={relation} onChange={(e) => setRelation(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary">
                  <option value="">選択してください</option>
                  <option value="spouse">配偶者</option>
                  <option value="child">子</option>
                  <option value="parent">父母</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">生年月日</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">年間収入見込み</label>
                <input type="text" value={income} onChange={(e) => setIncome(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" placeholder="0" />
                <p className="text-xs text-secondary mt-1">130万円未満が扶養の目安です</p>
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={!name || !relation || !changeType} className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 disabled:opacity-35 transition-all">申請する</button>
        </>
      )}
    </div>
  );
}
