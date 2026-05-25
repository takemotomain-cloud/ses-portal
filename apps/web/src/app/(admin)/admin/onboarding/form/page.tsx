/**
 * 入社情報フォーム
 *
 * 入社予定者の情報を入力し、社員マスタ（Employee + EmergencyContact + Dependents）に登録。
 * POST /api/employees でEmployee+User作成、POST /api/employees/:id/emergency-contact で緊急連絡先作成。
 * POST /api/employees/:id/dependents で扶養家族を登録。
 * PATCH /api/employees/:id で資格（qualifications）を登録。
 *
 * セクション:
 * 1. 入社情報（入社予定日・配属部署・雇用形態）
 * 2. 基本情報（姓名・ふりがな・生年月日・性別・郵便番号・住所・最寄駅・電話・メール・血液型・最終学歴・学校名）
 * 3. 緊急連絡先（氏名・続柄・電話番号）
 * 4. 扶養家族（名前・続柄・生年月日・年収）
 * 5. 給与振込口座（銀行名・支店名・口座種別・口座番号・口座名義）
 * 6. 通勤（通勤スタイル）
 * 7. 本人確認書類アップロード（顔写真付き身分証の表裏）※UI のみ（ファイルストレージは今後）
 * 8. マイナンバーカード（表裏）※UI のみ
 * 9. 年金手帳 ※UI のみ
 * 10. 保有資格（動的追加）
 * 11. 送信ボタン → API で DB に保存
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient, getToken } from '@/lib/api-client';

/* ── ファイルアップロード用コンポーネント（制御コンポーネント） ── */
function UploadBox({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div>
      <label className="text-xs text-secondary block mb-1.5">{label}</label>
      <label
        htmlFor={id}
        className={`block border border-dashed rounded-lg p-5 text-center text-sm cursor-pointer transition-colors
          ${value ? 'border-green-400 bg-green-50 text-green-700' : 'border-border text-secondary hover:bg-page'}`}
      >
        {value ? (
          <span>{value.name}</span>
        ) : (
          <>タップして撮影 / 選択<br /><span className="text-xs text-[#BDBDBD]">JPG, PNG, PDF（10MB以下）</span></>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; onChange(f || null); }}
      />
    </div>
  );
}

/** OnboardingDocuments: multipart で本人確認書類を送る（apiClient は JSON 固定のため fetch を使う） */
async function uploadOnboardingDocument(
  employeeId: string,
  documentType: string,
  file: File,
): Promise<void> {
  const token = getToken();
  const fd = new FormData();
  fd.append('documentType', documentType);
  fd.append('file', file);
  const res = await fetch(`/api/onboarding-documents/${employeeId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `アップロード失敗 (${documentType})`);
  }
}

/* ── Controlled Input ── */
function CInput({ label, required, placeholder, type = 'text', readOnly, value, onChange }: {
  label: string; required?: boolean; placeholder?: string; type?: string;
  readOnly?: boolean; value: string; onChange?: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-secondary block mb-1">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <input type={type} placeholder={placeholder} readOnly={readOnly} value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors ${readOnly ? 'bg-page' : ''}`} />
    </div>
  );
}

function CSelect({ label, required, options, value, onChange }: {
  label: string; required?: boolean; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-secondary block mb-1">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary appearance-none bg-white">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ── 扶養家族の型 ── */
interface DependentInput {
  name: string;
  relationship: string;
  birthDate: string;
  annualIncome: string;
}

const IT_CERT_OPTIONS = [
  'ITパスポート試験',
  '情報セキュリティマネジメント試験',
  '基本情報技術者試験',
  '応用情報技術者試験',
  'ITストラテジスト試験',
  'システムアーキテクト試験',
  'プロジェクトマネージャ試験',
  'ネットワークスペシャリスト試験',
  'データベーススペシャリスト試験',
  'エンベデッドシステムスペシャリスト試験',
  'ITサービスマネージャ試験',
  'システム監査技術者試験',
  '情報処理安全確保支援士試験',
  'AWS Certified Cloud Practitioner',
  'AWS Certified AI Practitioner',
  'AWS Certified Solutions Architect – Associate',
  'AWS Certified Developer – Associate',
  'AWS Certified CloudOps Engineer – Associate',
  'AWS Certified Solutions Architect – Professional',
  'AWS Certified DevOps Engineer – Professional',
  'AWS Certified Security – Specialty',
  'Microsoft Certified: Azure Fundamentals',
  'Microsoft Certified: Azure Administrator Associate',
  'Microsoft Certified: Azure Solutions Architect Expert',
  'Cloud Digital Leader',
  'Associate Cloud Engineer',
  'Professional Cloud Architect',
  'Professional Cloud Developer',
  'Professional Cloud Network Engineer',
  'Professional Cloud Security Engineer',
  'Professional Cloud Database Engineer',
  'Professional Data Engineer',
  'Professional Machine Learning Engineer',
  'CCNA',
  'CCNP',
  'CCIE',
  'ORACLE MASTER Bronze DBA 2019',
  'ORACLE MASTER Silver DBA 2019',
  'ORACLE MASTER Silver SQL 2019',
  'ORACLE MASTER Gold DBA 2019',
  'Salesforce 認定 Platform アドミニストレーター',
  'Salesforce 認定 Platform アドミニストレーター 上級',
  'Salesforce 認定 Platform デベロッパー',
  'Salesforce 認定 Platform デベロッパー 上級',
  'Salesforce 認定 Platform アプリケーションビルダー',
  'LinuCレベル1',
  'LinuCレベル2',
  'LinuCレベル3',
  'LinuCシステムアーキテクト',
  'LPIC-1',
  'LPIC-2',
  'LPIC-3',
  'Oracle Certified Java Programmer, Bronze SE',
  'Oracle Certified Java Programmer, Silver SE 11',
  'Oracle Certified Java Programmer, Gold SE 11',
  'Oracle Certified Java Programmer, Silver SE 17',
  'Oracle Certified Java Programmer, Gold SE 17',
  'Python3 エンジニア認定基礎試験',
  'Python3 エンジニア認定データ分析試験',
  'PHP技術者認定初級試験',
  'PHP技術者認定上級試験',
  'Ruby Association Certified Ruby Programmer Silver',
  'Ruby Association Certified Ruby Programmer Gold',
  'HTML5プロフェッショナル認定試験 レベル1',
  'HTML5プロフェッショナル認定試験 レベル2',
  'G検定',
  'E資格',
  '統計検定4級',
  '統計検定3級',
  '統計検定2級',
  '統計検定準1級',
  '統計検定1級',
  'PMP',
  'Certified ScrumMaster（CSM）',
];

const COMMON_CERT_OPTIONS = [
  '日商簿記検定3級',
  '日商簿記検定2級',
  '日商簿記検定1級',
  '宅地建物取引士',
  'FP技能検定3級',
  'FP技能検定2級',
  'FP技能検定1級',
  'TOEIC Listening & Reading',
  '社会保険労務士',
  '行政書士',
  '公認会計士',
  '税理士',
  '中小企業診断士',
  '介護福祉士',
  '介護職員初任者研修',
  '看護師',
  '登録販売者',
  '第二種電気工事士',
  '危険物取扱者乙種第4類',
  '司法書士',
  '秘書検定3級',
  '秘書検定2級',
  '秘書検定準1級',
  '秘書検定1級',
  'MOS Word',
  'MOS Excel',
  'MOS PowerPoint',
  'MOS Word Expert',
  'MOS Excel Expert',
];

export default function OnboardFormPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  /* ── 部署一覧 ── */
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    interface Dept { id: string; name: string; children?: Dept[] }
    apiClient<Dept[]>('/settings/departments')
      .then((res) => {
        const flat: { id: string; name: string }[] = [];
        const flatten = (list: Dept[], prefix = '') => {
          for (const d of list) {
            flat.push({ id: d.id, name: prefix ? `${prefix} / ${d.name}` : d.name });
            if (d.children?.length) flatten(d.children, prefix ? `${prefix} / ${d.name}` : d.name);
          }
        };
        flatten(Array.isArray(res) ? res : []);
        setDepartments(flat);
      })
      .catch(() => {});
  }, []);

  /* ── フォーム状態 ── */
  // 基本情報
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastNameKana, setLastNameKana] = useState('');
  const [firstNameKana, setFirstNameKana] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('男性');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [station, setStation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodType, setBloodType] = useState('A型');
  const [education, setEducation] = useState('');
  const [schoolName, setSchoolName] = useState('');

  // 緊急連絡先
  const [ecName, setEcName] = useState('');
  const [ecRelation, setEcRelation] = useState('父');
  const [ecPhone, setEcPhone] = useState('');

  // 扶養家族
  const [dependents, setDependents] = useState<DependentInput[]>([]);

  // 口座
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountType, setBankAccountType] = useState('普通');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');

  // 資格
  const [certs, setCerts] = useState<string[]>([]);
  const [selectedCert, setSelectedCert] = useState('');
  const [customCert, setCustomCert] = useState('');

  // 本人確認書類（File オブジェクト）
  const [docLicenseFront, setDocLicenseFront] = useState<File | null>(null);
  const [docLicenseBack, setDocLicenseBack] = useState<File | null>(null);
  const [docMynumberFront, setDocMynumberFront] = useState<File | null>(null);
  const [docMynumberBack, setDocMynumberBack] = useState<File | null>(null);
  const [docPensionBook, setDocPensionBook] = useState<File | null>(null);
  const [docResidentRecord, setDocResidentRecord] = useState<File | null>(null);
  const [docEmploymentInsurance, setDocEmploymentInsurance] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);

  function addCert(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('資格名を入力してください');
      return;
    }
    if (certs.includes(trimmed)) {
      toast('同じ資格はすでに追加されています');
      return;
    }
    setCerts([...certs, trimmed]);
  }

  function addSelectedCert() {
    if (!selectedCert) {
      toast('候補から資格を選択してください');
      return;
    }
    addCert(selectedCert);
    setSelectedCert('');
  }

  function addCustomCert() {
    addCert(customCert);
    setCustomCert('');
  }

  function removeCert(idx: number) {
    setCerts(certs.filter((_, i) => i !== idx));
  }

  function addDependent() {
    setDependents([...dependents, { name: '', relationship: '配偶者', birthDate: '', annualIncome: '' }]);
  }
  function updateDependent(idx: number, field: keyof DependentInput, value: string) {
    setDependents(dependents.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }
  function removeDependent(idx: number) {
    setDependents(dependents.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    // バリデーション
    if (!lastName || !firstName) { toast('姓名は必須です'); return; }
    if (!birthDate) { toast('生年月日は必須です'); return; }
    if (!phone) { toast('電話番号は必須です'); return; }
    if (!address) { toast('住所は必須です'); return; }
    if (!email) { toast('メールアドレスは必須です'); return; }
    if (!confirm('入力内容を送信しますか？\n\n送信後、以下が自動実行されます:\n・テキスト情報 → 社員マスタに取り込み\n・入社予定社員 → 該当項目を完了に更新')) {
      return;
    }

    setSubmitting(true);
    try {
      // 社員番号を自動生成（既存の最大値 + 1）
      const listRes = await apiClient<{ total: number }>('/employees?limit=1');
      const nextCode = `EMP-${String((listRes.total || 0) + 1).padStart(3, '0')}`;

      // 1. 社員作成
      const result = await apiClient<{ id: string; employeeCode: string }>('/employees', {
        method: 'POST',
        body: JSON.stringify({
          lastName,
          firstName,
          lastNameKana,
          firstNameKana,
          employeeCode: nextCode,
          hireDate: new Date().toISOString().slice(0, 10),
          departmentId: departments[0]?.id || '',
          birthDate,
          gender: gender === '男性' ? 'male' : gender === '女性' ? 'female' : 'other',
          bloodType,
          education: education || undefined,
          schoolName: schoolName || undefined,
          email,
          phone,
          postalCode: postalCode || undefined,
          address,
          station: station || undefined,
          bankName: bankName || undefined,
          bankBranch: bankBranch || undefined,
          bankAccountType: bankAccountType === '普通' ? 'ordinary' : bankAccountType === '当座' ? 'checking' : undefined,
          bankAccountNumber: bankAccountNumber || undefined,
          bankAccountHolder: bankAccountHolder || undefined,
        }),
      });

      // 2. 緊急連絡先を作成
      if (ecName && ecPhone) {
        await apiClient(`/employees/${result.id}/emergency-contact`, {
          method: 'POST',
          body: JSON.stringify({
            name: ecName,
            relationship: ecRelation,
            phone: ecPhone,
          }),
        }).catch(() => {});
      }

      // 3. 扶養家族を作成
      for (const dep of dependents) {
        if (!dep.name) continue;
        await apiClient(`/employees/${result.id}/dependents`, {
          method: 'POST',
          body: JSON.stringify({
            name: dep.name,
            relationship: dep.relationship,
            birthDate: dep.birthDate,
            annualIncome: dep.annualIncome ? Number(dep.annualIncome) : undefined,
          }),
        }).catch(() => {});
      }

      // 4. 資格がある場合は PATCH で登録
      if (certs.length > 0) {
        await apiClient(`/employees/${result.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            qualifications: certs,
          }),
        }).catch(() => {});
      }

      // 5. 本人確認書類を Drive にアップロード（失敗しても社員登録自体は成功扱い）
      const docs: Array<[string, File | null]> = [
        ['license_front', docLicenseFront],
        ['license_back', docLicenseBack],
        ['mynumber_front', docMynumberFront],
        ['mynumber_back', docMynumberBack],
        ['pension_book', docPensionBook],
        ['resident_record', docResidentRecord],
        ['employment_insurance_certificate', docEmploymentInsurance],
      ];
      const uploadFailures: string[] = [];
      for (const [type, f] of docs) {
        if (!f) continue;
        try {
          await uploadOnboardingDocument(result.id, type, f);
        } catch (e: unknown) {
          uploadFailures.push(type);
          console.warn('本人確認書類アップロード失敗', type, e);
        }
      }

      if (uploadFailures.length > 0) {
        toast(`社員を登録しました。ただし書類の一部アップロードに失敗: ${uploadFailures.join(', ')}`);
      } else {
        toast(`社員を登録しました（${result.employeeCode}）`);
      }
      setTimeout(() => router.push('/admin/onboarding'), 1500);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '登録に失敗しました';
      toast(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-[640px] mx-auto pt-5 pb-10 px-4">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/admin/onboarding')} className="btn-outline text-sm py-2">一覧に戻る</button>
          <div className="flex-1" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-lg font-medium">入社情報の登録</h1>
          <p className="text-sm text-secondary mt-1">以下の情報を入力・アップロードしてください</p>
        </div>

        {/* ── 1. 基本情報 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-3">基本情報</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="姓" required placeholder="長谷川" value={lastName} onChange={setLastName} />
            <CInput label="名" required placeholder="翼" value={firstName} onChange={setFirstName} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="姓ふりがな" placeholder="はせがわ" value={lastNameKana} onChange={setLastNameKana} />
            <CInput label="名ふりがな" placeholder="つばさ" value={firstNameKana} onChange={setFirstNameKana} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="生年月日" required type="date" value={birthDate} onChange={setBirthDate} />
            <CSelect label="性別" options={['男性', '女性', 'その他']} value={gender} onChange={setGender} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="郵便番号" placeholder="530-0001" value={postalCode} onChange={setPostalCode} />
            <CInput label="最寄駅" placeholder="JR大阪駅" value={station} onChange={setStation} />
          </div>
          <div className="mb-3">
            <CInput label="現住所" required placeholder="大阪府大阪市北区梅田1-1-1" value={address} onChange={setAddress} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="電話番号" required placeholder="090-1234-5678" value={phone} onChange={setPhone} />
            <CInput label="メールアドレス" required type="email" placeholder="tsubasa@example.com" value={email} onChange={setEmail} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <CSelect label="血液型" options={['A型', 'B型', 'O型', 'AB型']} value={bloodType} onChange={setBloodType} />
            <CSelect label="最終学歴" options={['', '大卒', '大学院卒', '専門卒', '短大卒', '高専卒', '高卒']} value={education} onChange={setEducation} />
            <CInput label="学校名" placeholder="〇〇大学" value={schoolName} onChange={setSchoolName} />
          </div>
        </div>

        {/* ── 2. 緊急連絡先 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-3">緊急連絡先 <span className="text-red-600">*</span></h2>
          <div className="grid grid-cols-3 gap-3">
            <CInput label="氏名" placeholder="長谷川 太郎" value={ecName} onChange={setEcName} />
            <CSelect label="続柄" options={['父', '母', '配偶者', '兄弟姉妹', 'その他']} value={ecRelation} onChange={setEcRelation} />
            <CInput label="電話番号" placeholder="090-0000-0000" value={ecPhone} onChange={setEcPhone} />
          </div>
        </div>

        {/* ── 3. 扶養家族 ── */}
        <div className="card p-5 mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">扶養家族</h2>
            <button onClick={addDependent} className="btn-outline text-xs py-1 px-3">+ 追加</button>
          </div>
          {dependents.length === 0 ? (
            <p className="text-sm text-secondary text-center py-3">扶養家族がいる場合は「+ 追加」から追加してください</p>
          ) : (
            <div className="space-y-3">
              {dependents.map((dep, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-secondary">扶養家族 {idx + 1}</span>
                    <button onClick={() => removeDependent(idx)} className="text-xs text-red-500 hover:text-red-700">削除</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <CInput label="氏名" placeholder="長谷川 花子" value={dep.name} onChange={(v) => updateDependent(idx, 'name', v)} />
                    <CSelect label="続柄" options={['配偶者', '子', '父', '母', 'その他']} value={dep.relationship} onChange={(v) => updateDependent(idx, 'relationship', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <CInput label="生年月日" type="date" value={dep.birthDate} onChange={(v) => updateDependent(idx, 'birthDate', v)} />
                    <CInput label="年収（万円）" placeholder="0" value={dep.annualIncome} onChange={(v) => updateDependent(idx, 'annualIncome', v)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 4. 給与振込口座 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-3">給与振込口座 <span className="text-red-600">*</span></h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="銀行名" placeholder="三菱UFJ銀行" value={bankName} onChange={setBankName} />
            <CInput label="支店名" placeholder="梅田支店" value={bankBranch} onChange={setBankBranch} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CSelect label="口座種別" options={['普通', '当座']} value={bankAccountType} onChange={setBankAccountType} />
            <CInput label="口座番号" placeholder="1234567" value={bankAccountNumber} onChange={setBankAccountNumber} />
          </div>
          <div>
            <CInput label="口座名義（カナ）" placeholder="ハセガワ ツバサ" value={bankAccountHolder} onChange={setBankAccountHolder} />
          </div>
        </div>

        {/* ── 5. 本人確認書類 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">本人確認書類のアップロード <span className="text-red-600">*</span></h2>
          <p className="text-xs text-secondary mb-3">
            顔写真付きの本人確認書類（運転免許証、マイナンバーカード、パスポートなど）
          </p>
          <div className="grid grid-cols-2 gap-3">
            <UploadBox id="ob-upload-1" label="本人確認書類（表）" value={docLicenseFront} onChange={setDocLicenseFront} />
            <UploadBox id="ob-upload-2" label="本人確認書類（裏）" value={docLicenseBack} onChange={setDocLicenseBack} />
          </div>
        </div>

        {/* ── 7. マイナンバー ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">マイナンバー</h2>
          <p className="text-xs text-secondary mb-3">
            マイナンバーカードまたは通知カードの写真をアップロードしてください。
            <br />
            なお、本人確認書類としてマイナンバーカードを既にアップロードしている場合は不要です。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <UploadBox id="ob-upload-3" label="マイナンバーカード（表）" value={docMynumberFront} onChange={setDocMynumberFront} />
            <UploadBox id="ob-upload-4" label="マイナンバーカード（裏）" value={docMynumberBack} onChange={setDocMynumberBack} />
          </div>
        </div>

        {/* ── 8. 年金手帳 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">年金手帳</h2>
          <p className="text-xs text-secondary mb-3">基礎年金番号が記載されたページを撮影してください</p>
          <div className="w-1/2"><UploadBox id="ob-upload-5" label="年金手帳" value={docPensionBook} onChange={setDocPensionBook} /></div>
        </div>

        {/* ── 9. 保有資格 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">住民票</h2>
          <p className="text-xs text-secondary mb-3">
            基本提出をお願いします。手元にない場合は後日提出でも問題ありません。
          </p>
          <div className="w-1/2"><UploadBox id="ob-upload-6" label="住民票" value={docResidentRecord} onChange={setDocResidentRecord} /></div>
        </div>

        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">雇用保険被保険者証</h2>
          <p className="text-xs text-secondary mb-3">
            基本提出をお願いします。手元にない場合は後日提出でも問題ありません。
          </p>
          <div className="w-1/2"><UploadBox id="ob-upload-7" label="雇用保険被保険者証" value={docEmploymentInsurance} onChange={setDocEmploymentInsurance} /></div>
        </div>

        {/* ── 10. 保有資格 ── */}
        <div className="card p-5 mb-3">
          <div className="mb-4">
            <h2 className="text-sm font-medium mb-1">保有資格</h2>
            <p className="text-xs text-secondary">
              IT・エンジニア系資格を広めに用意しています。候補にない資格は自由入力でも追加できます。
            </p>
          </div>
          <div className="rounded-xl border border-border bg-[#FAFAFA] p-4 mb-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-primary mb-2">候補から選択</div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={selectedCert}
                  onChange={(e) => setSelectedCert(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary appearance-none bg-white"
                >
                  <option value="">資格名を選択してください</option>
                  <optgroup label="IT・エンジニア系資格">
                    {IT_CERT_OPTIONS.map((cert) => (
                      <option key={cert} value={cert}>{cert}</option>
                    ))}
                  </optgroup>
                  <optgroup label="その他のよくある資格">
                    {COMMON_CERT_OPTIONS.map((cert) => (
                      <option key={cert} value={cert}>{cert}</option>
                    ))}
                  </optgroup>
                </select>
                <button onClick={addSelectedCert} className="btn-outline text-xs py-1 px-3 whitespace-nowrap">追加</button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px bg-border flex-1" />
              <span className="text-[11px] text-secondary">または</span>
              <div className="h-px bg-border flex-1" />
            </div>

            <div>
              <div className="text-xs font-medium text-primary mb-2">自由入力</div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  placeholder="例：技術士、ISTQB、ウェブデザイン技能検定"
                  value={customCert}
                  onChange={(e) => setCustomCert(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors bg-white"
                />
                <button onClick={addCustomCert} className="btn-outline text-xs py-1 px-3 whitespace-nowrap">追加</button>
              </div>
            </div>
          </div>
          <div className="mb-2 text-xs font-medium text-primary">追加済み資格</div>
          {certs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-secondary text-center">
              まだ資格は追加されていません
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {certs.map((cert, idx) => (
                <div key={idx} className="inline-flex items-center gap-2 px-3 py-2 bg-page rounded-full border border-border">
                  <span className="text-sm">{cert}</span>
                  <button onClick={() => removeCert(idx)} className="text-xs text-red-500 hover:text-red-700">削除</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 送信ボタン ── */}
        <div className="text-center pb-8">
          <button onClick={handleSubmit} disabled={submitting}
            className={`btn-primary px-14 py-3.5 text-sm ${submitting ? 'opacity-50 pointer-events-none' : ''}`}>
            {submitting ? '送信中...' : '送信する'}
          </button>
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
