/**
 * 自動通知ルール管理ページ
 *
 * 管理者がスケジュール・イベントベースの自動通知ルールを
 * 一覧・作成・編集・有効/無効切替・削除できる。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */

interface AutoNotificationRule {
  id: string;
  name: string;
  triggerType: 'cron' | 'event';
  triggerConfig: Record<string, any> | null;
  targetType: string;
  titleTemplate: string;
  bodyTemplate: string;
  isEnabled: boolean;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- 定数 ---------- */

const cronPresets = [
  { label: '毎日 9:00', value: '0 9 * * *' },
  { label: '毎日 18:00', value: '0 18 * * *' },
  { label: '毎週月曜 9:00', value: '0 9 * * 1' },
  { label: '毎月1日 9:00', value: '0 9 1 * *' },
  { label: '毎月25日 9:00', value: '0 9 25 * *' },
  { label: 'カスタム', value: 'custom' },
];

const eventOptions = [
  { label: '有給承認時', value: 'leave_approved' },
  { label: '給与確定時', value: 'payroll_confirmed' },
  { label: '契約終了間近', value: 'contract_ending_soon' },
];

const targetTypeLabels: Record<string, string> = {
  all: '全社員',
  department: '部署指定',
  area: 'エリア指定',
  individual: '個別指定',
  affected: '対象者',
};

const triggerTypeLabels: Record<string, string> = {
  cron: 'スケジュール',
  event: 'イベント',
};

function cronToLabel(expr: string): string {
  const preset = cronPresets.find(p => p.value === expr);
  return preset ? preset.label : expr;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '未実行';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---------- 初期フォーム ---------- */

const initialForm = {
  name: '',
  triggerType: 'cron' as 'cron' | 'event',
  cronPreset: '0 9 * * *',
  customCron: '',
  eventName: 'leave_approved',
  targetType: 'all',
  titleTemplate: '',
  bodyTemplate: '',
  isEnabled: true,
};

/* ---------- コンポーネント ---------- */

export default function AutoNotificationsPage() {
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [rules, setRules] = useState<AutoNotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { toast, ToastUI } = useToast();

  const fetchRules = useCallback(async () => {
    try {
      const data = await apiClient<AutoNotificationRule[]>('/auto-notifications');
      setRules(data || []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  /* ---------- 有効/無効切替 ---------- */

  async function handleToggle(rule: AutoNotificationRule) {
    try {
      await apiClient(`/auto-notifications/${rule.id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });
      toast(rule.isEnabled ? 'ルールを無効にしました' : 'ルールを有効にしました');
      fetchRules();
    } catch {
      toast('切替に失敗しました');
    }
  }

  /* ---------- 削除 ---------- */

  async function handleDelete(id: string) {
    try {
      await apiClient(`/auto-notifications/${id}`, { method: 'DELETE' });
      toast('ルールを削除しました');
      setDeleteConfirmId(null);
      fetchRules();
    } catch {
      toast('削除に失敗しました');
    }
  }

  /* ---------- 編集開始 ---------- */

  function startEdit(rule: AutoNotificationRule) {
    const config = rule.triggerConfig || {};
    const cronExpr = config.cronExpression || '';
    const isPreset = cronPresets.some(p => p.value === cronExpr);

    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      cronPreset: isPreset ? cronExpr : 'custom',
      customCron: isPreset ? '' : cronExpr,
      eventName: config.eventName || 'leave_approved',
      targetType: rule.targetType,
      titleTemplate: rule.titleTemplate,
      bodyTemplate: rule.bodyTemplate,
      isEnabled: rule.isEnabled,
    });
    setEditingId(rule.id);
    setTab('create');
  }

  /* ---------- 保存 ---------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.titleTemplate.trim() || !form.bodyTemplate.trim()) {
      toast('必須項目を入力してください');
      return;
    }

    const cronExpression = form.cronPreset === 'custom' ? form.customCron : form.cronPreset;

    const triggerConfig: Record<string, any> = form.triggerType === 'cron'
      ? { cronExpression }
      : { eventName: form.eventName };

    const payload = {
      name: form.name.trim(),
      triggerType: form.triggerType,
      triggerConfig,
      targetType: form.targetType,
      titleTemplate: form.titleTemplate.trim(),
      bodyTemplate: form.bodyTemplate.trim(),
      isEnabled: form.isEnabled,
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiClient(`/auto-notifications/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast('ルールを更新しました');
      } else {
        await apiClient('/auto-notifications', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('ルールを作成しました');
      }
      setForm(initialForm);
      setEditingId(null);
      setTab('list');
      fetchRules();
    } catch {
      toast('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  /* ---------- レンダリング ---------- */

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">自動通知ルール</h1>

      {/* タブ */}
      <div className="flex gap-1 bg-page rounded-lg p-1">
        {[
          { key: 'list' as const, label: 'ルール一覧' },
          { key: 'create' as const, label: editingId ? 'ルール編集' : '新規作成' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === 'create' && tab !== 'create') {
                setForm(initialForm);
                setEditingId(null);
              }
              setTab(t.key);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? 'bg-white text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ルール一覧 */}
      {tab === 'list' && (
        <div>
          {loading ? (
            <div className="card p-10 text-center text-secondary">読み込み中...</div>
          ) : rules.length === 0 ? (
            <div className="card p-10 text-center text-secondary">
              ルールがありません。「新規作成」タブから追加してください。
            </div>
          ) : (
            <div className="card p-0">
              {rules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className={`px-4 py-3.5 ${idx < rules.length - 1 ? 'border-b border-border-light' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-md">{rule.name}</span>
                        <span className={`badge ${rule.triggerType === 'cron' ? 'badge-info' : 'badge-accent'}`}>
                          {triggerTypeLabels[rule.triggerType]}
                        </span>
                        <span className="badge badge-muted">
                          {targetTypeLabels[rule.targetType] || rule.targetType}
                        </span>
                      </div>
                      <div className="text-sm text-secondary">
                        {rule.triggerType === 'cron'
                          ? `スケジュール: ${cronToLabel(rule.triggerConfig?.cronExpression || '')}`
                          : `イベント: ${rule.triggerConfig?.eventName || ''}`}
                      </div>
                      <div className="text-sm text-secondary mt-0.5">
                        最終実行: {formatDateTime(rule.lastExecutedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* 有効/無効トグル */}
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          rule.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={rule.isEnabled ? '有効 — クリックで無効化' : '無効 — クリックで有効化'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rule.isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>

                      {/* 編集 */}
                      <button
                        onClick={() => startEdit(rule)}
                        className="text-sm text-accent hover:underline"
                      >
                        編集
                      </button>

                      {/* 削除 */}
                      <button
                        onClick={() => setDeleteConfirmId(rule.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 新規作成 / 編集フォーム */}
      {tab === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ルール名 */}
          <div className="card p-4 space-y-3">
            <h3 className="text-md font-bold text-primary">基本情報</h3>
            <div>
              <label className="block text-sm text-secondary mb-1">ルール名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={100}
                className="input w-full"
                placeholder="例: 勤怠未入力リマインド"
              />
            </div>
          </div>

          {/* トリガー設定 */}
          <div className="card p-4 space-y-3">
            <h3 className="text-md font-bold text-primary">トリガー設定</h3>

            <div>
              <label className="block text-sm text-secondary mb-1">トリガータイプ</label>
              <div className="flex gap-2">
                {(['cron', 'event'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, triggerType: t }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.triggerType === t
                        ? 'bg-accent text-white'
                        : 'bg-page text-secondary hover:text-primary'
                    }`}
                  >
                    {triggerTypeLabels[t]}
                  </button>
                ))}
              </div>
            </div>

            {form.triggerType === 'cron' && (
              <div>
                <label className="block text-sm text-secondary mb-1">スケジュール</label>
                <select
                  value={form.cronPreset}
                  onChange={e => setForm(f => ({ ...f, cronPreset: e.target.value }))}
                  className="input w-full"
                >
                  {cronPresets.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {form.cronPreset === 'custom' && (
                  <input
                    type="text"
                    value={form.customCron}
                    onChange={e => setForm(f => ({ ...f, customCron: e.target.value }))}
                    className="input w-full mt-2"
                    placeholder="cron式: 分 時 日 月 曜日（例: 0 9 * * 1-5）"
                  />
                )}
              </div>
            )}

            {form.triggerType === 'event' && (
              <div>
                <label className="block text-sm text-secondary mb-1">イベント</label>
                <select
                  value={form.eventName}
                  onChange={e => setForm(f => ({ ...f, eventName: e.target.value }))}
                  className="input w-full"
                >
                  {eventOptions.map(ev => (
                    <option key={ev.value} value={ev.value}>{ev.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 送信先 */}
          <div className="card p-4 space-y-3">
            <h3 className="text-md font-bold text-primary">送信先</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(targetTypeLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, targetType: key }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.targetType === key
                      ? 'bg-accent text-white'
                      : 'bg-page text-secondary hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* テンプレート */}
          <div className="card p-4 space-y-3">
            <h3 className="text-md font-bold text-primary">通知テンプレート</h3>
            <p className="text-xs text-secondary">
              {'使用可能な変数: {{employeeName}} {{date}} {{monthEnd}}'}
            </p>

            <div>
              <label className="block text-sm text-secondary mb-1">タイトル <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.titleTemplate}
                onChange={e => setForm(f => ({ ...f, titleTemplate: e.target.value }))}
                maxLength={200}
                className="input w-full"
                placeholder="例: 勤怠入力のお願い"
              />
            </div>

            <div>
              <label className="block text-sm text-secondary mb-1">本文 <span className="text-red-500">*</span></label>
              <textarea
                value={form.bodyTemplate}
                onChange={e => setForm(f => ({ ...f, bodyTemplate: e.target.value }))}
                rows={4}
                className="input w-full"
                placeholder={'例: {{employeeName}}さん、{{date}}現在、当月の勤怠が未入力です。'}
              />
            </div>
          </div>

          {/* 有効/無効 */}
          <div className="card p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isEnabled: !f.isEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium">{form.isEnabled ? '有効' : '無効'}</span>
            </label>
          </div>

          {/* ボタン */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? '保存中...' : editingId ? '更新する' : '作成する'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setForm(initialForm);
                  setEditingId(null);
                  setTab('list');
                }}
                className="btn-outline"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      )}

      {/* 削除確認ダイアログ */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-md font-bold mb-2">ルールを削除しますか？</h3>
            <p className="text-sm text-secondary mb-4">この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg font-medium text-sm hover:bg-red-600"
              >
                削除する
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 btn-outline"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
