/**
 * 管理側 無期転換 労働条件通知書の発行
 *
 * HTMLプロトタイプ page-notices-muki-new を完全再現。
 * セクション: 対象社員 → 労働条件通知書 — 内容
 * API未接続 — フォーム入力のみ。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- form state ---------- */
interface MukiNewForm {
  person: string;
  laborDate: string;
  convertDate: string;
  workplace: string;
  workplaceRange: string;
  jobDesc: string;
  jobRange: string;
  startTime: string;
  endTime: string;
  breakTime: string;
  workTimeSystem: string;
  overtime: string;
  holFixed: boolean;
  holSat: boolean;
  holSun: boolean;
  holHoliday: boolean;
  holOther: string;
  holNonfixed: boolean;
  holNonfixedDays: string;
  holNonfixedOther: string;
  holYearly: boolean;
  holYearlyDays: string;
  leave: string;
  salary: string;
  fixedOvertime: string;
  jobAllowance: string;
  commutePay: string;
  payClose: string;
  payDay: string;
  raise: string;
  bonus: string;
  severance: string;
  insurance: string;
}

const initialForm: MukiNewForm = {
  person: '',
  laborDate: '',
  convertDate: '',
  workplace: '当社が指定する場所',
  workplaceRange: '会社が指定するクライアント先（全国）',
  jobDesc: 'システム開発業務、システム運用・保守業務',
  jobRange: '会社の定めるすべてのシステム開発関連業務',
  startTime: '10時00分',
  endTime: '19時00分',
  breakTime: '60分',
  workTimeSystem: 'fixed',
  overtime: '有',
  holFixed: true,
  holSat: true,
  holSun: true,
  holHoliday: true,
  holOther: 'シフト表に準ずる',
  holNonfixed: false,
  holNonfixedDays: '',
  holNonfixedOther: '',
  holYearly: false,
  holYearlyDays: '',
  leave: '6か月継続勤務した場合 → 10日',
  salary: '',
  fixedOvertime: '',
  jobAllowance: '',
  commutePay: '実費全額支給',
  payClose: '毎月末日',
  payDay: '翌月末日',
  raise: '有',
  bonus: '無',
  severance: '無',
  insurance: '厚生年金・健康保険・雇用保険・労災保険',
};

/* ---------- helpers ---------- */
const labelCls = 'text-[11px] text-secondary block mb-[3px]';
const inputCls =
  'w-full border border-border/40 rounded-md px-3 py-2 text-[13px] outline-none';
const readonlyCls =
  'w-full border border-border/40 rounded-md px-3 py-2 text-[13px] outline-none bg-[#F7F7F5]';
const selectCls =
  'w-full border border-border/40 rounded-md px-3 py-2 text-[13px] outline-none appearance-none';

function parseSalary(v: string): number {
  return parseInt(v.replace(/[^0-9]/g, ''), 10) || 0;
}

function formatYen(v: number): string {
  return v > 0 ? v.toLocaleString() + '円' : '';
}

export default function AdminNoticesMukiNewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<MukiNewForm>(initialForm);

  const set = <K extends keyof MukiNewForm>(key: K, val: MukiNewForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  /* salary total */
  const salaryTotal =
    parseSalary(form.salary) +
    parseSalary(form.fixedOvertime) +
    parseSalary(form.jobAllowance);

  const handlePreview = () => {
    router.push('/admin/notices-muki/preview');
  };

  const handleSave = () => {
    toast('通知書を発行しました');
    router.push('/admin/notices-muki');
  };

  return (
    <div>
      {/* ---------- header ---------- */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">無期転換 労働条件通知書の発行</h1>
        <div className="flex items-center gap-2">
          <button
            className="btn-outline text-sm py-2"
            onClick={() => router.push('/admin/notices-muki')}
          >
            キャンセル
          </button>
          <button className="btn-outline text-sm py-2" onClick={handlePreview}>
            プレビュー
          </button>
          <button className="btn-primary text-sm py-2" onClick={handleSave}>
            保存・発行
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>
        {/* ---------- section: 対象社員 ---------- */}
        <div className="card mb-3" style={{ padding: '18px 20px' }}>
          <div className="text-sm font-medium mb-3">対象社員</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>
                社員 <span className="text-[#A32D2D]">*</span>
              </label>
              <select
                className={selectCls}
                value={form.person}
                onChange={(e) => set('person', e.target.value)}
              >
                <option value="">選択してください</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>通知書の種別</label>
              <input
                type="text"
                className={readonlyCls}
                value="労働条件通知書（無期転換）"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* ---------- section: 労働条件通知書 — 内容 ---------- */}
        <div className="card mb-3" style={{ padding: '18px 20px' }}>
          <div className="text-sm font-medium mb-3">労働条件通知書 — 内容</div>

          {/* 発行日 / 雇用形態 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>
                発行日 <span className="text-[#A32D2D]">*</span>
              </label>
              <input
                type="date"
                className={inputCls}
                value={form.laborDate}
                onChange={(e) => set('laborDate', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>雇用形態</label>
              <input
                type="text"
                className={readonlyCls}
                value="正社員（無期雇用）"
                readOnly
              />
            </div>
          </div>

          {/* 契約期間 / 無期転換日 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>契約期間</label>
              <input
                type="text"
                className={readonlyCls}
                value="期間の定めなし"
                readOnly
              />
            </div>
            <div>
              <label className={labelCls}>無期転換日</label>
              <input
                type="text"
                className={readonlyCls}
                value={form.convertDate}
                readOnly
              />
            </div>
          </div>

          {/* 就業場所 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>就業場所（雇入れ直後）</label>
              <input
                type="text"
                className={inputCls}
                value={form.workplace}
                onChange={(e) => set('workplace', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>
                就業場所（変更の範囲） <span className="text-[#A32D2D]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.workplaceRange}
                onChange={(e) => set('workplaceRange', e.target.value)}
              />
            </div>
          </div>

          {/* 業務内容 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>業務内容（雇入れ直後）</label>
              <input
                type="text"
                className={inputCls}
                value={form.jobDesc}
                onChange={(e) => set('jobDesc', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>
                業務内容（変更の範囲） <span className="text-[#A32D2D]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.jobRange}
                onChange={(e) => set('jobRange', e.target.value)}
              />
            </div>
          </div>

          {/* 始業 / 終業 / 休憩 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <div>
              <label className={labelCls}>始業時間</label>
              <input
                type="text"
                className={inputCls}
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>終業時間</label>
              <input
                type="text"
                className={inputCls}
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>休憩</label>
              <input
                type="text"
                className={inputCls}
                value={form.breakTime}
                onChange={(e) => set('breakTime', e.target.value)}
              />
            </div>
          </div>

          {/* 労働時間制度 */}
          <div className="mt-2">
            <label className="text-[11px] text-secondary block mb-1.5">
              労働時間制度
            </label>
            <div className="text-xs flex flex-wrap gap-2.5">
              {[
                { value: 'fixed', label: '固定時間制' },
                { value: 'variable', label: '変形労働時間制' },
                { value: 'flex', label: 'フレックスタイム制' },
                { value: 'outside', label: '事業場外みなし' },
                { value: 'discretion', label: '裁量労働制' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="mn-worktime"
                    value={opt.value}
                    checked={form.workTimeSystem === opt.value}
                    onChange={() => set('workTimeSystem', opt.value)}
                    className="m-0"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 時間外労働 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 mt-2">
            <div>
              <label className={labelCls}>時間外労働</label>
              <select
                className={selectCls}
                value={form.overtime}
                onChange={(e) => set('overtime', e.target.value)}
              >
                <option>有</option>
                <option>無</option>
              </select>
            </div>
          </div>

          {/* 休日 */}
          <div className="mt-2">
            <label className="text-[11px] text-secondary block mb-1.5">
              休日
            </label>

            {/* 定例日 */}
            <div className="text-xs mb-1.5">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.holFixed}
                  onChange={(e) => set('holFixed', e.target.checked)}
                  className="m-0"
                />
                定例日
              </label>
              <div className="flex flex-wrap gap-1.5 ml-5 mt-1">
                <label className="flex items-center gap-[3px] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={form.holSat}
                    onChange={(e) => set('holSat', e.target.checked)}
                    className="m-0"
                  />
                  土曜日
                </label>
                <label className="flex items-center gap-[3px] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={form.holSun}
                    onChange={(e) => set('holSun', e.target.checked)}
                    className="m-0"
                  />
                  日曜日
                </label>
                <label className="flex items-center gap-[3px] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={form.holHoliday}
                    onChange={(e) => set('holHoliday', e.target.checked)}
                    className="m-0"
                  />
                  国民の祝日
                </label>
                <div className="flex items-center gap-[3px] text-xs">
                  その他（
                  <input
                    type="text"
                    className="border border-border/40 rounded px-2 py-1 text-xs outline-none"
                    style={{ width: 140 }}
                    value={form.holOther}
                    onChange={(e) => set('holOther', e.target.value)}
                  />
                  ）
                </div>
              </div>
            </div>

            {/* 非定例日 */}
            <div className="text-xs mb-1.5">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.holNonfixed}
                  onChange={(e) => set('holNonfixed', e.target.checked)}
                  className="m-0"
                />
                非定例日
              </label>
              <div className="flex items-center gap-[3px] ml-5 mt-1 text-xs">
                週・月当たり{' '}
                <input
                  type="text"
                  className="border border-border/40 rounded px-1.5 py-1 text-xs outline-none text-center"
                  style={{ width: 40 }}
                  value={form.holNonfixedDays}
                  onChange={(e) => set('holNonfixedDays', e.target.value)}
                />{' '}
                日、その他（
                <input
                  type="text"
                  className="border border-border/40 rounded px-2 py-1 text-xs outline-none"
                  style={{ width: 120 }}
                  value={form.holNonfixedOther}
                  onChange={(e) => set('holNonfixedOther', e.target.value)}
                />
                ）
              </div>
            </div>

            {/* 1年単位 */}
            <div className="text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.holYearly}
                  onChange={(e) => set('holYearly', e.target.checked)}
                  className="m-0"
                />
                1年単位の変形労働時間制の場合
              </label>
              <div className="flex items-center gap-[3px] ml-5 mt-1 text-xs">
                年間{' '}
                <input
                  type="text"
                  className="border border-border/40 rounded px-1.5 py-1 text-xs outline-none text-center"
                  style={{ width: 40 }}
                  value={form.holYearlyDays}
                  onChange={(e) => set('holYearlyDays', e.target.value)}
                />{' '}
                日
              </div>
            </div>
          </div>

          {/* 有給休暇 */}
          <div className="mt-2">
            <label className={labelCls}>有給休暇</label>
            <input
              type="text"
              className={inputCls}
              value={form.leave}
              onChange={(e) => set('leave', e.target.value)}
            />
          </div>

          {/* 賃金 4列 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
            <div>
              <label className={labelCls}>
                基本給 <span className="text-[#A32D2D]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                placeholder="200,000"
                value={form.salary}
                onChange={(e) => set('salary', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>固定残業代</label>
              <input
                type="text"
                className={inputCls}
                placeholder="50,000"
                value={form.fixedOvertime}
                onChange={(e) => set('fixedOvertime', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>職務手当</label>
              <input
                type="text"
                className={inputCls}
                placeholder="30,000"
                value={form.jobAllowance}
                onChange={(e) => set('jobAllowance', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>合計（自動）</label>
              <input
                type="text"
                className={`${readonlyCls} font-medium`}
                value={salaryTotal > 0 ? formatYen(salaryTotal) : ''}
                readOnly
              />
            </div>
          </div>

          {/* 通勤手当 */}
          <div className="mt-2">
            <label className={labelCls}>通勤手当</label>
            <input
              type="text"
              className={inputCls}
              style={{ width: 200 }}
              value={form.commutePay}
              onChange={(e) => set('commutePay', e.target.value)}
            />
          </div>

          {/* 賃金締切日 / 支払日 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div>
              <label className={labelCls}>賃金締切日</label>
              <input
                type="text"
                className={inputCls}
                value={form.payClose}
                onChange={(e) => set('payClose', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>賃金支払日</label>
              <input
                type="text"
                className={inputCls}
                value={form.payDay}
                onChange={(e) => set('payDay', e.target.value)}
              />
            </div>
          </div>

          {/* 昇給 / 賞与 / 退職金 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <div>
              <label className={labelCls}>昇給</label>
              <select
                className={selectCls}
                value={form.raise}
                onChange={(e) => set('raise', e.target.value)}
              >
                <option>有</option>
                <option>無</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>賞与</label>
              <select
                className={selectCls}
                value={form.bonus}
                onChange={(e) => set('bonus', e.target.value)}
              >
                <option>有</option>
                <option>無</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>退職金</label>
              <select
                className={selectCls}
                value={form.severance}
                onChange={(e) => set('severance', e.target.value)}
              >
                <option>有</option>
                <option>無</option>
              </select>
            </div>
          </div>

          {/* 社会保険 */}
          <div className="mt-2">
            <label className={labelCls}>社会保険</label>
            <input
              type="text"
              className={inputCls}
              value={form.insurance}
              onChange={(e) => set('insurance', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
