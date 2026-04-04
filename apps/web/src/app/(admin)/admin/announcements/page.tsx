/**
 * 管理側 お知らせ送信ページ
 *
 * 管理者が社員向けにお知らせを一括送信する。
 * 送信先: 全社員 / 部署 / エリア / 個別選択
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */
interface EmployeeOption {
  id: string;
  employeeCode: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

interface AreaOption {
  value: string;
  label: string;
}

interface SentNotification {
  title: string;
  body: string;
  createdAt: string;
  sentCount: number;
  readCount: number;
}

type TargetType = 'all' | 'department' | 'area' | 'individual';

/* ---------- ヘルパー ---------- */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---------- コンポーネント ---------- */
export default function AnnouncementsPage() {
  const { toast, ToastUI } = useToast();
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  /* 送信フォーム */
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [sending, setSending] = useState(false);

  /* 選択肢データ */
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);

  /* 送信履歴 */
  const [sentList, setSentList] = useState<SentNotification[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);

  /* データ取得 */
  useEffect(() => {
    apiClient<{
      employees: EmployeeOption[];
      departments: DepartmentOption[];
      areas: AreaOption[];
    }>('/notifications/targets')
      .then(data => {
        setEmployees(data.employees);
        setDepartments(data.departments);
        setAreas(data.areas);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 1) {
      setLoadingSent(true);
      apiClient<SentNotification[]>('/notifications/sent')
        .then(setSentList)
        .catch(() => setSentList([]))
        .finally(() => setLoadingSent(false));
    }
  }, [activeTab]);

  /* 社員検索 */
  const filteredEmployees = useMemo(() => {
    if (!empSearch) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.departmentName.toLowerCase().includes(q),
    );
  }, [employees, empSearch]);

  /* 送信先プレビュー */
  const targetPreview = useMemo(() => {
    switch (targetType) {
      case 'all':
        return `全社員（${employees.length}名）`;
      case 'department': {
        const names = selectedDepts.map(id => departments.find(d => d.id === id)?.name).filter(Boolean);
        const count = employees.filter(e => selectedDepts.includes(e.departmentId)).length;
        return names.length ? `${names.join('、')}（${count}名）` : '部署を選択してください';
      }
      case 'area':
        return selectedArea
          ? `${areas.find(a => a.value === selectedArea)?.label || selectedArea}`
          : 'エリアを選択してください';
      case 'individual':
        return selectedEmployees.length
          ? `${selectedEmployees.length}名を選択中`
          : '社員を選択してください';
    }
  }, [targetType, employees, departments, areas, selectedDepts, selectedArea, selectedEmployees]);

  /* 送信 */
  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      toast('タイトルと本文を入力してください');
      return;
    }

    const payload: any = {
      title: title.trim(),
      body: body.trim(),
      targetType,
    };

    if (targetType === 'department') {
      if (!selectedDepts.length) { toast('部署を選択してください'); return; }
      payload.targetIds = selectedDepts;
    } else if (targetType === 'area') {
      if (!selectedArea) { toast('エリアを選択してください'); return; }
      payload.targetArea = selectedArea;
    } else if (targetType === 'individual') {
      if (!selectedEmployees.length) { toast('社員を選択してください'); return; }
      payload.targetIds = selectedEmployees;
    }

    setSending(true);
    try {
      const result = await apiClient<{ sentCount: number }>('/notifications/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast(`${result.sentCount}名にお知らせを送信しました`);
      setTitle('');
      setBody('');
      setSelectedDepts([]);
      setSelectedArea('');
      setSelectedEmployees([]);
    } catch (e: any) {
      toast(e.message || '送信に失敗しました');
    } finally {
      setSending(false);
    }
  }

  /* 部署トグル */
  function toggleDept(id: string) {
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id],
    );
  }

  /* 社員トグル */
  function toggleEmployee(id: string) {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id],
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">お知らせ配信</h1>

      {/* タブ */}
      <div className="flex border-b border-border/40 mb-5">
        <button
          onClick={() => setActiveTab(0)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 0 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          新規送信
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 1 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          送信履歴
        </button>
      </div>

      {/* 新規送信タブ */}
      {activeTab === 0 && (
        <div className="max-w-2xl space-y-5">
          {/* タイトル */}
          <div className="card p-5">
            <label className="block text-sm font-medium mb-2">
              タイトル <span className="text-status-red-text">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="お知らせのタイトルを入力"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary"
            />
          </div>

          {/* 本文 */}
          <div className="card p-5">
            <label className="block text-sm font-medium mb-2">
              本文 <span className="text-status-red-text">*</span>
            </label>
            <textarea
              rows={6}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="お知らせの内容を入力"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary resize-y"
            />
          </div>

          {/* 送信先 */}
          <div className="card p-5">
            <label className="block text-sm font-medium mb-3">送信先</label>

            {/* タイプ選択 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { value: 'all', label: '全社員' },
                { value: 'department', label: '部署' },
                { value: 'area', label: 'エリア' },
                { value: 'individual', label: '個別選択' },
              ] as { value: TargetType; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTargetType(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors
                    ${targetType === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-secondary border-border hover:border-primary hover:text-primary'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 部署選択 */}
            {targetType === 'department' && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                {departments.map(d => (
                  <label key={d.id} className="flex items-center gap-2 cursor-pointer hover:bg-page rounded px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedDepts.includes(d.id)}
                      onChange={() => toggleDept(d.id)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">{d.parentId ? '　' : ''}{d.name}</span>
                  </label>
                ))}
              </div>
            )}

            {/* エリア選択 */}
            {targetType === 'area' && (
              <div>
                {areas.length === 0 ? (
                  <div className="text-sm text-secondary py-2">配属データがないため、エリアが取得できません</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {areas.map(a => (
                      <button
                        key={a.value}
                        onClick={() => setSelectedArea(a.value === selectedArea ? '' : a.value)}
                        className={`px-4 py-2 rounded-lg text-sm border transition-colors
                          ${selectedArea === a.value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-secondary border-border hover:border-primary hover:text-primary'
                          }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 個別選択 */}
            {targetType === 'individual' && (
              <div>
                <input
                  type="text"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="氏名・社員番号・部署で検索"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary mb-2"
                />
                {selectedEmployees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedEmployees.map(id => {
                      const emp = employees.find(e => e.id === id);
                      return emp ? (
                        <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-md">
                          {emp.name}
                          <button onClick={() => toggleEmployee(id)} className="hover:text-primary/70">✕</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                  {filteredEmployees.map(e => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-page px-3 py-2 border-b border-border/20 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(e.id)}
                        onChange={() => toggleEmployee(e.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm font-medium">{e.name}</span>
                      <span className="text-xs text-secondary">{e.employeeCode}</span>
                      <span className="text-xs text-secondary ml-auto">{e.departmentName}</span>
                    </label>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <div className="px-3 py-4 text-sm text-secondary text-center">該当する社員がいません</div>
                  )}
                </div>
              </div>
            )}

            {/* プレビュー */}
            <div className="mt-3 text-sm text-secondary">
              送信先: {targetPreview}
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !body.trim()}
              className="px-6 py-2.5 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
            >
              {sending ? '送信中...' : 'お知らせを送信'}
            </button>
          </div>
        </div>
      )}

      {/* 送信履歴タブ */}
      {activeTab === 1 && (
        <div className="card p-0">
          {loadingSent ? (
            <div className="px-5 py-8 text-center text-sm text-secondary">読み込み中...</div>
          ) : sentList.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-secondary">送信履歴はありません</div>
          ) : (
            sentList.map((item, idx) => (
              <div
                key={idx}
                className={`px-5 py-4 ${idx < sentList.length - 1 ? 'border-b border-border/20' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="text-base font-medium">{item.title}</h3>
                  <span className="text-xs text-secondary flex-shrink-0">{fmtDate(item.createdAt)}</span>
                </div>
                <p className="text-sm text-secondary mb-2 line-clamp-2">{item.body}</p>
                <div className="flex gap-3 text-xs text-secondary">
                  <span>送信: {item.sentCount}名</span>
                  <span>既読: {item.readCount}名</span>
                  <span className="text-primary">
                    既読率: {item.sentCount > 0 ? Math.round((item.readCount / item.sentCount) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ToastUI />
    </div>
  );
}
