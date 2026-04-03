/**
 * 採用設定
 *
 * 求人ポジション管理 + 面接テンプレート + メールテンプレート。
 */

'use client';

import { useState } from 'react';

export default function RecruitSettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['求人ポジション', '面接テンプレート', 'メールテンプレート'];

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">採用設定</h1>

      <div className="flex border-b border-border/40 mb-5">
        {tabs.map((tab, idx) => (
          <button key={tab} onClick={() => setActiveTab(idx)} className={`px-5 py-2.5 text-base border-b-2 transition-colors ${activeTab === idx ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* 求人ポジション */}
      {activeTab === 0 && (
        <div>
          <div className="flex justify-end mb-3">
            <button className="btn-primary text-sm py-2">ポジション追加</button>
          </div>
          <div className="card p-0">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {['ポジション名', '雇用形態', '募集人数', 'ステータス', ''].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { name: 'SESエンジニア', type: '正社員', count: 5, active: true },
                  { name: 'インフラエンジニア', type: '正社員', count: 2, active: true },
                  { name: 'PMO支援', type: '契約社員', count: 1, active: false },
                ].map(p => (
                  <tr key={p.name} className="border-b border-border/20">
                    <td className="px-4 py-2.5 text-base font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-base">{p.type}</td>
                    <td className="px-4 py-2.5 text-base text-right">{p.count}名</td>
                    <td className="px-4 py-2.5"><span className={`badge ${p.active ? 'badge-ok' : 'badge-wait'}`}>{p.active ? '募集中' : '停止中'}</span></td>
                    <td className="px-4 py-2.5"><button className="btn-outline text-xs py-1 px-2">編集</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 面接テンプレート */}
      {activeTab === 1 && (
        <div className="card p-5">
          <div className="space-y-4">
            {[
              { name: '一次面接（技術）', items: '自己紹介 → 技術経歴 → 技術質問 → 逆質問', duration: '60分' },
              { name: '二次面接（人物）', items: '志望動機 → キャリアプラン → カルチャーフィット → 条件確認', duration: '45分' },
              { name: '最終面接', items: '代表面談 → 会社説明 → 条件提示', duration: '30分' },
            ].map(t => (
              <div key={t.name} className="p-4 bg-page rounded-lg">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-md font-medium">{t.name}</span>
                  <span className="text-sm text-secondary">{t.duration}</span>
                </div>
                <div className="text-sm text-secondary">{t.items}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* メールテンプレート */}
      {activeTab === 2 && (
        <div className="card p-5">
          <div className="space-y-3">
            {[
              { name: '応募受付完了', subject: '【応募受付】ご応募ありがとうございます' },
              { name: '書類選考結果（通過）', subject: '【書類選考結果】次回面接のご案内' },
              { name: '書類選考結果（不通過）', subject: '【選考結果のご連絡】' },
              { name: '面接日程案内', subject: '【面接日程】面接日時のご確認' },
              { name: '内定通知', subject: '【内定のご連絡】' },
            ].map(t => (
              <div key={t.name} className="flex items-center justify-between p-3 bg-page rounded-lg">
                <div>
                  <div className="text-md font-medium">{t.name}</div>
                  <div className="text-sm text-secondary">{t.subject}</div>
                </div>
                <button className="btn-outline text-xs py-1 px-2">編集</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
