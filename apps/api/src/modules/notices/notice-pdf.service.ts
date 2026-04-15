/**
 * NoticePdfService — 内定通知書 / 労働条件通知書（有期・無期）の PDF 生成
 *
 * web/admin/notices/preview と notices-muki/preview の HTML レイアウトを
 * Puppeteer 用 HTML 文字列としてサーバ側に移植している。
 */

import { Injectable } from '@nestjs/common';
import { PdfService } from '../pdf/pdf.service';

/* ====== 入力DTO ====== */
export interface OfferData {
  date: string;          // 発行日表示
  person: string;        // 宛名
  joinDate: string;
  workplace: string;
  salary: string;        // 月額表示文字列（円含めない）
  transport: string;
  trial: string;
  deadline: string;
  cancelReasons: string[];
  requiredDocs: string;
  companyName?: string;
  companyAddress?: string;
  representative?: string;
}

export interface LaborFixedData {
  date: string;
  person: string;
  contractTerm: string;
  contractRange: string;
  workplace: string;
  jobDesc: string;
  startTime: string;
  endTime: string;
  breakTime: string;
  overtime: string;
  holidays: string;
  leave: string;
  salaryBase: string;
  fixedOvertime: string;
  jobAllowance: string;
  salaryTotal: string;
  commute: string;
  payclose: string;
  payday: string;
  raise: string;
  bonus: string;
  severance: string;
  insurance: string;
  companyName?: string;
  companyAddress?: string;
  representative?: string;
}

export interface LaborOpenData {
  laborDate: string;
  person: string;
  convertDate: string;
  workplace: string;
  workplaceRange: string;
  jobDesc: string;
  jobRange: string;
  startTime: string;
  endTime: string;
  breakTime: string;
  workTimeSystem: 'fixed' | 'variable' | 'flex' | 'outside' | 'discretion' | '';
  overtime: string;
  holidays: string;
  leave: string;
  salary: string;
  fixedOvertime: string;
  jobAllowance: string;
  salaryTotal: string;
  commutePay: string;
  payClose: string;
  payDay: string;
  raise: string;
  bonus: string;
  severance: string;
  insurance: string;
  companyName?: string;
  companyAddress?: string;
  representative?: string;
}

const esc = PdfService.esc;
const COMMON_STYLE = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: 'Yu Mincho', '游明朝', 'Hiragino Mincho ProN', serif;
    font-size: 13px; color: #1A1A1A; line-height: 1.7;
  }
  .page { padding: 8px 4px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  table.lab { width: 100%; border-collapse: collapse; }
  table.lab th, table.lab td {
    border: 1px solid #555; padding: 8px 10px; vertical-align: top;
    font-size: 12.5px; line-height: 1.7;
  }
  table.lab th {
    background: #f5f5f0; font-weight: 500; width: 110px; text-align: left;
  }
  .title { text-align: center; font-size: 20px; font-weight: 600; letter-spacing: 0.15em; margin: 14px 0 18px; }
  .right { text-align: right; }
  .small { font-size: 11px; color: #6B6B6B; }
  .nowrap { white-space: nowrap; }
`;

@Injectable()
export class NoticePdfService {
  constructor(private readonly pdf: PdfService) {}

  async buildOfferPdf(d: OfferData): Promise<Buffer> {
    const company = d.companyName || '株式会社Lervia';
    const rep = d.representative || '代表取締役　矢野常貴';
    const addr = d.companyAddress || '';
    const reasonList = (d.cancelReasons || [])
      .map((r, i) => `<div>${i + 1}. ${esc(r)}</div>`).join('');
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>採用内定通知書</title>
<style>${COMMON_STYLE}</style></head><body><div class="page">
  <div class="right">${esc(d.date)}</div>
  <div style="margin: 18px 0;">${esc(d.person)}　様</div>
  <div class="right" style="margin: 14px 0;">
    ${esc(company)}<br/>
    ${addr ? `<span style="margin-left:24px">${esc(addr)}</span><br/>` : ''}
    <span style="margin-left:48px">${esc(rep)}</span>
  </div>
  <div class="title">採用内定通知書</div>
  <p>拝啓、時下ますますご清栄のこととお慶び申し上げます。</p>
  <p>さて、この度は弊社採用面接にご応募いただきまして、誠にありがとうございました。</p>
  <p>選考の結果、貴殿を採用内定とすることに決定いたしましたので、ご通知申し上げます。</p>
  <p>つきましては、下記の内容をご確認いただき、<b>${esc(d.deadline)}</b>までにメール、またはチャットツールにてご回答ください。</p>
  <div class="right" style="margin: 14px 0;">敬具</div>
  <div style="text-align:center; margin: 24px 0;">記</div>
  <div style="margin-left: 36px;">
    <div>入社日：${esc(d.joinDate)}（予定日）</div>
    <div>就業場所：${esc(d.workplace)}</div>
    <div>給与額：月額${esc(d.salary)}円</div>
    <div>交通費：${esc(d.transport)}</div>
    <div>試用期間：${esc(d.trial)}</div>
  </div>
  ${reasonList ? `
  <div style="margin-top: 22px; font-size:13px;">
    <div style="font-weight:600;margin-bottom:6px;">内定取消事由</div>
    <div style="margin-left:16px">以下のいずれかに該当する場合、採用内定を取り消すことがあります。</div>
    <div style="margin-left:32px;margin-top:4px">${reasonList}</div>
  </div>` : ''}
  ${d.requiredDocs ? `
  <div style="margin-top: 16px; font-size:13px;">
    <div style="font-weight:600;margin-bottom:6px;">入社時提出書類</div>
    <div style="margin-left:16px">入社日までに以下の書類をご提出ください。</div>
    <div style="margin-left:32px;margin-top:4px;white-space:pre-line">${esc(d.requiredDocs)}</div>
  </div>` : ''}
  <div class="right" style="margin-top: 24px;">以上</div>
</div></body></html>`;
    return this.pdf.generatePdfFromHtml(html);
  }

  async buildLaborFixedPdf(d: LaborFixedData): Promise<Buffer> {
    const company = d.companyName || '株式会社Lervia';
    const addr = d.companyAddress || '大阪市中央区南船場111-111';
    const rep = d.representative || '代表取締役　矢野常貴';
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>労働条件通知書</title>
<style>${COMMON_STYLE}</style></head><body>
<div class="page">
  <div class="right small">（一般労働者用；常用、有期雇用型）</div>
  <div class="title">労働条件通知書</div>
  <div>${esc(d.date)}</div>
  <div style="margin-bottom:12px">${esc(d.person)}　殿</div>
  <div class="right small" style="line-height:1.8">
    事業場名称・所在地　${esc(company)}<br/>
    ${esc(addr)}<br/>
    使用者職氏名　${esc(rep)}
  </div>
  <table class="lab" style="margin-top:8px">
    <tr><th>契約期間</th><td>${esc(d.contractTerm)}（${esc(d.contractRange)}）<br/><br/>
      <span class="small">※以下は、「契約期間」について「期間の定めあり」とした場合に記入</span><br/><br/>
      １　契約の更新の有無<br/>　[　自動的に更新する　◯更新する場合があり得る　契約の更新はしない　その他　]<br/><br/>
      ２　契約の更新は次により判断する。<br/>
      　　◯契約期間満了時の業務量　◯勤務成績、態度　◯能力、体力、知力<br/>
      　　◯会社の経営状況　◯従事している業務の進捗状況<br/><br/>
      ３　更新上限の有無（無）
    </td></tr>
    <tr><th>就業の場所</th><td>（雇入れ直後）${esc(d.workplace)}</td></tr>
    <tr><th>従事すべき<br/>業務の内容</th><td>（雇入れ直後）${esc(d.jobDesc)}</td></tr>
    <tr><th>始業、終業の<br/>時刻、休憩時間、<br/>所定時間外労働<br/>の有無</th><td>
      １　始業・終業の時刻等<br/>
      ◯(1) 始業（${esc(d.startTime)}）　終業（${esc(d.endTime)}）※勤務先による<br/><br/>
      ２　休憩時間（${esc(d.breakTime)}）<br/><br/>
      ３　所定時間外労働の有無（${esc(d.overtime)}）
    </td></tr>
    <tr><th>休日</th><td>・${esc(d.holidays)}</td></tr>
    <tr><th>休暇</th><td>１　年次有給休暇　${esc(d.leave)}<br/>
      　　　継続勤務６か月以内の年次有給休暇（有・無）<br/>
      ２　代替休暇（有・無）<br/>
      ３　その他の休暇　有給／無給</td></tr>
  </table>
  <div style="text-align:center;margin-top:14px" class="small">（次頁に続く）</div>
</div>
<div class="page">
  <table class="lab">
    <tr><th>賃金</th><td>
      １　給与<br/>
      　　基本給　${esc(d.salaryBase)}円<br/>
      　　固定残業代　${esc(d.fixedOvertime)}円<br/>
      　　職務手当　${esc(d.jobAllowance)}円<br/>
      　　<b>合計　${esc(d.salaryTotal)}円</b><br/><br/>
      ２　通勤手当：${esc(d.commute)}<br/><br/>
      ３　月単位での時間外割増し、深夜割増しおよび法定休日割増し支給。<br/>
      　　手当額を超過する場合は、超過分を別途支給。<br/><br/>
      ４　賃金締切日　${esc(d.payclose)}<br/>
      ５　賃金支払日　${esc(d.payday)}<br/>
      ６　賃金の支払方法（銀行振込）<br/><br/>
      ７　昇給（${esc(d.raise)}）<br/>
      ８　賞与（${esc(d.bonus)}）<br/>
      ９　退職金（${esc(d.severance)}）
    </td></tr>
    <tr><th>退職に関する<br/>事項</th><td>
      １　定年制（有（60歳），無）<br/>
      ２　継続雇用制度（有（65歳まで），無）<br/>
      ３　自己都合退職の手続（退職する14日以上前に届け出ること）<br/>
      ４　解雇の事由及び手続
    </td></tr>
    <tr><th>その他</th><td>
      ・社会保険の加入状況（${esc(d.insurance)}）<br/>
      ・雇用保険の適用（有）<br/>
      ・その他（　　　　　　　　　　　　　　）
    </td></tr>
    <tr><th></th><td>以上のほかは、当社就業規則による。<br/>就業規則を確認できる場所や方法（事務所内書庫および従業員システム）</td></tr>
  </table>
  <div class="small" style="margin-top:14px">
    ※　本通知書の交付は、労働基準法第１５条に基づく労働条件の明示及びパートタイム・有期雇用労働法第６条に基づく文書の交付を兼ねるものであること。<br/>
    ※　労使間の紛争の未然防止のため、保存しておくことをお勧めします。
  </div>
</div>
</body></html>`;
    return this.pdf.generatePdfFromHtml(html);
  }

  async buildLaborOpenPdf(d: LaborOpenData): Promise<Buffer> {
    const company = d.companyName || '株式会社Lervia';
    const addr = d.companyAddress || '大阪市中央区南船場111-111';
    const rep = d.representative || '代表取締役　矢野常貴';
    const wt = (target: string) => d.workTimeSystem === target ? '◯' : '\u3000';
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>労働条件通知書（無期）</title>
<style>${COMMON_STYLE}</style></head><body>
<div class="page">
  <div class="right small">（一般労働者用；常用、無期雇用型）</div>
  <div class="title">労働条件通知書</div>
  <div>${esc(d.laborDate)}</div>
  <div style="margin-bottom:12px">${esc(d.person)}　殿</div>
  <div class="right small" style="line-height:1.8">
    事業場名称・所在地　${esc(company)}<br/>
    ${esc(addr)}<br/>
    使用者職氏名　${esc(rep)}
  </div>
  <table class="lab" style="margin-top:8px">
    <tr><th>契約期間</th><td>期間の定めなし<br/>
      <span class="small">※ 無期雇用転換日：${esc(d.convertDate)}</span></td></tr>
    <tr><th>就業の場所</th><td>（雇入れ直後）${esc(d.workplace)}<br/>（変更の範囲）${esc(d.workplaceRange)}</td></tr>
    <tr><th>従事すべき<br/>業務の内容</th><td>（雇入れ直後）${esc(d.jobDesc)}<br/>（変更の範囲）${esc(d.jobRange)}</td></tr>
    <tr><th>始業、終業の<br/>時刻、休憩時間、<br/>所定時間外労働<br/>の有無</th><td>
      １　始業・終業の時刻等<br/>
      ${wt('fixed')}(1) 始業（${esc(d.startTime)}）　終業（${esc(d.endTime)}）※勤務先による<br/><br/>
      　【以下のような制度が労働者に適用される場合】<br/>
      ${wt('variable')}(2) 変形労働時間制等<br/>
      ${wt('flex')}(3) ﾌﾚｯｸｽﾀｲﾑ制<br/>
      ${wt('outside')}(4) 事業場外みなし労働時間制<br/>
      ${wt('discretion')}(5) 裁量労働制<br/><br/>
      ２　休憩時間（${esc(d.breakTime)}）<br/><br/>
      ３　所定時間外労働の有無（${esc(d.overtime)}）
    </td></tr>
    <tr><th>休日</th><td>${esc(d.holidays)}</td></tr>
    <tr><th>休暇</th><td>１　年次有給休暇　${esc(d.leave)}<br/>
      　　　継続勤務６か月以内の年次有給休暇（有・無）<br/>
      ２　代替休暇（有・無）<br/>
      ３　その他の休暇　有給／無給</td></tr>
  </table>
  <div style="text-align:center;margin-top:14px" class="small">（次頁に続く）</div>
</div>
<div class="page">
  <table class="lab">
    <tr><th>賃金</th><td>
      １　給与<br/>
      　　基本給　${esc(d.salary)}円<br/>
      　　固定残業代　${esc(d.fixedOvertime)}円<br/>
      　　職務手当　${esc(d.jobAllowance)}円<br/>
      　　<b>合計　${esc(d.salaryTotal)}円</b><br/><br/>
      ２　通勤手当：${esc(d.commutePay)}<br/><br/>
      ３　月単位での時間外割増し、深夜割増しおよび法定休日割増し支給。<br/><br/>
      ４　賃金締切日　${esc(d.payClose)}<br/>
      ５　賃金支払日　${esc(d.payDay)}<br/>
      ６　賃金の支払方法（銀行振込）<br/><br/>
      ７　昇給（${esc(d.raise)}）<br/>
      ８　賞与（${esc(d.bonus)}）<br/>
      ９　退職金（${esc(d.severance)}）
    </td></tr>
    <tr><th>退職に関する<br/>事項</th><td>
      １　定年制（有（60歳），無）<br/>
      ２　継続雇用制度（有（65歳まで），無）<br/>
      ３　自己都合退職の手続（退職する14日以上前に届け出ること）<br/>
      ４　解雇の事由及び手続
    </td></tr>
    <tr><th>その他</th><td>
      ・社会保険の加入状況（${esc(d.insurance)}）<br/>
      ・雇用保険の適用（有）
    </td></tr>
    <tr><th></th><td>以上のほかは、当社就業規則による。<br/>就業規則を確認できる場所や方法（事務所内書庫および従業員システム）</td></tr>
  </table>
  <div class="small" style="margin-top:14px">
    ※　本通知書の交付は、労働基準法第１５条に基づく労働条件の明示によるものです。<br/>
    ※　労使間の紛争の未然防止のため、保存しておくことをお勧めします。
  </div>
</div>
</body></html>`;
    return this.pdf.generatePdfFromHtml(html);
  }
}
