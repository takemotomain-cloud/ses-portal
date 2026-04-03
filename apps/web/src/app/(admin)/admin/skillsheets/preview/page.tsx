/**
 * 管理側 スキルシートプレビューページ
 *
 * HTMLプロトタイプ page-ss-preview を完全再現。
 * 印刷用フォーマットのスキルシートを表示。
 */

'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- デモデータ ---------- */

const demoData = {
  name: '',
  age: '',
  edu: '',
  exp: '',
  station: '',
  pr: '',
  skills: [] as { cat: string; items: string }[],
  certs: [] as string[],
  projects: [] as { period: string; name: string; client: string; role: string; env: string; detail: string }[],
};

/* ---------- テーブルセルスタイル ---------- */

const thCellCls =
  'px-3 py-2 bg-[#F7F7F5] font-medium w-[120px] border border-black/10 text-left';
const tdCellCls = 'px-3 py-2 border border-black/10';
const projThCls =
  'px-2 py-2 bg-[#F7F7F5] border border-black/10 text-left font-medium text-xs';
const projTdCls = 'px-2 py-2 border border-black/10 text-xs align-top';

/* ---------- メインコンポーネント ---------- */

export default function SkillsheetPreviewPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  const handlePdfDownload = () => {
    window.print();
  };

  return (
    <div>
      {/* ---------- print stylesheet ---------- */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ss-preview-body, #ss-preview-body * { visibility: visible; }
          #ss-preview-body { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2 no-print">
        <h1 className="text-2xl font-medium">スキルシート プレビュー</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/skillsheets')}
            className="btn-outline text-sm py-2"
          >
            一覧に戻る
          </button>
          <button
            onClick={() => router.push('/admin/skillsheets/edit')}
            className="btn-outline text-sm py-2"
          >
            編集する
          </button>
          <button
            onClick={() => toast('Excel出力は今後追加予定です')}
            className="btn-outline text-sm py-2"
          >
            Excelダウンロード
          </button>
          <button
            onClick={handlePdfDownload}
            className="btn-primary text-sm py-2"
          >
            PDFダウンロード
          </button>
        </div>
      </div>

      {/* プレビュー本体 */}
      <div id="ss-preview-body" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="bg-white border border-black/10 rounded-lg p-10 text-[13px] leading-[1.8]">
          {/* タイトル */}
          <div className="text-center mb-8 border-b-2 border-foreground pb-5">
            <div className="text-xl font-semibold tracking-widest">スキルシート</div>
          </div>

          {/* 基本情報テーブル */}
          <table className="w-full border-collapse mb-6 text-[13px]">
            <tbody>
              <tr>
                <td className={thCellCls}>氏名</td>
                <td className={tdCellCls}>{demoData.name}</td>
                <td className={thCellCls}>年齢</td>
                <td className={tdCellCls}>{demoData.age}</td>
              </tr>
              <tr>
                <td className={thCellCls}>最終学歴</td>
                <td className={tdCellCls}>{demoData.edu}</td>
                <td className={thCellCls}>経験年数</td>
                <td className={tdCellCls}>{demoData.exp}</td>
              </tr>
              <tr>
                <td className={thCellCls}>最寄駅</td>
                <td className={tdCellCls} colSpan={3}>
                  {demoData.station}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 自己PR */}
          {demoData.pr && (
            <div className="mb-6">
              <div className="text-sm font-semibold mb-2 pb-1 border-b border-foreground">
                自己PR
              </div>
              <div className="text-[13px] text-[#333] leading-[1.8]">{demoData.pr}</div>
            </div>
          )}

          {/* テクニカルスキル */}
          <div className="mb-6">
            <div className="text-sm font-semibold mb-2 pb-1 border-b border-foreground">
              テクニカルスキル
            </div>
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {demoData.skills.map((sk, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 bg-[#F7F7F5] font-medium w-[100px] border border-black/10">
                      {sk.cat}
                    </td>
                    <td className="px-3 py-1.5 border border-black/10">{sk.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 保有資格 */}
          {demoData.certs.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-semibold mb-2 pb-1 border-b border-foreground">
                保有資格
              </div>
              <div className="text-[13px]">
                {demoData.certs.map((c, i) => (
                  <div key={i} className="py-[3px]">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 業務経歴 */}
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2 pb-1 border-b border-foreground">
              業務経歴
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F7F5]">
                  <th className={projThCls}>期間</th>
                  <th className={projThCls}>案件名 / クライアント</th>
                  <th className={projThCls}>役割</th>
                  <th className={projThCls}>使用技術</th>
                  <th className={projThCls}>業務内容</th>
                </tr>
              </thead>
              <tbody>
                {demoData.projects.map((p, i) => (
                  <tr key={i}>
                    <td className={`${projTdCls} whitespace-nowrap`}>{p.period}</td>
                    <td className={projTdCls}>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-secondary text-[11px]">{p.client}</div>
                    </td>
                    <td className={`${projTdCls} whitespace-nowrap`}>{p.role}</td>
                    <td className={`${projTdCls} text-[11px]`}>{p.env}</td>
                    <td className={projTdCls}>{p.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
