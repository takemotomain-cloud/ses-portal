/**
 * 管理側 候補者登録ページ
 *
 * HTMLプロトタイプ page-form-candidate を完全再現。
 * セクション: ヘッダー → 応募情報 → 基本情報 → 面接情報 → 希望条件 → 推薦文・備考
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- 共通フォーム部品 ---------- */

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-2xs text-secondary mb-1">
      {children}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );
}

function FormInput({
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-primary/40"
    />
  );
}

function FormSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none appearance-none focus:border-primary/40"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function FormTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none resize-y font-[inherit] focus:border-primary/40"
    />
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 mb-3">
      <div className="text-sm font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}

type RecruitSource = {
  id: string;
  name: string;
};

type RecruitJobPosting = {
  id: string;
  name: string;
};

type RecruitInterviewer = {
  id: string;
  name: string;
};

/* ---------- メインコンポーネント ---------- */

export default function RecruitCandidateNewPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [sourceOptions, setSourceOptions] = useState<string[]>([
    'テックエージェント',
    'ITキャリア',
    'エンジニアパートナーズ',
    'Green',
    'Wantedly',
    '社員紹介',
    '自社HP',
  ]);
  const [jobOptions, setJobOptions] = useState<string[]>(['SESエンジニア', 'インフラエンジニア']);
  const [interviewerOptions, setInterviewerOptions] = useState<string[]>(['--']);

  /* --- 応募情報 --- */
  const [applyDate, setApplyDate] = useState('');
  const [applySource, setApplySource] = useState('テックエージェント');
  const [applyPosition, setApplyPosition] = useState('SESエンジニア');

  /* --- 基本情報 --- */
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastNameKana, setLastNameKana] = useState('');
  const [firstNameKana, setFirstNameKana] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('男性');
  const [residence, setResidence] = useState('大阪府');
  const [birthDate, setBirthDate] = useState('');
  const [education, setEducation] = useState('大卒');

  /* --- 面接情報 --- */
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('--');
  const [interviewer, setInterviewer] = useState('--');
  const [confirmStatus, setConfirmStatus] = useState('未確認');

  /* --- 希望条件 --- */
  const [preferredLocation, setPreferredLocation] = useState('大阪');
  const [preferredMonth, setPreferredMonth] = useState('2026年5月');
  const [interviewPreference, setInterviewPreference] = useState('');

  /* --- 推薦文・備考 --- */
  const [recommendation, setRecommendation] = useState('');
  const [remarks, setRemarks] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sources, jobs, interviewers] = await Promise.all([
          apiClient<RecruitSource[]>('/candidates/sources').catch(() => [] as RecruitSource[]),
          apiClient<RecruitJobPosting[]>('/candidates/job-postings').catch(() => [] as RecruitJobPosting[]),
          apiClient<RecruitInterviewer[]>('/candidates/interviewers').catch(() => [] as RecruitInterviewer[]),
        ]);
        if (!alive) return;

        const nextSources = sources.map((item) => item.name).filter(Boolean);
        const nextJobs = jobs.map((item) => item.name).filter(Boolean);
        const nextInterviewers = interviewers.map((item) => item.name).filter(Boolean);

        if (nextSources.length > 0) {
          setSourceOptions(nextSources);
          setApplySource((current) => (nextSources.includes(current) ? current : nextSources[0]));
        }
        if (nextJobs.length > 0) {
          setJobOptions(nextJobs);
          setApplyPosition((current) => (nextJobs.includes(current) ? current : nextJobs[0]));
        }
        if (nextInterviewers.length > 0) {
          const withPlaceholder = ['--', ...nextInterviewers];
          setInterviewerOptions(withPlaceholder);
          setInterviewer((current) => (withPlaceholder.includes(current) ? current : '--'));
        }
      } catch {
        // フォールバック値のまま使う
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (!applyDate || !lastName || !firstName || !applySource) {
      toast('必須項目を入力してください');
      return;
    }
    setSaving(true);
    try {
      await apiClient('/candidates', {
        method: 'POST',
        body: JSON.stringify({
          applicationDate: applyDate,
          source: applySource,
          jobPosting: applyPosition,
          lastName,
          firstName,
          lastNameKana: lastNameKana || undefined,
          firstNameKana: firstNameKana || undefined,
          phone: phone || undefined,
          gender: gender || undefined,
          residence: residence || undefined,
          birthDate: birthDate || undefined,
          education: education || undefined,
          interviewDate: interviewDate || undefined,
          interviewTime: interviewTime !== '--' ? interviewTime : undefined,
          interviewer: interviewer !== '--' ? interviewer : undefined,
          confirmStatus: confirmStatus || undefined,
          desiredLocation: preferredLocation || undefined,
          desiredMonth: preferredMonth || undefined,
          interviewPreference: interviewPreference || undefined,
          recommendation: recommendation || undefined,
          notes: remarks || undefined,
        }),
      });
      toast('候補者を登録しました');
      router.push('/admin/recruit-candidates');
    } catch {
      toast('登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">候補者登録</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/recruit-candidates')}
            className="btn-outline text-sm py-2"
          >
            キャンセル
          </button>
          <button onClick={handleSubmit} className="btn-primary text-sm py-2">
            保存
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>
        {/* 応募情報 */}
        <SectionCard title="応募情報">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <FormLabel required>応募日</FormLabel>
              <FormInput type="date" value={applyDate} onChange={setApplyDate} />
            </div>
            <div>
              <FormLabel required>応募経路</FormLabel>
              <FormSelect
                value={applySource}
                onChange={setApplySource}
                options={sourceOptions}
              />
            </div>
          </div>
          <div className="mb-2">
            <FormLabel required>応募求人</FormLabel>
            <FormSelect
              value={applyPosition}
              onChange={setApplyPosition}
              options={jobOptions}
            />
          </div>
        </SectionCard>

        {/* 基本情報 */}
        <SectionCard title="基本情報">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <FormLabel required>姓</FormLabel>
              <FormInput value={lastName} onChange={setLastName} placeholder="山田" />
            </div>
            <div>
              <FormLabel required>名</FormLabel>
              <FormInput value={firstName} onChange={setFirstName} placeholder="太郎" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <FormLabel>姓ふりがな</FormLabel>
              <FormInput value={lastNameKana} onChange={setLastNameKana} placeholder="やまだ" />
            </div>
            <div>
              <FormLabel>名ふりがな</FormLabel>
              <FormInput value={firstNameKana} onChange={setFirstNameKana} placeholder="たろう" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div>
              <FormLabel>電話番号</FormLabel>
              <FormInput value={phone} onChange={setPhone} placeholder="090-1234-5678" />
            </div>
            <div>
              <FormLabel>性別</FormLabel>
              <FormSelect value={gender} onChange={setGender} options={['男性', '女性', 'その他']} />
            </div>
            <div>
              <FormLabel>居住地</FormLabel>
              <FormSelect
                value={residence}
                onChange={setResidence}
                options={['大阪府', '東京都', '愛知県']}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>生年月日</FormLabel>
              <FormInput type="date" value={birthDate} onChange={setBirthDate} />
            </div>
            <div>
              <FormLabel>最終学歴</FormLabel>
              <FormSelect
                value={education}
                onChange={setEducation}
                options={['大卒', '専門卒', '高卒', '大学院卒']}
              />
            </div>
          </div>
        </SectionCard>

        {/* 面接情報 */}
        <SectionCard title="面接情報">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <FormLabel>一次面接日</FormLabel>
              <FormInput type="date" value={interviewDate} onChange={setInterviewDate} />
            </div>
            <div>
              <FormLabel>一次面接時間</FormLabel>
              <FormSelect
                value={interviewTime}
                onChange={setInterviewTime}
                options={[
                  '--',
                  '9:00',
                  '9:30',
                  '10:00',
                  '10:30',
                  '11:00',
                  '13:00',
                  '13:30',
                  '14:00',
                  '15:00',
                  '16:00',
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>一次面接官</FormLabel>
              <FormSelect
                value={interviewer}
                onChange={setInterviewer}
                options={interviewerOptions}
              />
            </div>
            <div>
              <FormLabel>確認状態</FormLabel>
              <FormSelect
                value={confirmStatus}
                onChange={setConfirmStatus}
                options={['未確認', '確認済']}
              />
            </div>
          </div>
        </SectionCard>

        {/* 希望条件 */}
        <SectionCard title="希望条件">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <FormLabel>希望勤務地</FormLabel>
              <FormSelect
                value={preferredLocation}
                onChange={setPreferredLocation}
                options={['大阪', '東京', '愛知']}
              />
            </div>
            <div>
              <FormLabel>希望入社月</FormLabel>
              <FormSelect
                value={preferredMonth}
                onChange={setPreferredMonth}
                options={['2026年5月', '2026年6月', '2026年7月', '2026年8月']}
              />
            </div>
          </div>
          <div>
            <FormLabel>面接希望日時</FormLabel>
            <FormTextarea
              value={interviewPreference}
              onChange={setInterviewPreference}
              placeholder="例: 4月7日 10時〜12時、4月8日 14時以降"
              rows={2}
            />
          </div>
        </SectionCard>

        {/* 推薦文・備考 */}
        <SectionCard title="推薦文・備考">
          <div className="mb-2">
            <FormLabel>推薦文</FormLabel>
            <FormTextarea
              value={recommendation}
              onChange={setRecommendation}
              placeholder="推薦理由やアピールポイント"
              rows={3}
            />
          </div>
          <div>
            <FormLabel>備考</FormLabel>
            <FormTextarea
              value={remarks}
              onChange={setRemarks}
              placeholder="その他特記事項"
              rows={2}
            />
          </div>
        </SectionCard>
      </div>

      {/* 下部にも戻るボタン */}
      <div className="mt-4 mb-8" style={{ maxWidth: 680 }}>
        <button
          onClick={() => router.push('/admin/recruit-candidates')}
          className="btn-outline text-sm py-2"
        >
          戻る
        </button>
      </div>

      <ToastUI />
    </div>
  );
}
