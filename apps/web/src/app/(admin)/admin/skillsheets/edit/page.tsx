/**
 * 管理側 スキルシート編集ページ
 *
 * HTMLプロトタイプ page-ss-edit を完全再現。
 * セクション: 基本情報 → 自己PR → テクニカルスキル → 業務経歴 → 保有資格
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */

interface SkillRow {
  cat: string;
  items: string;
}

interface ProjectRow {
  period: string;
  name: string;
  client: string;
  role: string;
  env: string;
  detail: string;
}

interface SSForm {
  name: string;
  age: string;
  edu: string;
  exp: string;
  station: string;
  pr: string;
}

/* ---------- デモデータ ---------- */

const initialForm: SSForm = {
  name: '山田 太郎',
  age: '28歳',
  edu: '大阪大学 工学部',
  exp: '5年',
  station: 'JR大阪駅',
  pr: '',
};

const initialSkills: SkillRow[] = [
  { cat: '言語', items: 'Java, TypeScript, Python' },
  { cat: 'FW', items: 'Spring Boot, React, Next.js' },
  { cat: 'DB', items: 'PostgreSQL, MySQL, Redis' },
  { cat: 'インフラ', items: 'AWS, Docker, Kubernetes' },
];

const initialProjects: ProjectRow[] = [
  {
    period: '2024/04 - 現在',
    name: '勘定系マイグレーション',
    client: 'メガバンクシステムズ',
    role: 'SE',
    env: 'Java, Spring Boot, Oracle',
    detail: '基幹システムのクラウド移行対応。要件定義から結合テストまで担当。',
  },
  {
    period: '2022/10 - 2024/03',
    name: 'EC サイトリニューアル',
    client: 'リテールテック',
    role: 'PG',
    env: 'TypeScript, React, Node.js, PostgreSQL',
    detail: 'フロントエンド開発およびAPI設計・実装を担当。',
  },
];

const demoCerts = [
  '基本情報技術者試験',
  'AWS Solutions Architect Associate',
  'Oracle Certified Java Programmer Silver',
];

/* ---------- 共通スタイル ---------- */

const labelCls = 'block text-[11px] text-secondary mb-[3px]';
const inputCls =
  'w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary/40 transition-colors';
const readonlyCls =
  'w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none bg-[#F7F7F5]';

/* ---------- メインコンポーネント ---------- */

export default function SkillsheetEditPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [form, setForm] = useState<SSForm>(initialForm);
  const [skills, setSkills] = useState<SkillRow[]>(initialSkills);
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);

  const set = (key: keyof SSForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  /* -- スキル操作 -- */
  const addSkill = () => setSkills((prev) => [...prev, { cat: '', items: '' }]);
  const removeSkill = (i: number) => setSkills((prev) => prev.filter((_, idx) => idx !== i));
  const updateSkill = (i: number, field: keyof SkillRow, value: string) =>
    setSkills((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  /* -- 経歴操作 -- */
  const addProject = () =>
    setProjects((prev) => [{ period: '', name: '', client: '', role: '', env: '', detail: '' }, ...prev]);
  const removeProject = (i: number) => setProjects((prev) => prev.filter((_, idx) => idx !== i));
  const updateProject = (i: number, field: keyof ProjectRow, value: string) =>
    setProjects((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  const handleSave = () => {
    toast('スキルシートを保存しました');
    router.push('/admin/skillsheets/preview');
  };

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">スキルシート編集</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/skillsheets/preview')}
            className="btn-outline text-sm py-2"
          >
            キャンセル
          </button>
          <button
            onClick={() => toast('Excel出力は今後追加予定です')}
            className="btn-outline text-sm py-2"
          >
            Excelダウンロード
          </button>
          <button
            onClick={() => {
              toast('スキルシートを保存しました');
              router.push('/admin/skillsheets/preview');
            }}
            className="btn-outline text-sm py-2"
          >
            PDFダウンロード
          </button>
          <button onClick={handleSave} className="btn-primary text-sm py-2">
            保存
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760 }}>
        {/* ===== 基本情報 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">基本情報</div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className={labelCls}>氏名</label>
              <input type="text" className={readonlyCls} value={form.name} readOnly />
            </div>
            <div>
              <label className={labelCls}>年齢</label>
              <input type="text" className={readonlyCls} value={form.age} readOnly />
            </div>
            <div>
              <label className={labelCls}>最終学歴</label>
              <input type="text" className={readonlyCls} value={form.edu} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>経験年数</label>
              <input
                type="text"
                className={inputCls}
                placeholder="5年"
                value={form.exp}
                onChange={set('exp')}
              />
            </div>
            <div>
              <label className={labelCls}>最寄駅</label>
              <input
                type="text"
                className={inputCls}
                placeholder="JR大阪駅"
                value={form.station}
                onChange={set('station')}
              />
            </div>
          </div>
        </div>

        {/* ===== 自己PR・得意分野 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">自己PR・得意分野</div>
          <textarea
            className="w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary/40 transition-colors resize-y font-[inherit]"
            style={{ height: 80 }}
            placeholder="得意な技術領域、業務経験のアピールポイントなど"
            value={form.pr}
            onChange={set('pr')}
          />
        </div>

        {/* ===== テクニカルスキル ===== */}
        <div className="card p-5 mb-3">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium">テクニカルスキル</div>
            <button
              onClick={addSkill}
              className="btn-outline text-[11px] py-1 px-3"
            >
              スキル追加
            </button>
          </div>
          <div className="space-y-1.5">
            {skills.map((sk, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  type="text"
                  className="w-20 shrink-0 border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none bg-[#F7F7F5] font-medium"
                  value={sk.cat}
                  onChange={(e) => updateSkill(i, 'cat', e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40 transition-colors"
                  placeholder="スキル（カンマ区切り）"
                  value={sk.items}
                  onChange={(e) => updateSkill(i, 'items', e.target.value)}
                />
                <button
                  onClick={() => removeSkill(i)}
                  className="btn-outline shrink-0 text-[10px] py-0.5 px-2 text-[#A32D2D] border-[#E24B4A]"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ===== 業務経歴 ===== */}
        <div className="card p-5 mb-3">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium">業務経歴</div>
            <button
              onClick={addProject}
              className="btn-outline text-[11px] py-1 px-3"
            >
              経歴追加
            </button>
          </div>
          <div className="space-y-2">
            {projects.map((p, i) => (
              <div key={i} className="card p-3 bg-[#FAFAFA]">
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <div>
                    <label className="block text-[10px] text-[#999]">期間</label>
                    <input
                      type="text"
                      className="w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
                      value={p.period}
                      onChange={(e) => updateProject(i, 'period', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#999]">案件名</label>
                    <input
                      type="text"
                      className="w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
                      value={p.name}
                      onChange={(e) => updateProject(i, 'name', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  <div>
                    <label className="block text-[10px] text-[#999]">クライアント</label>
                    <input
                      type="text"
                      className="w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
                      value={p.client}
                      onChange={(e) => updateProject(i, 'client', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#999]">役割</label>
                    <input
                      type="text"
                      className="w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
                      value={p.role}
                      onChange={(e) => updateProject(i, 'role', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#999]">環境</label>
                    <input
                      type="text"
                      className="w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
                      value={p.env}
                      onChange={(e) => updateProject(i, 'env', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-[#999]">業務内容</label>
                  <textarea
                    className="w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none resize-y font-[inherit] focus:border-primary/40"
                    style={{ height: 40 }}
                    value={p.detail}
                    onChange={(e) => updateProject(i, 'detail', e.target.value)}
                  />
                </div>
                <div className="text-right mt-1">
                  <button
                    onClick={() => removeProject(i)}
                    className="btn-outline text-[10px] py-0.5 px-2 text-[#A32D2D] border-[#E24B4A]"
                  >
                    この経歴を削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== 保有資格 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-2">保有資格</div>
          <div className="text-[13px] text-secondary">
            {demoCerts.map((c, i) => (
              <div key={i} className="py-0.5">{c}</div>
            ))}
          </div>
          <div className="text-[10px] text-[#999] mt-1.5">
            ※ 社員情報の資格データから自動反映
          </div>
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
