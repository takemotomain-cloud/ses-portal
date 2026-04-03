'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

type Candidate = {
  id: string;
  name: string;
  kana: string;
  applyDate: string;
  status: string;
  position: string;
  source: string;
  sourceName: string;
  firstInterview: string;
  firstInterviewer: string;
  firstConfirm: string;
  finalInterview: string;
  age: string;
  gender: string;
  address: string;
  education: string;
  phone: string;
  desiredLocation: string;
  desiredMonth: string;
  history: { status: string; date: string; memo: string }[];
};

const candidates: Candidate[] = [
  { id: '1', name: '田村 健一', kana: 'タムラ ケンイチ', applyDate: '2026年3月25日', status: '一次面接待ち', position: 'SESエンジニア', source: 'エージェント', sourceName: 'テックエージェント', firstInterview: '2026年4月1日 10時00分', firstInterviewer: '山本 浩二', firstConfirm: '確認済', finalInterview: '', age: '28歳', gender: '男性', address: '東京都世田谷区', education: '大卒（工学部）', phone: '090-1234-5678', desiredLocation: '東京都', desiredMonth: '2026年5月', history: [{ status: '一次面接待ち', date: '2026年3月26日', memo: '面接日程を調整' }, { status: '書類選考', date: '2026年3月25日', memo: '応募受付' }] },
  { id: '2', name: '岸田 美優', kana: 'キシダ ミユ', applyDate: '2026年3月15日', status: '最終面接待ち', position: 'インフラエンジニア', source: '媒体', sourceName: 'Green', firstInterview: '2026年3月20日 14時00分', firstInterviewer: '田辺 恵子', firstConfirm: '確認済', finalInterview: '2026年4月1日 13時00分', age: '32歳', gender: '女性', address: '神奈川県横浜市', education: '大卒（情報工学）', phone: '080-2345-6789', desiredLocation: '東京都・神奈川県', desiredMonth: '2026年5月', history: [{ status: '最終面接待ち', date: '2026年3月21日', memo: '一次通過' }, { status: '一次面接待ち', date: '2026年3月16日', memo: '' }, { status: '書類選考', date: '2026年3月15日', memo: '' }] },
  { id: '3', name: '中島 大樹', kana: 'ナカジマ ダイキ', applyDate: '2026年3月28日', status: '一次面接待ち', position: 'SESエンジニア', source: 'リファラル', sourceName: '社員紹介（佐藤）', firstInterview: '2026年4月1日 16時00分', firstInterviewer: '山本 浩二', firstConfirm: '未確認', finalInterview: '', age: '25歳', gender: '男性', address: '東京都杉並区', education: '大卒（理学部）', phone: '090-3456-7890', desiredLocation: '東京都', desiredMonth: '2026年6月', history: [{ status: '一次面接待ち', date: '2026年3月29日', memo: '' }, { status: '書類選考', date: '2026年3月28日', memo: '社員紹介' }] },
  { id: '4', name: '松岡 涼太', kana: 'マツオカ リョウタ', applyDate: '2026年3月30日', status: '書類選考', position: 'SESエンジニア', source: 'エージェント', sourceName: 'ITキャリア', firstInterview: '', firstInterviewer: '', firstConfirm: '', finalInterview: '', age: '27歳', gender: '男性', address: '東京都新宿区', education: '専門卒', phone: '070-4567-8901', desiredLocation: '東京都', desiredMonth: '', history: [{ status: '書類選考', date: '2026年3月30日', memo: '応募受付' }] },
  { id: '5', name: '柳澤 真帆', kana: 'ヤナギサワ マホ', applyDate: '2026年3月30日', status: '書類選考', position: 'インフラエンジニア', source: 'エージェント', sourceName: 'エンジニアパートナーズ', firstInterview: '', firstInterviewer: '', firstConfirm: '', finalInterview: '', age: '30歳', gender: '女性', address: '千葉県船橋市', education: '大卒（経済学部）', phone: '080-5678-9012', desiredLocation: '東京都・千葉県', desiredMonth: '', history: [{ status: '書類選考', date: '2026年3月30日', memo: '' }] },
  { id: '6', name: '吉村 翔', kana: 'ヨシムラ ショウ', applyDate: '2026年3月22日', status: '一次面接待ち', position: 'SESエンジニア', source: 'エージェント', sourceName: 'テックエージェント', firstInterview: '2026年4月3日 10時00分', firstInterviewer: '田辺 恵子', firstConfirm: '未確認', finalInterview: '', age: '26歳', gender: '男性', address: '東京都品川区', education: '大卒（工学部）', phone: '090-6789-0123', desiredLocation: '東京都', desiredMonth: '2026年5月', history: [{ status: '一次面接待ち', date: '2026年3月23日', memo: '' }, { status: '書類選考', date: '2026年3月22日', memo: '' }] },
  { id: '7', name: '長谷川 翼', kana: 'ハセガワ ツバサ', applyDate: '2026年3月1日', status: '内定承諾', position: 'インフラエンジニア', source: 'エージェント', sourceName: 'テックエージェント', firstInterview: '2026年3月8日 10時00分', firstInterviewer: '山本 浩二', firstConfirm: '確認済', finalInterview: '2026年3月15日 14時00分', age: '29歳', gender: '男性', address: '埼玉県さいたま市', education: '大卒（情報工学）', phone: '080-7890-1234', desiredLocation: '東京都・埼玉県', desiredMonth: '2026年4月', history: [{ status: '内定承諾', date: '2026年3月20日', memo: '入社予定: 4月1日' }, { status: '内定出し', date: '2026年3月16日', memo: '' }, { status: '最終面接待ち', date: '2026年3月9日', memo: '' }, { status: '一次面接待ち', date: '2026年3月2日', memo: '' }, { status: '書類選考', date: '2026年3月1日', memo: '' }] },
  { id: '8', name: '野口 理恵', kana: 'ノグチ リエ', applyDate: '2026年3月10日', status: '不採用', position: 'SESエンジニア', source: '媒体', sourceName: 'Wantedly', firstInterview: '2026年3月12日 15時00分', firstInterviewer: '田辺 恵子', firstConfirm: '確認済', finalInterview: '', age: '24歳', gender: '女性', address: '東京都目黒区', education: '大卒（文学部）', phone: '090-8901-2345', desiredLocation: '東京都', desiredMonth: '', history: [{ status: '不採用', date: '2026年3月13日', memo: 'スキルミスマッチ' }, { status: '一次面接待ち', date: '2026年3月11日', memo: '' }, { status: '書類選考', date: '2026年3月10日', memo: '' }] },
  { id: '9', name: '佐野 美香', kana: 'サノ ミカ', applyDate: '2026年3月5日', status: '内定出し', position: 'SESエンジニア', source: 'エージェント', sourceName: 'テックエージェント', firstInterview: '2026年3月15日 10時00分', firstInterviewer: '山本 浩二', firstConfirm: '確認済', finalInterview: '2026年3月22日 14時00分', age: '31歳', gender: '女性', address: '東京都渋谷区', education: '大卒（理工学部）', phone: '080-9012-3456', desiredLocation: '東京都', desiredMonth: '2026年5月', history: [{ status: '内定出し', date: '2026年3月23日', memo: '回答期限: 4月5日' }, { status: '最終面接待ち', date: '2026年3月16日', memo: '' }, { status: '一次面接待ち', date: '2026年3月6日', memo: '' }, { status: '書類選考', date: '2026年3月5日', memo: '' }] },
  { id: '10', name: '河合 陽子', kana: 'カワイ ヨウコ', applyDate: '2026年3月8日', status: '内定出し', position: 'インフラエンジニア', source: '媒体', sourceName: 'Green', firstInterview: '2026年3月18日 13時00分', firstInterviewer: '田辺 恵子', firstConfirm: '確認済', finalInterview: '2026年3月26日 10時00分', age: '33歳', gender: '女性', address: '神奈川県川崎市', education: '大卒（情報科学）', phone: '070-0123-4567', desiredLocation: '東京都・神奈川県', desiredMonth: '2026年5月', history: [{ status: '内定出し', date: '2026年3月27日', memo: '' }, { status: '最終面接待ち', date: '2026年3月19日', memo: '' }, { status: '一次面接待ち', date: '2026年3月9日', memo: '' }, { status: '書類選考', date: '2026年3月8日', memo: '' }] },
];

const statusBadge: Record<string, string> = {
  '一次面接待ち': 'badge-warn',
  '最終面接待ち': 'badge-warn',
  '書類選考': 'badge-info',
  '内定承諾': 'badge-ok',
  '不採用': 'badge-danger',
  '内定出し': 'badge-warn',
};

const sourceBadge: Record<string, string> = {
  'エージェント': 'badge-info',
  '媒体': 'badge-warn',
  'リファラル': 'badge-ok',
};

const statuses = ['一次面接待ち', '最終面接待ち', '書類選考', '内定承諾', '不採用', '内定出し'];
const sources = ['エージェント', '媒体', 'リファラル'];

export default function RecruitCandidatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (search && !c.name.includes(search) && !c.kana.includes(search)) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      return true;
    });
  }, [search, statusFilter, sourceFilter]);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">候補者一覧</h1>
        <div className="flex gap-2">
          <button onClick={() => toast('CSVインポートは今後追加予定です')} className="btn-outline text-sm py-2">CSVインポート</button>
          <button onClick={() => router.push('/admin/recruit-candidates/new')} className="btn-primary text-sm py-2">候補者を追加</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          type="text"
          placeholder="名前・フリガナ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[180px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none"
        >
          <option value="">ステータス: すべて</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none"
        >
          <option value="">経路: すべて</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-sm text-secondary self-center">全{filtered.length}件</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[900px]" style={{ whiteSpace: 'nowrap' }}>
          <thead>
            <tr className="border-b border-border">
              {['応募日', 'ステータス', '氏名', '応募求人', '一次面接日時', '最終面接日時', '経路', '詳細'].map((h) => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCandidate(c)}
                  className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-sm text-secondary">{c.applyDate}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                  <td className="px-4 py-2.5"><div className="text-base font-medium">{c.name}</div><div className="text-sm text-secondary mt-0.5">{c.kana}</div></td>
                  <td className="px-4 py-2.5 text-sm">{c.position}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{c.firstInterview || <span className="text-secondary italic">—</span>}{c.firstConfirm && <> <span className={`badge ${c.firstConfirm === '確認済' ? 'badge-ok' : 'badge-wait'}`}>{c.firstConfirm}</span></>}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{c.finalInterview || <span className="text-secondary italic">—</span>}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${sourceBadge[c.source]}`}>{c.source}</span></td>
                  <td className="px-4 py-2.5">
                    <button
                      className="btn-outline text-xs py-1 px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCandidate(c);
                      }}
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Side Panel */}
      {selectedCandidate && (
        <>
          <div
            className="fixed inset-0 bg-black/8 z-[99] transition-opacity duration-300"
            onClick={() => setSelectedCandidate(null)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto transition-transform duration-300 translate-x-0">
            {/* Panel Header */}
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <div className="text-xl font-medium">{selectedCandidate.name}</div>
                <div className="text-sm text-secondary mt-0.5">{selectedCandidate.kana}</div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* 応募情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">応募情報</div>
                {[
                  ['応募日', selectedCandidate.applyDate],
                  ['応募求人', selectedCandidate.position],
                  ['応募経路', selectedCandidate.sourceName],
                  ['ステータス', null],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    {label === 'ステータス' ? (
                      <span className={`badge ${statusBadge[selectedCandidate.status] || 'badge-wait'}`}>{selectedCandidate.status}</span>
                    ) : (
                      <span className="text-right">{value}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* 基本情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">基本情報</div>
                {[
                  ['年齢', selectedCandidate.age],
                  ['性別', selectedCandidate.gender],
                  ['居住地', selectedCandidate.address],
                  ['最終学歴', selectedCandidate.education],
                  ['電話番号', selectedCandidate.phone],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* 面接状況 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">面接状況</div>
                {[
                  ['一次面接', selectedCandidate.firstInterview || '未設定'],
                  ['一次面接官', selectedCandidate.firstInterviewer || '—'],
                  ['一次確認', selectedCandidate.firstConfirm || '—'],
                  ['最終面接', selectedCandidate.finalInterview || '未設定'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* 希望条件 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">希望条件</div>
                {[
                  ['希望勤務地', selectedCandidate.desiredLocation || '—'],
                  ['希望入社月', selectedCandidate.desiredMonth || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-[5px] border-b border-border/20 text-base gap-3">
                    <span className="text-secondary whitespace-nowrap">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* ステータス履歴 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">ステータス履歴</div>
                {selectedCandidate.history.map((h, i) => (
                  <div key={i} className="py-2 border-b border-border/20">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium">{h.status}</span>
                      <span className="text-sm text-secondary">{h.date}</span>
                    </div>
                    {h.memo && <div className="text-sm text-secondary mt-0.5">{h.memo}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Panel Actions */}
            <div className="flex gap-2 p-5 border-t border-border/30">
              <button onClick={() => toast('編集機能は今後追加予定です')} className="btn-outline flex-1 text-sm py-2">編集</button>
              <button onClick={() => toast('ステータス更新は今後追加予定です')} className="btn-primary flex-1 text-sm py-2">ステータス更新</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
