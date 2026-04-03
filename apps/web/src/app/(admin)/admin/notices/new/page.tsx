/**
 * 管理側 通知書の発行
 *
 * 採用内定通知書 / 労働条件通知書の新規発行フォーム。
 * API 未接続 — 保存ボタンは toast のみ。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- helper ---------- */
const Label = ({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="block text-[11px] text-secondary mb-[3px]">
    {children}
    {required && <span className="text-[#A32D2D] ml-0.5">*</span>}
  </label>
);

const inputCls =
  'w-full border border-border rounded-md px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary/30';
const selectCls =
  'w-full border border-border rounded-md px-3 py-2 text-[13px] outline-none appearance-none focus:ring-1 focus:ring-primary/30';
const readonlyCls =
  'w-full border border-border rounded-md px-3 py-2 text-[13px] outline-none bg-[#F7F7F5] font-medium';

export default function AdminNoticeNewPage() {
  const router = useRouter();
  const { toast } = useToast();

  /* ---- 対象者 ---- */
  const [person, setPerson] = useState('');
  const [noticeType, setNoticeType] = useState('採用内定通知書');

  /* ---- 採用内定通知書 ---- */
  const [offerDate, setOfferDate] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [salaryOffer, setSalaryOffer] = useState('');
  const [transport, setTransport] = useState('実費全額支給');
  const [workplaceOffer, setWorkplaceOffer] = useState('当社が指定する場所');
  const [trial, setTrial] = useState('稼働日から6ヵ月');
  const [deadline, setDeadline] = useState('');
  const [cancelReasons, setCancelReasons] = useState(
    '1. 入社日までに健康上の理由により勤務が困難と認められた場合\n2. 経歴・学歴等に虚偽の申告があった場合\n3. 反社会的勢力との関係が判明した場合\n4. その他、採用内定時に予測しえなかった事由により、採用が不適当と認められた場合',
  );
  const [requiredDocs, setRequiredDocs] = useState(
    '身分証明書、年金手帳（基礎年金番号通知書）、マイナンバー、給与振込口座',
  );

  /* ---- 労働条件通知書 ---- */
  const [laborDate, setLaborDate] = useState('');
  const [empType, setEmpType] = useState('正社員');
  const [contractTerm, setContractTerm] = useState('期間の定めあり');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [workplace, setWorkplace] = useState('当社が指定する場所');
  const [workplaceRange, setWorkplaceRange] = useState(
    '会社が指定するクライアント先（全国）',
  );
  const [jobDesc, setJobDesc] = useState(
    'システム開発業務、システム運用・保守業務',
  );
  const [jobRange, setJobRange] = useState(
    '会社の定めるすべてのシステム開発関連業務',
  );
  const [startTime, setStartTime] = useState('10時00分');
  const [endTime, setEndTime] = useState('19時00分');
  const [breakTime, setBreakTime] = useState('60分');

  /* renewal */
  const [renewal, setRenewal] = useState('possible');
  const [critWork, setCritWork] = useState(true);
  const [critPerf, setCritPerf] = useState(true);
  const [critAbility, setCritAbility] = useState(true);
  const [critBiz, setCritBiz] = useState(true);
  const [critProgress, setCritProgress] = useState(true);
  const [mukiChange, setMukiChange] = useState('no');
  const [tokuteiYears, setTokuteiYears] = useState('');
  const [tokuteiMonths, setTokuteiMonths] = useState('');

  /* worktime */
  const [worktime, setWorktime] = useState('fixed');
  const [overtime, setOvertime] = useState('有');

  /* holidays */
  const [holFixed, setHolFixed] = useState(true);
  const [holSat, setHolSat] = useState(true);
  const [holSun, setHolSun] = useState(true);
  const [holHoliday, setHolHoliday] = useState(true);
  const [holOther, setHolOther] = useState('シフト表に準ずる');
  const [holNonfixed, setHolNonfixed] = useState(false);
  const [holNonfixedDays, setHolNonfixedDays] = useState('');
  const [holNonfixedOther, setHolNonfixedOther] = useState('');
  const [holYearly, setHolYearly] = useState(false);
  const [holYearlyDays, setHolYearlyDays] = useState('');

  /* leave & salary */
  const [leave, setLeave] = useState('6か月継続勤務した場合 → 10日');
  const [salary, setSalary] = useState('');
  const [fixedOvertime, setFixedOvertime] = useState('');
  const [jobAllowance, setJobAllowance] = useState('');
  const [commutePay, setCommutePay] = useState('実費全額支給');
  const [payclose, setPayclose] = useState('毎月末日');
  const [payday, setPayday] = useState('翌月末日');
  const [raise, setRaise] = useState('有');
  const [bonus, setBonus] = useState('無');
  const [severance, setSeverance] = useState('無');
  const [insurance, setInsurance] = useState(
    '厚生年金・健康保険・雇用保険・労災保険',
  );

  /* computed salary total */
  const salaryTotal = (() => {
    const parse = (v: string) => parseInt(v.replace(/[^0-9]/g, ''), 10) || 0;
    const total = parse(salary) + parse(fixedOvertime) + parse(jobAllowance);
    return total > 0 ? total.toLocaleString() + '円' : '';
  })();

  const isOffer = noticeType === '採用内定通知書';
  const isLabor = noticeType === '労働条件通知書';
  const showRenewal = contractTerm === '期間の定めあり';

  const handleSave = () => {
    toast('通知書を発行しました');
    router.push('/admin/notices');
  };

  const handlePreview = () => {
    router.push('/admin/notices/preview');
  };

  return (
    <div>
      {/* ---------- header ---------- */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">通知書の発行</h1>
        <div className="flex items-center gap-2">
          <button
            className="btn-outline text-sm py-2"
            onClick={() => router.push('/admin/notices')}
          >
            キャンセル
          </button>
          <button
            className="btn-outline text-sm py-2"
            onClick={handlePreview}
          >
            プレビュー
          </button>
          <button className="btn-primary text-sm py-2" onClick={handleSave}>
            保存・発行
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>
        {/* ========== 対象者 ========== */}
        <div className="card px-5 py-4 mb-3">
          <div className="text-sm font-medium mb-3">対象者</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>候補者</Label>
              <select
                className={selectCls}
                value={person}
                onChange={(e) => setPerson(e.target.value)}
              >
                <option value="">選択してください</option>
              </select>
            </div>
            <div>
              <Label required>通知書の種別</Label>
              <select
                className={selectCls}
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value)}
              >
                <option value="採用内定通知書">採用内定通知書</option>
                <option value="労働条件通知書">労働条件通知書</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========== 採用内定通知書 — 内容 ========== */}
        {isOffer && (
          <div className="card px-5 py-4 mb-3">
            <div className="text-sm font-medium mb-3">
              採用内定通知書 &mdash; 内容
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>発行日</Label>
                <input
                  type="date"
                  className={inputCls}
                  value={offerDate}
                  onChange={(e) => setOfferDate(e.target.value)}
                />
              </div>
              <div>
                <Label required>入社日（予定）</Label>
                <input
                  type="date"
                  className={inputCls}
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label required>給与額（月額）</Label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="300,000円"
                  value={salaryOffer}
                  onChange={(e) => setSalaryOffer(e.target.value)}
                />
              </div>
              <div>
                <Label>交通費</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>就業場所</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={workplaceOffer}
                  onChange={(e) => setWorkplaceOffer(e.target.value)}
                />
              </div>
              <div>
                <Label>試用期間</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={trial}
                  onChange={(e) => setTrial(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-2">
              <Label required>回答期限</Label>
              <input
                type="date"
                className={inputCls}
                style={{ width: 200 }}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div className="mt-2">
              <Label>内定取消事由</Label>
              <textarea
                className={`${inputCls} h-20 resize-y font-sans`}
                value={cancelReasons}
                onChange={(e) => setCancelReasons(e.target.value)}
              />
            </div>
            <div className="mt-2">
              <Label>入社時提出書類</Label>
              <textarea
                className={`${inputCls} h-[60px] resize-y font-sans`}
                value={requiredDocs}
                onChange={(e) => setRequiredDocs(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ========== 労働条件通知書 — 内容 ========== */}
        {isLabor && (
          <div className="card px-5 py-4 mb-3">
            <div className="text-sm font-medium mb-3">
              労働条件通知書 &mdash; 内容
            </div>

            {/* 発行日 / 雇用形態 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>発行日</Label>
                <input
                  type="date"
                  className={inputCls}
                  value={laborDate}
                  onChange={(e) => setLaborDate(e.target.value)}
                />
              </div>
              <div>
                <Label>雇用形態</Label>
                <select
                  className={selectCls}
                  value={empType}
                  onChange={(e) => setEmpType(e.target.value)}
                >
                  <option>正社員</option>
                  <option>契約社員</option>
                </select>
              </div>
            </div>

            {/* 契約期間 */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>契約期間</Label>
                <select
                  className={selectCls}
                  value={contractTerm}
                  onChange={(e) => setContractTerm(e.target.value)}
                >
                  <option>期間の定めなし</option>
                  <option>期間の定めあり</option>
                </select>
              </div>
              <div>
                <Label>契約期間（定めありの場合）</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    className={`${inputCls} flex-1`}
                    value={contractStart}
                    onChange={(e) => setContractStart(e.target.value)}
                  />
                  <span className="text-[13px] text-secondary">〜</span>
                  <input
                    type="date"
                    className={`${inputCls} flex-1`}
                    value={contractEnd}
                    onChange={(e) => setContractEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 就業場所 */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>就業場所（雇入れ直後）</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                />
              </div>
              <div>
                <Label required>就業場所（変更の範囲）</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={workplaceRange}
                  onChange={(e) => setWorkplaceRange(e.target.value)}
                />
              </div>
            </div>

            {/* 業務内容 */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>業務内容（雇入れ直後）</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                />
              </div>
              <div>
                <Label required>業務内容（変更の範囲）</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={jobRange}
                  onChange={(e) => setJobRange(e.target.value)}
                />
              </div>
            </div>

            {/* 始業 / 終業 / 休憩 */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <Label>始業時間</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label>終業時間</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div>
                <Label>休憩</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={breakTime}
                  onChange={(e) => setBreakTime(e.target.value)}
                />
              </div>
            </div>

            {/* ---- 契約更新 (期間の定めありの場合) ---- */}
            {showRenewal && (
              <div className="bg-[#FAFAFA] rounded-lg p-3 mt-2">
                <div className="text-xs font-medium mb-2">
                  契約更新の有無（該当するものを選択）
                </div>
                <div className="flex flex-wrap gap-3 text-xs mb-3">
                  {(
                    [
                      ['auto', '自動的に更新する'],
                      ['possible', '更新する場合があり得る'],
                      ['none', '契約の更新はしない'],
                      ['other', 'その他'],
                    ] as const
                  ).map(([val, label]) => (
                    <label
                      key={val}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="renewal"
                        value={val}
                        checked={renewal === val}
                        onChange={() => setRenewal(val)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="text-xs font-medium mb-2">
                  契約更新の判断基準（該当するものをすべて選択）
                </div>
                <div className="flex flex-wrap gap-3 text-xs mb-2">
                  {(
                    [
                      [critWork, setCritWork, '契約期間満了時の業務量'],
                      [critPerf, setCritPerf, '勤務成績、態度'],
                      [critAbility, setCritAbility, '能力、体力、知力'],
                      [critBiz, setCritBiz, '会社の経営状況'],
                      [
                        critProgress,
                        setCritProgress,
                        '従事している業務の進捗状況',
                      ],
                    ] as [boolean, (v: boolean) => void, string][]
                  ).map(([checked, setter, label]) => (
                    <label
                      key={label}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setter(e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="text-xs font-medium mt-3 mb-2">
                  無期転換時の労働条件変更
                </div>
                <div className="flex flex-wrap gap-3 text-xs mb-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="mukiChange"
                      value="no"
                      checked={mukiChange === 'no'}
                      onChange={() => setMukiChange('no')}
                    />
                    無
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="mukiChange"
                      value="yes"
                      checked={mukiChange === 'yes'}
                      onChange={() => setMukiChange('yes')}
                    />
                    有（別紙のとおり）
                  </label>
                </div>

                <div className="text-xs font-medium mt-3 mb-2">
                  特定有期業務の期間（高度専門の場合）
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <input
                    type="text"
                    className="w-10 border border-border rounded px-1.5 py-1 text-xs text-center outline-none"
                    value={tokuteiYears}
                    onChange={(e) => setTokuteiYears(e.target.value)}
                  />
                  年
                  <input
                    type="text"
                    className="w-10 border border-border rounded px-1.5 py-1 text-xs text-center outline-none"
                    value={tokuteiMonths}
                    onChange={(e) => setTokuteiMonths(e.target.value)}
                  />
                  か月（上限10年）
                </div>
              </div>
            )}

            {/* 労働時間制度 */}
            <div className="mt-2">
              <Label>労働時間制度</Label>
              <div className="flex flex-wrap gap-2.5 text-xs">
                {(
                  [
                    ['fixed', '固定時間制'],
                    ['variable', '変形労働時間制'],
                    ['flex', 'フレックスタイム制'],
                    ['outside', '事業場外みなし'],
                    ['discretion', '裁量労働制'],
                  ] as const
                ).map(([val, label]) => (
                  <label
                    key={val}
                    className="flex items-center gap-1 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="worktime"
                      value={val}
                      checked={worktime === val}
                      onChange={() => setWorktime(val)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* 時間外労働 */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>時間外労働</Label>
                <select
                  className={selectCls}
                  value={overtime}
                  onChange={(e) => setOvertime(e.target.value)}
                >
                  <option>有</option>
                  <option>無</option>
                </select>
              </div>
            </div>

            {/* 休日 */}
            <div className="mt-2">
              <Label>休日</Label>
              <div className="text-xs mb-1.5">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holFixed}
                    onChange={(e) => setHolFixed(e.target.checked)}
                  />
                  定例日
                </label>
                <div className="flex flex-wrap gap-1.5 ml-5 my-1">
                  <label className="flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={holSat}
                      onChange={(e) => setHolSat(e.target.checked)}
                    />
                    土曜日
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={holSun}
                      onChange={(e) => setHolSun(e.target.checked)}
                    />
                    日曜日
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={holHoliday}
                      onChange={(e) => setHolHoliday(e.target.checked)}
                    />
                    国民の祝日
                  </label>
                  <div className="flex items-center gap-1 text-xs">
                    その他（
                    <input
                      type="text"
                      className="w-[140px] border border-border rounded px-2 py-1 text-xs outline-none"
                      value={holOther}
                      onChange={(e) => setHolOther(e.target.value)}
                    />
                    ）
                  </div>
                </div>
              </div>
              <div className="text-xs mb-1.5">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holNonfixed}
                    onChange={(e) => setHolNonfixed(e.target.checked)}
                  />
                  非定例日
                </label>
                <div className="flex items-center gap-1 ml-5 my-1 text-xs">
                  週・月当たり
                  <input
                    type="text"
                    className="w-10 border border-border rounded px-1.5 py-1 text-xs text-center outline-none"
                    value={holNonfixedDays}
                    onChange={(e) => setHolNonfixedDays(e.target.value)}
                  />
                  日、その他（
                  <input
                    type="text"
                    className="w-[120px] border border-border rounded px-2 py-1 text-xs outline-none"
                    value={holNonfixedOther}
                    onChange={(e) => setHolNonfixedOther(e.target.value)}
                  />
                  ）
                </div>
              </div>
              <div className="text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holYearly}
                    onChange={(e) => setHolYearly(e.target.checked)}
                  />
                  1年単位の変形労働時間制の場合
                </label>
                <div className="flex items-center gap-1 ml-5 my-1 text-xs">
                  年間
                  <input
                    type="text"
                    className="w-10 border border-border rounded px-1.5 py-1 text-xs text-center outline-none"
                    value={holYearlyDays}
                    onChange={(e) => setHolYearlyDays(e.target.value)}
                  />
                  日
                </div>
              </div>
            </div>

            {/* 有給休暇 */}
            <div className="mt-2">
              <Label>有給休暇</Label>
              <input
                type="text"
                className={inputCls}
                value={leave}
                onChange={(e) => setLeave(e.target.value)}
              />
            </div>

            {/* 給与 4列 */}
            <div className="grid grid-cols-4 gap-3 mt-2">
              <div>
                <Label required>基本給</Label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="200,000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </div>
              <div>
                <Label>固定残業代</Label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="50,000"
                  value={fixedOvertime}
                  onChange={(e) => setFixedOvertime(e.target.value)}
                />
              </div>
              <div>
                <Label>職務手当</Label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="30,000"
                  value={jobAllowance}
                  onChange={(e) => setJobAllowance(e.target.value)}
                />
              </div>
              <div>
                <Label>合計（自動）</Label>
                <input
                  type="text"
                  className={readonlyCls}
                  value={salaryTotal}
                  readOnly
                />
              </div>
            </div>

            {/* 通勤手当 */}
            <div className="mt-2">
              <Label>通勤手当</Label>
              <input
                type="text"
                className={inputCls}
                style={{ width: 200 }}
                value={commutePay}
                onChange={(e) => setCommutePay(e.target.value)}
              />
            </div>

            {/* 賃金締切日 / 賃金支払日 */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>賃金締切日</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={payclose}
                  onChange={(e) => setPayclose(e.target.value)}
                />
              </div>
              <div>
                <Label>賃金支払日</Label>
                <input
                  type="text"
                  className={inputCls}
                  value={payday}
                  onChange={(e) => setPayday(e.target.value)}
                />
              </div>
            </div>

            {/* 昇給 / 賞与 / 退職金 */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <Label>昇給</Label>
                <select
                  className={selectCls}
                  value={raise}
                  onChange={(e) => setRaise(e.target.value)}
                >
                  <option>有</option>
                  <option>無</option>
                </select>
              </div>
              <div>
                <Label>賞与</Label>
                <select
                  className={selectCls}
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                >
                  <option>有</option>
                  <option>無</option>
                </select>
              </div>
              <div>
                <Label>退職金</Label>
                <select
                  className={selectCls}
                  value={severance}
                  onChange={(e) => setSeverance(e.target.value)}
                >
                  <option>有</option>
                  <option>無</option>
                </select>
              </div>
            </div>

            {/* 社会保険 */}
            <div className="mt-2">
              <Label>社会保険</Label>
              <input
                type="text"
                className={inputCls}
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
