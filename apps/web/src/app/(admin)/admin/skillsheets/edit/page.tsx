/**
 * 管理側 スキルシート プレビュー＆編集ページ
 *
 * デフォルトはプレビュー表示。「編集する」で編集モードに切替。
 * 社員マスタから氏名・年齢・学歴を自動取得（読み取り専用）。
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- 型定義 ---------- */

interface ProjectRow {
  periodFrom: string;
  periodTo: string;
  content: string;
  role: string;
  scale: string;
  languages: string[];
  db: string[];
  fw: string[];
  ticketMgmt: string[];
  sqlTool: string[];
  editor: string[];
  container: string[];
  buildTool: string[];
  vcs: string[];
  cicd: string[];
  infra: string[];
  cloud: string[];
  communication: string[];
  otherTools: string[];
  phases: string[];
}

const PHASE_LIST = ['要件定義', '基本設計', '詳細設計', '製造・コーディング', '単体テスト', '結合テスト', '総合テスト', '保守・運用'];
const ROLE_OPTIONS = ['PG', 'SE', 'PL', 'PM', 'TL', 'アーキテクト', 'その他'];
const LANG_OPTIONS = ['Java', 'JavaScript', 'TypeScript', 'Python', 'C#', 'PHP', 'Go', 'Ruby', 'HTML', 'CSS', 'C', 'C++', 'Swift', 'Kotlin', 'Rust', 'Scala', 'R', 'Dart', 'SQL', 'Shell', 'VBA', 'COBOL', 'Perl'];
const DB_OPTIONS = ['PostgreSQL', 'MySQL', 'Oracle', 'SQL Server', 'MongoDB', 'Redis', 'DynamoDB', 'SQLite', 'MariaDB', 'Cassandra', 'Elasticsearch'];
const FW_OPTIONS = ['Spring Boot', 'React', 'Vue.js', 'Next.js', 'Angular', 'Laravel', 'Django', 'ASP.NET', 'Nuxt.js', 'Flask', 'FastAPI', 'Rails', 'Express', 'NestJS', '.NET', 'Flutter', 'SwiftUI', 'MyBatis', 'Hibernate', 'Thymeleaf', 'jQuery'];
const TICKET_OPTIONS = ['Jira', 'Redmine', 'Backlog', 'Azure DevOps', 'GitHub Issues', 'GitLab Issues', 'Trello', 'Asana', 'Linear', 'Notion'];
const SQL_TOOL_OPTIONS = ['A5:SQL MKⅡ', 'pgAdmin', 'phpMyAdmin', 'Oracle SQL Developer', 'MySQL Workbench', 'DBeaver', 'DataGrip', 'HeidiSQL'];
const EDITOR_OPTIONS = ['VSCode', 'IntelliJ', 'Eclipse', 'Visual Studio', 'Xcode', 'Android Studio', 'Vim', 'Emacs', 'Sublime Text', 'Cursor'];
const CONTAINER_OPTIONS = ['Docker', 'Kubernetes', 'Docker Compose', 'Podman', 'ECS', 'EKS', 'GKE', 'AKS', 'OpenShift'];
const BUILD_TOOL_OPTIONS = ['Maven', 'Gradle', 'npm', 'yarn', 'pnpm', 'Webpack', 'Vite', 'Turbopack', 'Make', 'CMake', 'Bazel', 'Ant'];
const VCS_OPTIONS = ['Git', 'GitHub', 'GitLab', 'GitBucket', 'Bitbucket', 'SVN', 'Azure Repos'];
const CICD_OPTIONS = ['Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI', 'Travis CI', 'AWS CodePipeline', 'Azure DevOps', 'ArgoCD', 'Terraform'];
const INFRA_OPTIONS = ['Linux', 'Windows Server', 'macOS', 'CentOS', 'Ubuntu', 'Red Hat', 'Amazon Linux', 'Nginx', 'Apache', 'Tomcat', 'IIS'];
const CLOUD_OPTIONS = ['AWS', 'GCP', 'Azure', 'Heroku', 'Vercel', 'Netlify', 'Cloudflare', 'さくらクラウド', 'Oracle Cloud'];
const COMM_OPTIONS = ['Slack', 'Microsoft Teams', 'Chatwork', 'Google Chat', 'Discord', 'Zoom', 'Google Meet', 'Confluence', 'Miro'];
const OTHER_TOOL_OPTIONS = ['Excel', 'PowerPoint', 'Word', 'OneNote', 'さくらエディタ', 'Figma', 'Swagger', 'Postman', 'Grafana', 'Datadog', 'Sentry', 'SonarQube', 'Kibana', 'Draw.io', 'PlantUML'];
/** 技術スタックのカテゴリ定義 */
const TECH_CATEGORIES: { key: keyof ProjectRow; label: string; options: string[] }[] = [
  { key: 'languages', label: '使用言語', options: LANG_OPTIONS },
  { key: 'db', label: 'DB', options: DB_OPTIONS },
  { key: 'fw', label: 'FW', options: FW_OPTIONS },
  { key: 'ticketMgmt', label: 'チケット管理', options: TICKET_OPTIONS },
  { key: 'sqlTool', label: 'SQLツール', options: SQL_TOOL_OPTIONS },
  { key: 'editor', label: 'エディタ', options: EDITOR_OPTIONS },
  { key: 'container', label: 'コンテナ', options: CONTAINER_OPTIONS },
  { key: 'buildTool', label: 'ビルドツール', options: BUILD_TOOL_OPTIONS },
  { key: 'vcs', label: 'バージョン管理', options: VCS_OPTIONS },
  { key: 'cicd', label: 'CI/CD', options: CICD_OPTIONS },
  { key: 'infra', label: 'インフラ', options: INFRA_OPTIONS },
  { key: 'cloud', label: 'クラウド', options: CLOUD_OPTIONS },
  { key: 'communication', label: 'コミュニケーション', options: COMM_OPTIONS },
  { key: 'otherTools', label: 'その他ツール', options: OTHER_TOOL_OPTIONS },
];

const emptyProject = (): ProjectRow => ({
  periodFrom: '', periodTo: '', content: '', role: '', scale: '',
  languages: [], db: [], fw: [], ticketMgmt: [], sqlTool: [], editor: [],
  container: [], buildTool: [], vcs: [], cicd: [], infra: [], cloud: [],
  communication: [], otherTools: [], phases: [],
});

/* ---------- カナ→ローマ字イニシャル ---------- */

const KANA_MAP: Record<string, string> = {
  'ア':'A','イ':'I','ウ':'U','エ':'E','オ':'O',
  'カ':'KA','キ':'KI','ク':'KU','ケ':'KE','コ':'KO',
  'サ':'SA','シ':'SI','ス':'SU','セ':'SE','ソ':'SO',
  'タ':'TA','チ':'TI','ツ':'TU','テ':'TE','ト':'TO',
  'ナ':'NA','ニ':'NI','ヌ':'NU','ネ':'NE','ノ':'NO',
  'ハ':'HA','ヒ':'HI','フ':'HU','ヘ':'HE','ホ':'HO',
  'マ':'MA','ミ':'MI','ム':'MU','メ':'ME','モ':'MO',
  'ヤ':'YA','ユ':'YU','ヨ':'YO',
  'ラ':'RA','リ':'RI','ル':'RU','レ':'RE','ロ':'RO',
  'ワ':'WA','ヲ':'WO','ン':'N',
  'ガ':'GA','ギ':'GI','グ':'GU','ゲ':'GE','ゴ':'GO',
  'ザ':'ZA','ジ':'ZI','ズ':'ZU','ゼ':'ZE','ゾ':'ZO',
  'ダ':'DA','ヂ':'DI','ヅ':'DU','デ':'DE','ド':'DO',
  'バ':'BA','ビ':'BI','ブ':'BU','ベ':'BE','ボ':'BO',
  'パ':'PA','ピ':'PI','プ':'PU','ペ':'PE','ポ':'PO',
};

function toRomajiInitial(nameKana: string): string {
  if (!nameKana) return '';
  const parts = nameKana.trim().split(/\s+/);
  if (parts.length < 2) return '';
  const lastInit = KANA_MAP[parts[0].charAt(0)]?.charAt(0) || parts[0].charAt(0);
  const firstInit = KANA_MAP[parts[1].charAt(0)]?.charAt(0) || parts[1].charAt(0);
  return `${firstInit}.${lastInit}.`;
}

/* ---------- 年齢計算 ---------- */

function calcAge(birthDate: string): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age}歳`;
}

/* ---------- 経験年数自動計算 ---------- */

function calcExperience(projects: ProjectRow[]): string {
  if (projects.length === 0) return '';
  let minDate = '', maxDate = '';
  for (const p of projects) {
    if (p.periodFrom && (!minDate || p.periodFrom < minDate)) minDate = p.periodFrom;
    if (p.periodTo && (!maxDate || p.periodTo > maxDate)) maxDate = p.periodTo;
    if (p.periodFrom && (!maxDate || p.periodFrom > maxDate)) maxDate = p.periodFrom;
  }
  if (!minDate || !maxDate) return '';
  const from = new Date(minDate);
  const to = new Date(maxDate);
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}ヶ月`;
  if (rem === 0) return `${years}年`;
  return `${years}年${rem}ヶ月`;
}

/* ---------- 複数選択ドロップダウン ---------- */

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };
  const addCustom = () => {
    const val = customInput.trim();
    if (val && !selected.includes(val)) {
      onChange([...selected, val]);
    }
    setCustomInput('');
  };
  return (
    <div className="relative">
      <div
        className="w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none cursor-pointer bg-white min-h-[30px] flex flex-wrap gap-1 items-center"
        onClick={() => setOpen(!open)}
      >
        {selected.length === 0 ? (
          <span className="text-[#999]">{placeholder}</span>
        ) : (
          selected.map(v => (
            <span key={v} className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px]">
              {v}
              <button className="ml-1 text-primary/60 hover:text-primary" onClick={e => { e.stopPropagation(); toggle(v); }}>&times;</button>
            </span>
          ))
        )}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-[50]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-border/30 rounded-md shadow-lg z-[51] max-h-[250px] overflow-y-auto w-full">
            {/* テキスト入力で追加 */}
            <div className="flex gap-1 p-2 border-b border-border/20 sticky top-0 bg-white">
              <input
                type="text"
                className="flex-1 border border-border/30 rounded px-2 py-1 text-xs outline-none focus:border-primary/40"
                placeholder="追加入力..."
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                onClick={e => e.stopPropagation()}
              />
              <button
                onClick={e => { e.stopPropagation(); addCustom(); }}
                className="text-xs text-primary px-2 py-1 hover:bg-primary/10 rounded shrink-0"
              >追加</button>
            </div>
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F5F5F3] cursor-pointer text-xs">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="rounded" />
                {opt}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- スタイル ---------- */

const inputCls = 'w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary/40 transition-colors';
const inputSmCls = 'w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40';
const selectSmCls = 'w-full border border-border/30 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary/40 bg-white';

/* ========== プレビュー ========== */

function PreviewView({
  empName, empNameKana, empAge, empEdu, gender, experience, station, selfPr, projects, certs,
}: {
  empName: string; empNameKana: string; empAge: string; empEdu: string; gender: string;
  experience: string; station: string; selfPr: string;
  projects: ProjectRow[]; certs: string[];
}) {
  const thCls = 'px-4 py-2.5 text-sm font-medium bg-[#F5F5F3] border border-border/30 text-left align-top whitespace-nowrap';
  const tdCls = 'px-4 py-2.5 text-sm border border-border/30';

  return (
    <div className="bg-white rounded-lg border border-border/30 p-8 max-w-[900px] mx-auto print:rounded-none print:p-4 print:max-w-none print:border-0">
      <h2 className="text-xl font-medium text-center mb-6">スキルシート</h2>

      {/* 基本情報 */}
      <h3 className="text-sm font-medium mb-2">基本情報</h3>
      <hr className="border-t-2 border-[#333] mb-3" />
      <table className="w-full border-collapse mb-6">
        <tbody>
          <tr>
            <th className={thCls} style={{width:100}}>氏名</th>
            <td className={tdCls}>{toRomajiInitial(empNameKana) || empName || '--'}</td>
            <th className={thCls} style={{width:100}}>年齢</th>
            <td className={tdCls}>{empAge || '--'}</td>
            <th className={thCls} style={{width:100}}>性別</th>
            <td className={tdCls}>{gender || '--'}</td>
          </tr>
          <tr>
            <th className={thCls}>最終学歴</th>
            <td className={tdCls}>{empEdu || '--'}</td>
            <th className={thCls}>経験年数</th>
            <td className={tdCls}>{experience || '--'}</td>
            <th className={thCls}>最寄駅</th>
            <td className={tdCls}>{station || '--'}</td>
          </tr>
        </tbody>
      </table>

      {/* 自己PR */}
      {selfPr && (
        <>
          <h3 className="text-sm font-medium mb-2">自己PR・得意分野</h3>
          <hr className="border-t-2 border-[#333] mb-3" />
          <p className="text-sm whitespace-pre-wrap mb-6">{selfPr}</p>
        </>
      )}

      {/* 保有資格 */}
      <h3 className="text-sm font-medium mb-2">保有資格</h3>
      <hr className="border-t-2 border-[#333] mb-3" />
      {certs.length > 0 ? (
        <div className="mb-6 space-y-1">{certs.map((c, i) => <p key={i} className="text-sm">{c}</p>)}</div>
      ) : <p className="text-sm text-secondary mb-6">--</p>}

      {/* 業務経歴 */}
      <h3 className="text-sm font-medium mb-2">業務経歴</h3>
      <hr className="border-t-2 border-[#333] mb-3" />
      {projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((p, i) => {
            const fmtMonth = (v: string) => {
              if (!v) return '';
              const [y, m] = v.split('-');
              return `${y}年${m}月`;
            };
            const fromLabel = fmtMonth(p.periodFrom);
            const toLabel = fmtMonth(p.periodTo);
            const periodStr = fromLabel && toLabel ? `${fromLabel} 〜 ${toLabel}` : fromLabel || '--';
            return (
              <div key={i} className="border border-border/30 rounded overflow-hidden">
                {/* ヘッダー行: 期間・役割・規模 */}
                <div className="bg-[#2c3e6b] text-white px-4 py-2 flex items-center gap-6 text-sm">
                  <span><span className="text-white/70 mr-1">期間：</span><span className="font-medium">{periodStr}</span></span>
                  <span><span className="text-white/70 mr-1">役割：</span>{p.role || '--'}</span>
                  <span><span className="text-white/70 mr-1">規模：</span>{p.scale ? `${p.scale}名` : '--'}</span>
                </div>
                {/* 担当工程（ヘッダー直下） */}
                <div className="bg-white border-b border-border/20 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        {PHASE_LIST.map(ph => (
                          <th key={ph} className="border-x border-border/20 px-2 py-1.5 text-center font-normal text-secondary whitespace-nowrap bg-[#F5F5F3]">{ph}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {PHASE_LIST.map(ph => (
                          <td key={ph} className="border-x border-border/20 px-2 py-1.5 text-center">{p.phases.includes(ph) ? <span className="text-sm">●</span> : <span className="text-secondary">−</span>}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* 業務内容 */}
                <div className="px-4 py-3 border-b border-border/20 bg-white">
                  <div className="text-xs text-secondary mb-1">業務内容</div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{p.content || '--'}</div>
                </div>
                {/* 技術スタック（横並びグリッド） */}
                <div className="px-4 py-3 bg-[#FAFAFA] grid grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                  {TECH_CATEGORIES.map(({ key, label }) => {
                    const val = p[key];
                    const items = Array.isArray(val) ? val as string[] : [];
                    if (items.length === 0) return null;
                    return (
                      <div key={key}><span className="text-secondary">{label}：</span>{items.join(', ')}</div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="text-sm text-secondary">--</p>}
    </div>
  );
}

/* ========== 編集ビュー ========== */

function EditView({
  gender, experience, station,
  selfPr, setSelfPr, projects, setProjects, certs,
  empName, empAge, empEdu,
}: {
  gender: string;
  experience: string; station: string;
  selfPr: string; setSelfPr: (v: string) => void;
  projects: ProjectRow[]; setProjects: React.Dispatch<React.SetStateAction<ProjectRow[]>>;
  certs: string[];
  empName: string; empAge: string; empEdu: string;
}) {
  const labelCls = 'block text-[11px] text-secondary mb-[3px]';
  const readonlyCls = 'w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none bg-[#F7F7F5]';

  const addProject = () => setProjects(prev => [emptyProject(), ...prev]);
  const removeProject = (i: number) => setProjects(prev => prev.filter((_, idx) => idx !== i));
  const updateProject = <K extends keyof ProjectRow>(i: number, field: K, value: ProjectRow[K]) =>
    setProjects(prev => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  return (
    <div style={{ maxWidth: 900 }}>
      {/* 基本情報（社員マスタから取得 — 読み取り専用） */}
      <div className="card p-5 mb-3">
        <div className="text-sm font-medium mb-3">基本情報<span className="text-[10px] text-secondary ml-2 font-normal">※ 社員情報から自動取得</span></div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div>
            <label className={labelCls}>氏名</label>
            <input type="text" className={readonlyCls} value={empName} readOnly />
          </div>
          <div>
            <label className={labelCls}>年齢</label>
            <input type="text" className={readonlyCls} value={empAge} readOnly />
          </div>
          <div>
            <label className={labelCls}>性別</label>
            <input type="text" className={readonlyCls} value={gender} readOnly />
          </div>
          <div>
            <label className={labelCls}>最終学歴</label>
            <input type="text" className={readonlyCls} value={empEdu} readOnly />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>経験年数（案件期間から自動計算）</label>
            <input type="text" className={readonlyCls} value={experience} readOnly />
          </div>
          <div>
            <label className={labelCls}>最寄駅</label>
            <input type="text" className={readonlyCls} value={station} readOnly />
          </div>
        </div>
      </div>

      {/* 自己PR */}
      <div className="card p-5 mb-3">
        <div className="text-sm font-medium mb-3">自己PR・得意分野</div>
        <textarea
          className="w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary/40 transition-colors resize-y font-[inherit]"
          style={{ height: 80 }}
          placeholder="得意な技術領域、業務経験のアピールポイントなど"
          value={selfPr}
          onChange={e => setSelfPr(e.target.value)}
        />
      </div>

      {/* 保有資格（社員マスタから取得 — 読み取り専用） */}
      <div className="card p-5 mb-3">
        <div className="text-sm font-medium mb-3">保有資格<span className="text-[10px] text-secondary ml-2 font-normal">※ 社員情報から自動取得</span></div>
        {certs.length === 0 ? (
          <div className="text-sm text-secondary py-2">社員情報に資格が登録されていません</div>
        ) : (
          <div className="space-y-1.5">
            {certs.map((c, i) => (
              <div key={i} className="px-3 py-2 bg-[#F7F7F5] rounded-md text-sm">{c}</div>
            ))}
          </div>
        )}
      </div>

      {/* 業務経歴 */}
      <div className="card p-5 mb-3">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-medium">業務経歴</div>
          <button onClick={addProject} className="btn-outline text-[11px] py-1 px-3">経歴追加</button>
        </div>
        {projects.length === 0 && <div className="text-sm text-secondary py-2">経歴を追加してください</div>}
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="card p-4 bg-[#FAFAFA]">
              {/* 上段: 期間・役割・規模 */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                <div>
                  <label className="block text-[10px] text-[#999]">期間（開始）</label>
                  <input type="month" className={inputSmCls} value={p.periodFrom} onChange={e => updateProject(i, 'periodFrom', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-[#999]">期間（終了）</label>
                  <input type="month" className={inputSmCls} value={p.periodTo} onChange={e => updateProject(i, 'periodTo', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-[#999]">役割</label>
                  {ROLE_OPTIONS.includes(p.role) || p.role === '' ? (
                    <select className={selectSmCls} value={p.role} onChange={e => {
                      const v = e.target.value;
                      updateProject(i, 'role', v === '__custom' ? ' ' : v);
                    }}>
                      <option value="">選択</option>
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      <option value="__custom">直接入力</option>
                    </select>
                  ) : (
                    <div className="flex gap-1">
                      <input type="text" className={inputSmCls} value={p.role} onChange={e => updateProject(i, 'role', e.target.value)} placeholder="役割を入力" />
                      <button onClick={() => updateProject(i, 'role', '')} className="text-[10px] text-secondary hover:text-primary shrink-0">戻す</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] text-[#999]">規模（人数）</label>
                  <input type="number" className={inputSmCls} placeholder="4" min="1" value={p.scale} onChange={e => updateProject(i, 'scale', e.target.value)} />
                </div>
              </div>

              {/* 業務内容 */}
              <div className="mb-2">
                <label className="block text-[10px] text-[#999]">業務内容</label>
                <textarea className={`${inputSmCls} resize-y font-[inherit]`} style={{ height: 50 }} placeholder="案件名・担当作業を記入" value={p.content} onChange={e => updateProject(i, 'content', e.target.value)} />
              </div>

              {/* 技術スタック */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {TECH_CATEGORIES.map(({ key, label, options }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-[#999]">{label}</label>
                    <MultiSelect options={options} selected={(p[key] as string[]) || []} onChange={v => updateProject(i, key, v)} placeholder="選択" />
                  </div>
                ))}
              </div>

              {/* 担当工程 */}
              <div className="mb-1">
                <label className="block text-[10px] text-[#999] mb-1">担当工程</label>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {PHASE_LIST.map(ph => (
                    <label key={ph} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.phases.includes(ph)}
                        onChange={() => {
                          const next = p.phases.includes(ph) ? p.phases.filter(v => v !== ph) : [...p.phases, ph];
                          updateProject(i, 'phases', next);
                        }}
                        className="rounded"
                      />
                      {ph}
                    </label>
                  ))}
                </div>
              </div>

              <div className="text-right mt-2">
                <button onClick={() => removeProject(i)} className="btn-outline text-[10px] py-0.5 px-2 text-[#A32D2D] border-[#E24B4A]">この経歴を削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========== メインコンポーネント ========== */

function SkillsheetEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get('id') || '';
  const { toast, ToastUI } = useToast();

  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  const [empName, setEmpName] = useState('');
  const [empNameKana, setEmpNameKana] = useState('');
  const [empAge, setEmpAge] = useState('');
  const [empEdu, setEmpEdu] = useState('');

  const [gender, setGender] = useState('');
  const [experience, setExperience] = useState('');
  const [station, setStation] = useState('');
  const [selfPr, setSelfPr] = useState('');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [certs, setCerts] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 経験年数を案件期間から自動計算
  useEffect(() => {
    setExperience(calcExperience(projects));
  }, [projects]);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    try {
      const data = await apiClient<any>(`/skillsheets/${employeeId}`);
      if (!data) return;
      const emp = data.employee;
      setEmpName(emp.name || '');
      setEmpNameKana(emp.nameKana || '');
      setEmpAge(calcAge(emp.birthDate));
      setEmpEdu([emp.education, emp.schoolName].filter(Boolean).join(' / '));
      // 社員マスタから取得（読み取り専用）
      const genderMap: Record<string, string> = { male: '男性', female: '女性', other: 'その他' };
      setGender(genderMap[emp.gender] || emp.gender || '');
      setStation(emp.station || '');
      setCerts(Array.isArray(emp.qualifications) ? emp.qualifications : []);

      if (data.skillsheet) {
        setExperience(data.skillsheet.experience || '');
        // projects migration: support old format
        const rawProjects = Array.isArray(data.skillsheet.projects) ? data.skillsheet.projects : [];
        const arr = (v: any) => Array.isArray(v) ? v : [];
        setProjects(rawProjects.map((p: any) => ({
          periodFrom: p.periodFrom || '',
          periodTo: p.periodTo || '',
          content: p.content || p.detail || '',
          role: p.role || '',
          scale: p.scale || '',
          languages: arr(p.languages),
          db: arr(p.db),
          fw: arr(p.fw),
          ticketMgmt: arr(p.ticketMgmt),
          sqlTool: arr(p.sqlTool),
          editor: arr(p.editor),
          container: arr(p.container),
          buildTool: arr(p.buildTool),
          vcs: arr(p.vcs),
          cicd: arr(p.cicd),
          infra: arr(p.infra),
          cloud: arr(p.cloud),
          communication: arr(p.communication),
          otherTools: arr(p.otherTools),
          phases: arr(p.phases),
        })));
      }
    } catch {
      toast('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient(`/skillsheets/${employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({ experience, selfPr, projects }),
      });
      toast('スキルシートを保存しました');
      setMode('preview');
    } catch (err: any) {
      toast(err?.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleExcelDownload = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('スキルシート');
    const initial = toRomajiInitial(empNameKana) || empName || '--';
    const fmtMonth = (v: string) => { if (!v) return ''; const [y, m] = v.split('-'); return `${y}年${m}月`; };

    // 列幅（8列: A〜H）
    ws.columns = [
      { width: 14 }, { width: 18 }, { width: 14 }, { width: 18 },
      { width: 14 }, { width: 18 }, { width: 14 }, { width: 18 },
    ];

    const thinBorder: any = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
    const thFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F3' } };
    const thFont: any = { bold: true, size: 10, name: 'Meiryo' };
    const tdFont: any = { size: 10, name: 'Meiryo' };
    const navyFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E6B' } };
    const navyFont: any = { size: 10, name: 'Meiryo', color: { argb: 'FFFFFFFF' } };
    const navyLabelFont: any = { size: 10, name: 'Meiryo', color: { argb: 'FFB3C0D9' } };
    const sectionFont: any = { bold: true, size: 11, name: 'Meiryo' };
    const techFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
    const phaseFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F3' } };
    const phaseFont: any = { size: 9, name: 'Meiryo', color: { argb: 'FF666666' } };

    let r = 1;

    // ===== タイトル =====
    ws.mergeCells(r, 1, r, 8);
    const titleCell = ws.getCell(r, 1);
    titleCell.value = 'スキルシート';
    titleCell.font = { bold: true, size: 16, name: 'Meiryo' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 36;
    r += 2;

    // ===== セクション見出しヘルパー =====
    const addSection = (title: string) => {
      ws.mergeCells(r, 1, r, 8);
      const c = ws.getCell(r, 1);
      c.value = title;
      c.font = sectionFont;
      c.border = { bottom: { style: 'medium', color: { argb: 'FF333333' } } };
      r++;
    };

    // ===== 基本情報 =====
    addSection('基本情報');
    const infoRows: [string, string][][] = [
      [['氏名', initial], ['年齢', empAge || '--'], ['性別', gender || '--']],
      [['最終学歴', empEdu || '--'], ['経験年数', experience || '--'], ['最寄駅', station || '--']],
    ];
    for (const row of infoRows) {
      let col = 1;
      for (const [label, val] of row) {
        const th = ws.getCell(r, col);
        th.value = label; th.font = thFont; th.fill = thFill; th.border = thinBorder;
        th.alignment = { vertical: 'middle' };
        const td = ws.getCell(r, col + 1);
        td.value = val; td.font = tdFont; td.border = thinBorder;
        td.alignment = { vertical: 'middle', wrapText: true };
        col += 2;
      }
      // 残り2列も罫線
      if (row.length === 3) {
        ws.getCell(r, 7).border = thinBorder;
        ws.getCell(r, 8).border = thinBorder;
      }
      r++;
    }
    r++;

    // ===== 自己PR =====
    if (selfPr) {
      addSection('自己PR・得意分野');
      ws.mergeCells(r, 1, r, 8);
      const prCell = ws.getCell(r, 1);
      prCell.value = selfPr;
      prCell.font = tdFont;
      prCell.alignment = { wrapText: true, vertical: 'top' };
      const lineCount = selfPr.split('\n').length;
      ws.getRow(r).height = Math.max(20, lineCount * 16);
      r += 2;
    }

    // ===== 保有資格 =====
    addSection('保有資格');
    if (certs.length > 0) {
      for (const c of certs) {
        ws.mergeCells(r, 1, r, 8);
        const cell = ws.getCell(r, 1);
        cell.value = c; cell.font = tdFont;
        r++;
      }
    } else {
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value = '--';
      ws.getCell(r, 1).font = { ...tdFont, color: { argb: 'FF888888' } };
      r++;
    }
    r++;

    // ===== 業務経歴 =====
    addSection('業務経歴');

    for (const p of projects) {
      const fromLabel = fmtMonth(p.periodFrom);
      const toLabel = fmtMonth(p.periodTo);
      const periodStr = fromLabel && toLabel ? `${fromLabel} 〜 ${toLabel}` : fromLabel || '--';

      // --- プロジェクトヘッダー（ネイビー） ---
      ws.mergeCells(r, 1, r, 8);
      const hdrCell = ws.getCell(r, 1);
      hdrCell.value = { richText: [
        { text: '期間： ', font: navyLabelFont },
        { text: periodStr, font: { ...navyFont, bold: true } },
        { text: '    役割： ', font: navyLabelFont },
        { text: p.role || '--', font: navyFont },
        { text: '    規模： ', font: navyLabelFont },
        { text: p.scale ? `${p.scale}名` : '--', font: navyFont },
      ] };
      for (let c = 1; c <= 8; c++) { ws.getCell(r, c).fill = navyFill; }
      ws.getRow(r).height = 24;
      r++;

      // --- 担当工程ヘッダー ---
      for (let i = 0; i < PHASE_LIST.length; i++) {
        const cell = ws.getCell(r, i + 1);
        cell.value = PHASE_LIST[i];
        cell.font = phaseFont;
        cell.fill = phaseFill;
        cell.border = thinBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      r++;

      // --- 担当工程の値 ---
      for (let i = 0; i < PHASE_LIST.length; i++) {
        const cell = ws.getCell(r, i + 1);
        cell.value = p.phases.includes(PHASE_LIST[i]) ? '●' : '−';
        cell.font = { ...tdFont, color: p.phases.includes(PHASE_LIST[i]) ? { argb: 'FF1A1A1A' } : { argb: 'FF999999' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      r++;

      // --- 業務内容 ---
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value = '業務内容';
      ws.getCell(r, 1).font = { size: 9, name: 'Meiryo', color: { argb: 'FF888888' } };
      r++;

      ws.mergeCells(r, 1, r, 8);
      const contentCell = ws.getCell(r, 1);
      contentCell.value = p.content || '--';
      contentCell.font = tdFont;
      contentCell.alignment = { wrapText: true, vertical: 'top' };
      const contentLines = (p.content || '').split('\n').length;
      ws.getRow(r).height = Math.max(20, contentLines * 16);
      r++;

      // --- 技術スタック ---
      const techParts: string[] = [];
      TECH_CATEGORIES.forEach(({ key, label }) => {
        const items = Array.isArray(p[key]) ? (p[key] as string[]) : [];
        if (items.length > 0) techParts.push(`${label}：${items.join(', ')}`);
      });
      if (techParts.length > 0) {
        ws.mergeCells(r, 1, r, 8);
        const techCell = ws.getCell(r, 1);
        techCell.value = techParts.join('   ');
        techCell.font = { size: 9, name: 'Meiryo', color: { argb: 'FF666666' } };
        techCell.fill = techFill;
        techCell.alignment = { wrapText: true, vertical: 'top' };
        const techLineLen = techParts.join('   ').length;
        ws.getRow(r).height = Math.max(20, Math.ceil(techLineLen / 80) * 16);
        r++;
      }
      r++; // プロジェクト間スペース
    }

    // ===== ダウンロード =====
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `スキルシート_${empName || '未設定'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Excelをダウンロードしました');
  };

  if (loading) return <div className="p-8 text-center text-sm text-secondary">読み込み中...</div>;

  return (
    <div>
      <div data-print-hide className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">{empName} のスキルシート</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/admin/skillsheets')} className="btn-outline text-sm py-2">一覧に戻る</button>
          {mode === 'preview' ? (
            <>
              <button onClick={() => setMode('edit')} className="btn-outline text-sm py-2">編集する</button>
              <button onClick={handleExcelDownload} className="btn-outline text-sm py-2">Excelダウンロード</button>
              <button onClick={() => window.print()} className="btn-primary text-sm py-2">PDFダウンロード</button>
            </>
          ) : (
            <button onClick={() => { setMode('preview'); fetchData(); }} className="btn-outline text-sm py-2">キャンセル</button>
          )}
          {mode === 'edit' && (
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
          )}
        </div>
      </div>

      {mode === 'preview' ? (
        <PreviewView
          empName={empName} empNameKana={empNameKana} empAge={empAge} empEdu={empEdu} gender={gender}
          experience={experience} station={station} selfPr={selfPr}
          projects={projects} certs={certs}
        />
      ) : (
        <EditView
          gender={gender}
          experience={experience} station={station}
          selfPr={selfPr} setSelfPr={setSelfPr}
          projects={projects} setProjects={setProjects}
          certs={certs}
          empName={empName} empAge={empAge} empEdu={empEdu}
        />
      )}

      <ToastUI />
    </div>
  );
}

export default function SkillsheetEditPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-secondary">読み込み中...</div>}>
      <SkillsheetEditContent />
    </Suspense>
  );
}
