/**
 * 年末調整ページ
 *
 * 5ステップウィザード: 基本情報→扶養控除→保険料→住宅ローン→確認・提出。
 * 提出後はステータス表示。差し戻し時は再提出可能。
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

const steps = ['基本情報', '扶養控除', '保険料', '住宅ローン', '確認'];

interface YearendRecord {
  id: string;
  status: string;
  formData: any;
  rejectReason: string | null;
  submittedAt: string | null;
}

export default function YearendPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast, ToastUI } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    hasSpouse: 'no',
    hasDependents: 'no',
    lifeInsurance: '',
    earthquakeInsurance: '',
    socialInsurance: '',
    hasHousingLoan: 'no',
    loanBalance: '',
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<YearendRecord | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const currentYear = new Date().getFullYear();

  // 既存データ取得
  useEffect(() => {
    apiClient<YearendRecord | null>(`/yearend/status/${currentYear}`)
      .then((data) => {
        if (data) {
          setRecord(data);
          if (data.formData) {
            setFormData(prev => ({ ...prev, ...data.formData }));
          }
          // open or rejected → ウィザード表示
          if (!data.status || data.status === 'open' || data.status === 'rejected') {
            setShowWizard(true);
          }
        } else {
          setShowWizard(true);
        }
      })
      .catch(() => {
        setShowWizard(true);
      })
      .finally(() => setLoading(false));
  }, [currentYear]);

  // プロフィールから初期値
  useEffect(() => {
    apiClient<any>('/profile')
      .then((profile) => {
        setFormData(prev => ({
          ...prev,
          name: `${profile.lastName} ${profile.firstName}`,
          address: profile.address || '',
        }));
      })
      .catch(() => {
        if (user?.name) {
          setFormData(prev => ({ ...prev, name: user.name }));
        }
      });
  }, [user]);

  function updateField(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  }

  function prevStep() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  async function handleSubmit() {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      await apiClient('/yearend/submit', {
        method: 'POST',
        body: JSON.stringify({ fiscalYear: currentYear, formData }),
      });
      toast('年末調整を提出しました');
      setRecord(prev => prev ? { ...prev, status: 'submitted' } : { id: '', status: 'submitted', formData, rejectReason: null, submittedAt: new Date().toISOString() });
      setShowWizard(false);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '提出に失敗しました';
      toast(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleResubmit() {
    if (record?.formData) {
      setFormData(prev => ({ ...prev, ...record.formData }));
    }
    setCurrentStep(1);
    setShowWizard(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-secondary text-sm">読み込み中...</div>
      </div>
    );
  }

  // ステータス表示（ウィザード非表示時）
  if (!showWizard && record) {
    const statusConfig: Record<string, { label: string; color: string; desc: string }> = {
      submitted: { label: '承認待ち', color: 'bg-status-yellow-bg text-status-yellow-text', desc: '管理者の確認をお待ちください。' },
      approved: { label: '承認済み', color: 'bg-status-green-bg text-status-green-text', desc: '年末調整が承認されました。' },
      rejected: { label: '差し戻し', color: 'bg-status-red-bg text-status-red-text', desc: '修正が必要です。内容を確認して再提出してください。' },
      closed: { label: '受付終了', color: 'bg-gray-100 text-gray-600', desc: '受付期間が終了しました。' },
    };
    const cfg = statusConfig[record.status] || { label: record.status, color: 'bg-gray-100 text-gray-600', desc: '' };

    return (
      <>
        <ToastUI />
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page">‹</button>
            <h1 className="text-lg font-bold text-primary">年末調整</h1>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-md font-medium text-primary">{currentYear}年</span>
              <span className={`px-2.5 py-1 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-sm text-secondary mb-4">{cfg.desc}</p>

            {record.status === 'rejected' && record.rejectReason && (
              <div className="bg-status-red-bg rounded-lg p-4 mb-4">
                <div className="text-sm font-medium text-status-red-text mb-1">差し戻し理由</div>
                <div className="text-sm text-status-red-text">{record.rejectReason}</div>
              </div>
            )}

            {/* 提出済みデータのサマリ */}
            {record.formData && (
              <div className="space-y-2 border-t border-border/20 pt-4">
                {[
                  ['氏名', record.formData.name],
                  ['住所', record.formData.address],
                  ['配偶者', record.formData.hasSpouse === 'yes' ? '有' : '無'],
                  ['扶養親族', record.formData.hasDependents === 'yes' ? '有' : 'なし'],
                  ['生命保険料', record.formData.lifeInsurance ? `${Number(record.formData.lifeInsurance).toLocaleString()}円` : '0円'],
                  ['地震保険料', record.formData.earthquakeInsurance ? `${Number(record.formData.earthquakeInsurance).toLocaleString()}円` : '0円'],
                  ['住宅ローン控除', record.formData.hasHousingLoan === 'yes' ? '有' : '無'],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between text-sm border-b border-border-light pb-2 last:border-b-0">
                    <span className="text-secondary">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {record.status === 'rejected' && (
              <button
                onClick={handleResubmit}
                className="w-full mt-4 py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 transition-all"
              >
                再提出する
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // ウィザード表示
  return (
    <>
      <ToastUI />
      <div className="space-y-5">
        {record?.status === 'rejected' && (
          <div className="bg-status-red-bg rounded-lg p-4">
            <div className="text-sm font-medium text-status-red-text mb-1">差し戻し理由</div>
            <div className="text-sm text-status-red-text">{record.rejectReason}</div>
          </div>
        )}

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-0 py-2">
          {steps.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum === currentStep;
            const isDone = stepNum < currentStep;
            return (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
                    ${isActive ? 'border-primary bg-primary text-white' : ''}
                    ${isDone ? 'border-status-green-text bg-status-green-bg text-status-green-text' : ''}
                    ${!isActive && !isDone ? 'border-border bg-card text-secondary' : ''}`}
                  >
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className={`text-2xs whitespace-nowrap ${isActive ? 'text-primary font-semibold' : 'text-secondary'}`}>
                    {label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-4 sm:w-8 h-px bg-border mx-1 mb-4" />
                )}
              </div>
            );
          })}
        </div>

        {/* ステップ内容 */}
        <div className="card p-5">
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-2">基本情報</h3>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">氏名</label>
                <input type="text" value={formData.name} readOnly className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-page outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">住所</label>
                <input type="text" value={formData.address} readOnly className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-page outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">配偶者の有無</label>
                <div className="flex gap-5">
                  {[['有', 'yes'], ['無', 'no']].map(([label, value]) => (
                    <label key={value} className="flex items-center gap-1.5 text-md cursor-pointer">
                      <input type="radio" name="hasSpouse" value={value} checked={formData.hasSpouse === value} onChange={(e) => updateField('hasSpouse', e.target.value)} className="w-4 h-4 accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-2">扶養控除</h3>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">扶養親族の有無</label>
                <div className="flex gap-5">
                  {[['有', 'yes'], ['無', 'no']].map(([label, value]) => (
                    <label key={value} className="flex items-center gap-1.5 text-md cursor-pointer">
                      <input type="radio" name="hasDependents" value={value} checked={formData.hasDependents === value} onChange={(e) => updateField('hasDependents', e.target.value)} className="w-4 h-4 accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {formData.hasDependents === 'yes' && (
                <div className="p-4 bg-status-blue-bg rounded-lg text-sm text-status-blue-text">
                  扶養親族の情報を入力してください（Phase 2で詳細フォームを実装）
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-2">保険料控除</h3>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">生命保険料（年間支払額）</label>
                <input type="number" placeholder="0" value={formData.lifeInsurance} onChange={(e) => updateField('lifeInsurance', e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">地震保険料（年間支払額）</label>
                <input type="number" placeholder="0" value={formData.earthquakeInsurance} onChange={(e) => updateField('earthquakeInsurance', e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">社会保険料（前職分等）</label>
                <input type="number" placeholder="0" value={formData.socialInsurance} onChange={(e) => updateField('socialInsurance', e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
                <span className="text-2xs text-secondary mt-1 block">※ 当社で天引きされている分は記入不要です</span>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-2">住宅借入金等特別控除</h3>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1">住宅ローン控除の適用</label>
                <div className="flex gap-5">
                  {[['有', 'yes'], ['無', 'no']].map(([label, value]) => (
                    <label key={value} className="flex items-center gap-1.5 text-md cursor-pointer">
                      <input type="radio" name="hasHousingLoan" value={value} checked={formData.hasHousingLoan === value} onChange={(e) => updateField('hasHousingLoan', e.target.value)} className="w-4 h-4 accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {formData.hasHousingLoan === 'yes' && (
                <div>
                  <label className="block text-sm font-semibold text-secondary mb-1">年末残高</label>
                  <input type="number" placeholder="0" value={formData.loanBalance} onChange={(e) => updateField('loanBalance', e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-md bg-card outline-none focus:border-primary" />
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-2">入力内容の確認</h3>
              <div className="space-y-2">
                {[
                  ['氏名', formData.name],
                  ['住所', formData.address],
                  ['配偶者', formData.hasSpouse === 'yes' ? '有' : '無'],
                  ['扶養親族', formData.hasDependents === 'yes' ? '有' : 'なし'],
                  ['生命保険料', formData.lifeInsurance ? `${Number(formData.lifeInsurance).toLocaleString()}円` : '0円'],
                  ['地震保険料', formData.earthquakeInsurance ? `${Number(formData.earthquakeInsurance).toLocaleString()}円` : '0円'],
                  ['住宅ローン控除', formData.hasHousingLoan === 'yes' ? '有' : '無'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-md border-b border-border-light pb-2 last:border-b-0">
                    <span className="text-secondary">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ナビゲーションボタン */}
          <div className="flex gap-3 mt-6">
            {currentStep > 1 && (
              <button onClick={prevStep} className="flex-1 py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors">
                戻る
              </button>
            )}
            {currentStep < 5 ? (
              <button onClick={nextStep} className="flex-1 py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 transition-all">
                次へ
              </button>
            ) : (
              <button onClick={() => setShowConfirm(true)} disabled={submitting} className="flex-1 py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                {submitting ? '送信中...' : record?.status === 'rejected' ? '再提出する' : '提出する'}
              </button>
            )}
          </div>
        </div>

        {/* 確認モーダル */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/35 z-[200] flex items-center justify-center p-6" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
            <div className="bg-card rounded-2xl w-full max-w-[400px] overflow-hidden">
              <div className="px-5 pt-5 pb-3 text-lg font-bold">年末調整の提出確認</div>
              <div className="px-5 pb-5 space-y-2.5">
                <div className="flex justify-between text-md"><span className="text-secondary">対象年度</span><span className="font-medium">{currentYear}年分</span></div>
                <div className="flex justify-between text-md"><span className="text-secondary">氏名</span><span className="font-medium">{formData.name}</span></div>
              </div>
              <div className="flex border-t border-border-light">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3.5 text-md text-secondary hover:bg-page transition-colors">いいえ</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3.5 text-md font-semibold text-primary border-l border-border-light hover:bg-page transition-colors disabled:opacity-50">
                  {submitting ? '送信中...' : 'はい'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
