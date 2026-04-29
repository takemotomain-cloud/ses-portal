/**
 * 就業規則ページ（社員側）
 *
 * UIモックのpage-emp-rulesを再現。
 * 全6章アコーディオン形式。タップで開閉、＋アイコンが回転。
 * API連携後はGET /api/rules/currentからデータ取得。
 */

'use client';

import { useState } from 'react';

interface Article {
  num: string;
  name: string;
  text: string;
}

interface Chapter {
  title: string;
  articles: Article[];
}

// Phase 1: デモデータ。API連携後にwork_rules.contentから取得
const rulesData: Chapter[] = [
  {
    title: '第1章 総則',
    articles: [
      { num: '第1条', name: '目的', text: 'この規則は、株式会社○○○（以下「会社」という）の従業員の労働条件、服務規律その他の就業に関する事項を定めるものである。' },
      { num: '第2条', name: '適用範囲', text: 'この規則は、会社に勤務するすべての従業員に適用する。ただし、パートタイム従業員については別に定めるところによる。' },
      { num: '第3条', name: '規則の遵守', text: '会社および従業員は、この規則を遵守し、相互に協力して業務の円滑な運営に努めなければならない。' },
    ],
  },
  {
    title: '第2章 採用・異動',
    articles: [
      { num: '第4条', name: '採用', text: '会社は、入社を希望する者のうち、所定の選考に合格した者を採用する。' },
      { num: '第5条', name: '試用期間', text: '新たに採用した従業員については、採用の日から3ヶ月間を試用期間とする。試用期間中または試用期間満了時に従業員として不適格と認められた者は、解雇することがある。' },
      { num: '第6条', name: '配置転換・出向', text: '会社は、業務上の必要がある場合、従業員に対して配置転換、職種変更、出向を命ずることがある。従業員は正当な理由なくこれを拒否することはできない。' },
    ],
  },
  {
    title: '第3章 勤務時間・休日・休暇',
    articles: [
      { num: '第7条', name: '勤務時間', text: '所定労働時間は1日8時間、1週40時間とする。始業時刻は9時00分、終業時刻は18時00分とする。ただし、客先常駐の場合は客先の勤務時間に従うものとする。' },
      { num: '第8条', name: '休憩', text: '労働時間が6時間を超える場合は45分、8時間を超える場合は1時間の休憩を労働時間の途中に与える。' },
      { num: '第9条', name: '休日', text: '休日は次のとおりとする。土曜日、日曜日、国民の祝日、年末年始（12月29日〜1月3日）、その他会社が指定する日。' },
      { num: '第10条', name: '年次有給休暇', text: '入社後6ヶ月間継続勤務し、所定労働日の8割以上出勤した従業員に対し、10日の年次有給休暇を与える。以後、勤続年数に応じて法定のとおり付与する。有給休暇の有効期間は付与日から2年間とする。' },
    ],
  },
  {
    title: '第4章 給与・賞与',
    articles: [
      { num: '第11条', name: '給与の構成', text: '給与は基本給、諸手当および時間外手当で構成する。基本給は、契約単価に還元率を乗じて算定する。' },
      { num: '第12条', name: '給与の支払い', text: '給与は毎月末日に締め切り、翌月25日に本人名義の金融機関口座に振り込む方法により支払う。支払日が休日にあたる場合は、その前日に支払う。' },
      { num: '第13条', name: '時間外勤務手当', text: '所定労働時間を超えて勤務させた場合、精算幅の範囲内は基本給に含むものとし、精算幅の上限を超えた時間について時間外手当を支給する。' },
    ],
  },
  {
    title: '第5章 服務規律',
    articles: [
      { num: '第14条', name: '服務心得', text: '従業員は、職務上の責任を自覚し、誠実に業務を遂行するとともに、会社の指示命令に従い、職場の秩序維持に努めなければならない。' },
      { num: '第15条', name: '機密保持', text: '従業員は、在職中および退職後においても、業務上知り得た会社および客先の機密情報を漏洩してはならない。' },
      { num: '第16条', name: 'ハラスメントの禁止', text: 'セクシュアルハラスメント、パワーハラスメント、マタニティハラスメントその他一切のハラスメント行為を禁止する。' },
    ],
  },
  {
    title: '第6章 退職・解雇',
    articles: [
      { num: '第17条', name: '退職', text: '従業員が退職しようとするときは、退職希望日の1ヶ月前までに所属長に届け出なければならない。' },
      { num: '第18条', name: '解雇', text: '従業員が次の各号に該当する場合は解雇することがある。身体または精神の障害により業務に耐えられないと認められた場合、勤務成績が著しく不良で改善の見込みがない場合、その他前各号に準ずるやむを得ない事由がある場合。' },
    ],
  },
];

export default function RulesPage() {
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set());

  function toggleChapter(idx: number) {
    setOpenChapters(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-md font-bold text-primary">就業規則</h2>
        <span className="text-sm text-secondary">2025年4月1日改定</span>
      </div>

      <div className="card p-0">
        {rulesData.map((chapter, ci) => {
          const isOpen = openChapters.has(ci);
          return (
            <div key={ci} className={ci < rulesData.length - 1 ? 'border-b border-border-light' : ''}>
              <button
                onClick={() => toggleChapter(ci)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-page transition-colors text-left"
              >
                <span className="text-md font-semibold">{chapter.title}</span>
                <span className={`text-xl text-secondary font-light transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>
                  ＋
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4">
                  {chapter.articles.map((art, ai) => (
                    <div key={ai} className={`py-2.5 ${ai > 0 ? 'border-t border-border-light' : ''}`}>
                      <div className="text-sm font-semibold text-secondary mb-1">
                        {art.num}（{art.name}）
                      </div>
                      <div className="text-base text-primary leading-relaxed">
                        {art.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
