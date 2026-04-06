/**
 * 管理側 スキルシートプレビューページ
 *
 * HTMLプロトタイプ page-ss-preview を完全再現。
 * 印刷用フォーマットのスキルシートを表示。
 */

'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- イニシャル変換 ---------- */

/**
 * 日本語氏名をイニシャルに変換
 * 「山田 太郎」→「T.Y」（姓のローマ字頭文字.名のローマ字頭文字）
 * ローマ字変換できない場合はそのまま頭文字を使用
 */
const kanaToRomaji: Record<string, string> = {
  'あ':'A','い':'I','う':'U','え':'E','お':'O',
  'か':'K','き':'K','く':'K','け':'K','こ':'K',
  'さ':'S','し':'S','す':'S','せ':'S','そ':'S',
  'た':'T','ち':'C','つ':'T','て':'T','と':'T',
  'な':'N','に':'N','ぬ':'N','ね':'N','の':'N',
  'は':'H','ひ':'H','ふ':'F','へ':'H','ほ':'H',
  'ま':'M','み':'M','む':'M','め':'M','も':'M',
  'や':'Y','ゆ':'Y','よ':'Y',
  'ら':'R','り':'R','る':'R','れ':'R','ろ':'R',
  'わ':'W','を':'W','ん':'N',
  'が':'G','ぎ':'G','ぐ':'G','げ':'G','ご':'G',
  'ざ':'Z','じ':'J','ず':'Z','ぜ':'Z','ぞ':'Z',
  'だ':'D','ぢ':'D','づ':'D','で':'D','ど':'D',
  'ば':'B','び':'B','ぶ':'B','べ':'B','ぼ':'B',
  'ぱ':'P','ぴ':'P','ぷ':'P','ぺ':'P','ぽ':'P',
};

// 漢字→読み の簡易マッピング（よくある姓名の頭文字）
const kanjiInitial: Record<string, string> = {
  '山':'Y','田':'T','中':'N','小':'O','大':'O','高':'T','佐':'S','加':'K',
  '伊':'I','井':'I','石':'I','上':'U','内':'U','遠':'E','岡':'O','木':'K',
  '北':'K','久':'K','熊':'K','黒':'K','河':'K','後':'G','近':'K','斉':'S',
  '斎':'S','坂':'S','桜':'S','島':'S','清':'S','杉':'S','鈴':'S','関':'S',
  '園':'S','竹':'T','谷':'T','千':'C','土':'T','手':'T','寺':'T','藤':'F',
  '渡':'W','豊':'T','長':'N','永':'N','西':'N','野':'N','橋':'H','林':'H',
  '原':'H','浜':'H','平':'H','福':'F','松':'M','丸':'M','三':'M','水':'M',
  '宮':'M','村':'M','森':'M','安':'Y','柳':'Y','吉':'Y','若':'W','和':'W',
  '太':'T','一':'K','二':'N','四':'S','五':'G','六':'R','七':'N',
  '八':'H','九':'K','十':'J','子':'K','美':'M','明':'A','正':'M','雄':'Y',
  '博':'H','健':'K','誠':'M','裕':'Y','純':'J','翔':'S','蓮':'R','陽':'H',
  '花':'H','愛':'A','結':'Y','咲':'S','真':'M','直':'N','隆':'T','俊':'S',
  '浩':'H','哲':'T','剛':'T','悠':'Y','拓':'T','彩':'A','奈':'N','恵':'M',
};

function toInitial(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const [lastName, firstName] = parts;

  function getInitialChar(s: string): string {
    const ch = s.charAt(0);
    // アルファベットならそのまま
    if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
    // ひらがな/カタカナ
    const hira = ch.replace(/[\u30A1-\u30F6]/g, (m) =>
      String.fromCharCode(m.charCodeAt(0) - 0x60));
    if (kanaToRomaji[hira]) return kanaToRomaji[hira];
    // 漢字
    if (kanjiInitial[ch]) return kanjiInitial[ch];
    return ch;
  }

  const li = getInitialChar(lastName);
  const fi = getInitialChar(firstName);
  return `${fi}.${li}`;
}

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
            onClick={() => {
              const bom = '\uFEFF';
              const lines: string[] = [];
              lines.push(['項目', '値'].join(','));
              lines.push(['氏名', demoData.name].join(','));
              lines.push(['年齢', demoData.age].join(','));
              lines.push(['最終学歴', demoData.edu].join(','));
              lines.push(['経験年数', demoData.exp].join(','));
              lines.push(['最寄駅', demoData.station].join(','));
              lines.push(['自己PR', `"${demoData.pr.replace(/"/g, '""')}"`].join(','));
              lines.push('');
              lines.push(['カテゴリ', 'スキル'].join(','));
              demoData.skills.forEach(sk => lines.push([sk.cat, `"${sk.items.replace(/"/g, '""')}"`].join(',')));
              lines.push('');
              lines.push(['期間', '案件名', 'クライアント', '役割', '環境', '業務内容'].join(','));
              demoData.projects.forEach(p => lines.push([p.period, p.name, p.client, p.role, p.env, `"${p.detail.replace(/"/g, '""')}"`].join(',')));
              lines.push('');
              lines.push(['保有資格'].join(','));
              demoData.certs.forEach(c => lines.push([c].join(',')));
              const csv = bom + lines.join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `スキルシート_${demoData.name || '未設定'}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast('CSVをダウンロードしました');
            }}
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
                <td className={tdCellCls}>{toInitial(demoData.name) || demoData.name}</td>
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
