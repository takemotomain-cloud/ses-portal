'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface RuleArticle {
  num: string;
  name: string;
  text: string;
}

interface RuleChapter {
  title: string;
  articles: RuleArticle[];
}

interface CurrentRule {
  id: string;
  version: string;
  effectiveDate: string;
  content: RuleChapter[];
  memo?: string | null;
}

interface RuleHistoryItem {
  id: string;
  version: string;
  effectiveDate: string;
  memo: string | null;
  isCurrent: boolean;
  createdAt: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function emptyChapter(): RuleChapter {
  return {
    title: '',
    articles: [{ num: '', name: '', text: '' }],
  };
}

export default function AdminRulesPage() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [currentRule, setCurrentRule] = useState<CurrentRule | null>(null);
  const [history, setHistory] = useState<RuleHistoryItem[]>([]);
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set([0]));
  const [version, setVersion] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [memo, setMemo] = useState('');
  const [draftChapters, setDraftChapters] = useState<RuleChapter[]>([emptyChapter()]);
  const [publishing, setPublishing] = useState(false);
  const { toast, ToastUI } = useToast();

  async function fetchRules() {
    setLoading(true);
    try {
      const [currentRes, historyRes] = await Promise.all([
        apiClient<CurrentRule>('/rules/current').catch(() => null),
        apiClient<RuleHistoryItem[]>('/rules/history').catch(() => []),
      ]);

      setCurrentRule(currentRes);
      setHistory(historyRes);

      if (currentRes) {
        setVersion(currentRes.version);
        setEffectiveDate(currentRes.effectiveDate.slice(0, 10));
        setMemo(currentRes.memo || '');
        setDraftChapters(
          Array.isArray(currentRes.content) && currentRes.content.length > 0
            ? currentRes.content
            : [emptyChapter()],
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRules();
  }, []);

  const stats = useMemo(() => {
    const chapterCount = currentRule?.content?.length || 0;
    const articleCount =
      currentRule?.content?.reduce((sum, chapter) => sum + (chapter.articles?.length || 0), 0) || 0;
    return { chapterCount, articleCount };
  }, [currentRule]);

  function toggleChapter(idx: number) {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function updateChapter(idx: number, patch: Partial<RuleChapter>) {
    setDraftChapters((prev) =>
      prev.map((chapter, index) => (index === idx ? { ...chapter, ...patch } : chapter)),
    );
  }

  function updateArticle(chapterIdx: number, articleIdx: number, patch: Partial<RuleArticle>) {
    setDraftChapters((prev) =>
      prev.map((chapter, index) => {
        if (index !== chapterIdx) return chapter;
        return {
          ...chapter,
          articles: chapter.articles.map((article, idx) =>
            idx === articleIdx ? { ...article, ...patch } : article,
          ),
        };
      }),
    );
  }

  function addChapter() {
    setDraftChapters((prev) => [...prev, emptyChapter()]);
    setOpenChapters((prev) => new Set([...prev, draftChapters.length]));
  }

  function removeChapter(idx: number) {
    setDraftChapters((prev) => (prev.length === 1 ? prev : prev.filter((_, index) => index !== idx)));
  }

  function addArticle(chapterIdx: number) {
    setDraftChapters((prev) =>
      prev.map((chapter, index) =>
        index === chapterIdx
          ? { ...chapter, articles: [...chapter.articles, { num: '', name: '', text: '' }] }
          : chapter,
      ),
    );
  }

  function removeArticle(chapterIdx: number, articleIdx: number) {
    setDraftChapters((prev) =>
      prev.map((chapter, index) => {
        if (index !== chapterIdx || chapter.articles.length === 1) return chapter;
        return {
          ...chapter,
          articles: chapter.articles.filter((_, idx) => idx !== articleIdx),
        };
      }),
    );
  }

  async function handlePublish() {
    const normalized = draftChapters
      .map((chapter) => ({
        title: chapter.title.trim(),
        articles: chapter.articles
          .map((article) => ({
            num: article.num.trim(),
            name: article.name.trim(),
            text: article.text.trim(),
          }))
          .filter((article) => article.num || article.name || article.text),
      }))
      .filter((chapter) => chapter.title || chapter.articles.length > 0);

    if (!version.trim()) {
      toast('バージョンを入力してください');
      return;
    }
    if (!effectiveDate) {
      toast('施行日を入力してください');
      return;
    }
    if (normalized.length === 0) {
      toast('章または条文を1つ以上入力してください');
      return;
    }

    setPublishing(true);
    try {
      await apiClient('/rules/publish', {
        method: 'POST',
        body: JSON.stringify({
          version: version.trim(),
          effectiveDate,
          memo: memo.trim() || undefined,
          content: normalized,
        }),
      });
      toast('就業規則を公開しました');
      await fetchRules();
      setActiveTab(0);
    } catch (err: any) {
      toast(err?.message || '公開に失敗しました');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">就業規則</h1>
        <button onClick={() => window.print()} className="btn-outline text-sm py-2">
          PDFエクスポート
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">現行バージョン</div>
          <div className="text-3xl font-medium">{currentRule?.version || '--'}</div>
          <div className="text-xs text-secondary mt-0.5">
            {currentRule ? fmtDate(currentRule.effectiveDate) : '--'}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">章数</div>
          <div className="text-3xl font-medium">{stats.chapterCount || '--'}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">条文数</div>
          <div className="text-3xl font-medium">{stats.articleCount || '--'}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">社員公開</div>
          <div className="text-3xl font-medium text-primary">
            {currentRule ? '公開中' : '--'}
          </div>
        </div>
      </div>

      <div className="flex border-b border-border/40 mb-5">
        <button
          onClick={() => setActiveTab(0)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors ${
            activeTab === 0 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent'
          }`}
        >
          現行版・公開
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors ${
            activeTab === 1 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent'
          }`}
        >
          改定履歴
        </button>
      </div>

      {activeTab === 0 && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-sm font-medium mb-4">公開設定</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-secondary block mb-1">バージョン</label>
                <input value={version} onChange={(e) => setVersion(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">施行日</label>
                <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">公開メモ</label>
                <input value={memo} onChange={(e) => setMemo(e.target.value)} className="input w-full" />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handlePublish} disabled={publishing} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
                {publishing ? '公開中...' : 'この内容で公開'}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">章・条文の編集</div>
              <button onClick={addChapter} className="btn-outline text-sm py-2 px-4">
                章を追加
              </button>
            </div>

            {loading ? (
              <div className="text-sm text-secondary py-8 text-center">読み込み中...</div>
            ) : (
              <div className="space-y-4">
                {draftChapters.map((chapter, chapterIdx) => {
                  const isOpen = openChapters.has(chapterIdx);
                  return (
                    <div key={chapterIdx} className="border border-border/40 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleChapter(chapterIdx)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-page text-left"
                      >
                        <span className="font-medium">
                          {chapter.title || `章 ${chapterIdx + 1}`}
                        </span>
                        <span className={`transition-transform ${isOpen ? 'rotate-45' : ''}`}>＋</span>
                      </button>

                      {isOpen && (
                        <div className="p-4 space-y-4">
                          <div className="flex gap-3 items-end flex-wrap">
                            <div className="flex-1 min-w-[260px]">
                              <label className="text-xs text-secondary block mb-1">章タイトル</label>
                              <input
                                value={chapter.title}
                                onChange={(e) => updateChapter(chapterIdx, { title: e.target.value })}
                                className="input w-full"
                              />
                            </div>
                            <button
                              onClick={() => removeChapter(chapterIdx)}
                              className="btn-outline text-sm py-2 px-4 text-red-600 border-red-300 hover:bg-red-50"
                            >
                              章を削除
                            </button>
                          </div>

                          <div className="space-y-3">
                            {chapter.articles.map((article, articleIdx) => (
                              <div key={articleIdx} className="rounded-lg border border-border/30 p-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-secondary block mb-1">条番号</label>
                                    <input
                                      value={article.num}
                                      onChange={(e) => updateArticle(chapterIdx, articleIdx, { num: e.target.value })}
                                      className="input w-full"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-secondary block mb-1">条文名</label>
                                    <input
                                      value={article.name}
                                      onChange={(e) => updateArticle(chapterIdx, articleIdx, { name: e.target.value })}
                                      className="input w-full"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-secondary block mb-1">本文</label>
                                  <textarea
                                    value={article.text}
                                    onChange={(e) => updateArticle(chapterIdx, articleIdx, { text: e.target.value })}
                                    className="w-full min-h-[120px] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => removeArticle(chapterIdx, articleIdx)}
                                    className="text-sm text-red-600 hover:underline"
                                  >
                                    条文を削除
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <button onClick={() => addArticle(chapterIdx)} className="btn-outline text-sm py-2 px-4">
                            条文を追加
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="card p-0">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
          ) : history.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
          ) : (
            history.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-5 py-3.5 ${
                  idx < history.length - 1 ? 'border-b border-border/20' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="text-base">
                    <span className="font-medium">{item.version}</span>
                    <span className="text-secondary ml-2">{item.memo || '公開履歴'}</span>
                  </div>
                  <div className="text-sm text-secondary mt-0.5">
                    施行日 {fmtDate(item.effectiveDate)} · 登録 {fmtDate(item.createdAt)}
                  </div>
                </div>
                <span className={`badge ${item.isCurrent ? 'badge-ok' : 'badge-wait'}`}>
                  {item.isCurrent ? '現行版' : '履歴'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
      <ToastUI />
    </div>
  );
}
