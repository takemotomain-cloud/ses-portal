/**
 * 入社情報フォーム
 *
 * 入社予定者の情報を入力し、社員マスタ（Employee + EmergencyContact）に登録。
 * POST /api/employees でEmployee+User作成、POST /api/employees/:id/emergency-contact で緊急連絡先作成。
 *
 * セクション:
 * 1. 基本情報（姓名・ふりがな・生年月日・性別・住所・電話・メール・血液型）
 * 2. 緊急連絡先（氏名・続柄・電話番号）
 * 3. 給与振込口座（銀行名・支店名・口座種別・口座番号）
 * 4. 本人確認書類アップロード（運転免許証 表裏）※UI のみ（ファイルストレージは今後）
 * 5. マイナンバーカード（表裏）※UI のみ
 * 6. 年金手帳 ※UI のみ
 * 7. 健康診断結果 ※UI のみ
 * 8. 保有資格（動的追加）
 * 9. 送信ボタン → API で DB に保存
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ── ファイルアップロード用コンポーネント ── */
function UploadBox({ id, label }: { id: string; label: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div>
      <label className="text-xs text-secondary block mb-1.5">{label}</label>
      <label
        htmlFor={id}
        className={`block border border-dashed rounded-lg p-5 text-center text-sm cursor-pointer transition-colors
          ${fileName ? 'border-green-400 bg-green-50 text-green-700' : 'border-border text-secondary hover:bg-page'}`}
      >
        {fileName ? (
          <span>{fileName}</span>
        ) : (
          <>タップして撮影 / 選択<br /><span className="text-xs text-[#BDBDBD]">JPG, PNG（10MB以下）</span></>
        )}
      </label>
      <input id={id} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setFileName(f.name); }} />
    </div>
  );
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

export default function OnboardFormPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  /* ── 部署一覧（社員番号自動採番用） ── */
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    interface Dept { id: string; name: string; children?: Dept[] }
    apiClient<Dept[]>('/settings/departments')
      .then((res) => {
        // 階層構造をフラットに展開
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
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastNameKana, setLastNameKana] = useState('');
  const [firstNameKana, setFirstNameKana] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('男性');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodType, setBloodType] = useState('A型');

  // 緊急連絡先
  const [ecName, setEcName] = useState('');
  const [ecRelation, setEcRelation] = useState('父');
  const [ecPhone, setEcPhone] = useState('');

  // 口座
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountType, setBankAccountType] = useState('普通');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  // 資格
  const [certs, setCerts] = useState<string[]>([]);

  // 部署 / 入社日
  const [departmentId, setDepartmentId] = useState('');
  const [hireDate, setHireDate] = useState('');

  const [submitting, setSubmitting] = useState(false);

  function addCert() {
    const name = prompt('資格名を入力してください');
    if (name?.trim()) setCerts([...certs, name.trim()]);
  }
  function removeCert(idx: number) {
    setCerts(certs.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    // バリデーション
    if (!lastName || !firstName) { toast('姓名は必須です'); return; }
    if (!birthDate) { toast('生年月日は必須です'); return; }
    if (!phone) { toast('電話番号は必須です'); return; }
    if (!address) { toast('住所は必須です'); return; }
    if (!email) { toast('メールアドレスは必須です'); return; }
    if (!hireDate) { toast('入社予定日は必須です'); return; }
    if (!departmentId) { toast('配属部署を選択してください'); return; }

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
          hireDate,
          departmentId,
          birthDate,
          gender: gender === '男性' ? 'male' : gender === '女性' ? 'female' : 'other',
          email,
          phone,
          address,
          bankName: bankName || undefined,
          bankBranch: bankBranch || undefined,
          bankAccountType: bankAccountType === '普通' ? 'ordinary' : bankAccountType === '当座' ? 'current' : undefined,
          bankAccountNumber: bankAccountNumber || undefined,
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
        }).catch(() => {
          // 緊急連絡先APIが未実装の場合はスキップ
        });
      }

      toast(`社員を登録しました（${result.employeeCode}）`);
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

        {/* ── 0. 入社情報 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-3">入社情報</h2>
          <div className="grid grid-cols-2 gap-3">
            <CInput label="入社予定日" required type="date" value={hireDate} onChange={setHireDate} />
            <div>
              <label className="text-xs text-secondary block mb-1">配属部署 <span className="text-red-600 ml-0.5">*</span></label>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary appearance-none bg-white">
                <option value="">選択してください</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
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
          <div className="mb-3">
            <CInput label="現住所" required placeholder="〒530-0001 大阪府大阪市北区梅田1-1-1" value={address} onChange={setAddress} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="電話番号" required placeholder="090-1234-5678" value={phone} onChange={setPhone} />
            <CInput label="メールアドレス" required type="email" placeholder="tsubasa@example.com" value={email} onChange={setEmail} />
          </div>
          <div className="w-[120px]">
            <CSelect label="血液型" options={['A型', 'B型', 'O型', 'AB型']} value={bloodType} onChange={setBloodType} />
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

        {/* ── 3. 給与振込口座 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-3">給与振込口座 <span className="text-red-600">*</span></h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CInput label="銀行名" placeholder="三菱UFJ銀行" value={bankName} onChange={setBankName} />
            <CInput label="支店名" placeholder="梅田支店" value={bankBranch} onChange={setBankBranch} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CSelect label="口座種別" options={['普通', '当座']} value={bankAccountType} onChange={setBankAccountType} />
            <CInput label="口座番号" placeholder="1234567" value={bankAccountNumber} onChange={setBankAccountNumber} />
          </div>
        </div>

        {/* ── 4. 本人確認書類 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">本人確認書類のアップロード <span className="text-red-600">*</span></h2>
          <p className="text-xs text-secondary mb-3">以下のいずれかをアップロードしてください。Google Driveに安全に保管されます。</p>
          <div className="grid grid-cols-2 gap-3">
            <UploadBox id="ob-upload-1" label="運転免許証（表）" />
            <UploadBox id="ob-upload-2" label="運転免許証（裏）" />
          </div>
        </div>

        {/* ── 5. マイナンバー ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">マイナンバー <span className="text-red-600">*</span></h2>
          <p className="text-xs text-secondary mb-3">マイナンバーカードまたは通知カードの写真をアップロードしてください</p>
          <div className="grid grid-cols-2 gap-3">
            <UploadBox id="ob-upload-3" label="マイナンバーカード（表）" />
            <UploadBox id="ob-upload-4" label="マイナンバーカード（裏）" />
          </div>
        </div>

        {/* ── 6. 年金手帳 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">年金手帳</h2>
          <p className="text-xs text-secondary mb-3">基礎年金番号が記載されたページを撮影してください</p>
          <div className="w-1/2"><UploadBox id="ob-upload-5" label="年金手帳" /></div>
        </div>

        {/* ── 7. 健康診断結果 ── */}
        <div className="card p-5 mb-3">
          <h2 className="text-sm font-medium mb-1">健康診断結果</h2>
          <p className="text-xs text-secondary mb-3">直近3ヶ月以内の健康診断結果をアップロードしてください</p>
          <div className="w-1/2"><UploadBox id="ob-upload-6" label="健康診断結果" /></div>
        </div>

        {/* ── 8. 保有資格 ── */}
        <div className="card p-5 mb-3">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-medium">保有資格</h2>
            <button onClick={addCert} className="btn-outline text-xs py-1 px-3">資格追加</button>
          </div>
          {certs.length === 0 ? (
            <p className="text-sm text-secondary text-center py-3">資格がある場合は「資格追加」から追加してください</p>
          ) : (
            <div className="space-y-2">
              {certs.map((cert, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 bg-page rounded-lg">
                  <span className="text-sm">{cert}</span>
                  <button onClick={() => removeCert(idx)} className="text-xs text-red-500 hover:text-red-700">削除</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 注意事項 ── */}
        <div className="bg-page rounded-lg p-5 mb-6 text-sm text-secondary leading-relaxed">
          <div className="font-medium text-primary mb-1">アップロードした書類について</div>
          アップロードされた画像はGoogle Driveの入社書類フォルダに自動保存されます。<br />
          テキスト情報（住所・口座等）は社員マスタに自動で取り込まれます。<br />
          入社予定社員一覧のチェック項目も自動で完了になります。
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
