'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface Article {
  num: string;
  name: string;
  text: string;
}

interface Chapter {
  title: string;
  articles: Article[];
}

interface CurrentRule {
  id: string;
  version: string;
  effectiveDate: string;
  content: Chapter[];
  memo?: string | null;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日改定`;
}

export default function RulesPage() {
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set());
  const [rule, setRule] = useState<CurrentRule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<CurrentRule>('/rules/current')
      .then((res) => setRule(res))
      .catch(() => setRule(null))
      .finally(() => setLoading(false));
  }, []);

  function toggleChapter(idx: number) {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-md font-bold text-primary">就業規則</h2>
        <span className="text-sm text-secondary">
          {rule ? fmtDate(rule.effectiveDate) : '未登録'}
        </span>
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
        ) : !rule || !Array.isArray(rule.content) || rule.content.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-secondary">
            就業規則はまだ登録されていません
          </div>
        ) : (
          rule.content.map((chapter, ci) => {
            const isOpen = openChapters.has(ci);
            return (
              <div key={ci} className={ci < rule.content.length - 1 ? 'border-b border-border-light' : ''}>
                <button
                  onClick={() => toggleChapter(ci)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-page transition-colors text-left"
                >
                  <span className="text-md font-semibold">{chapter.title}</span>
                  <span
                    className={`text-xl text-secondary font-light transition-transform duration-200 ${
                      isOpen ? 'rotate-45' : ''
                    }`}
                  >
                    ＋
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4">
                    {chapter.articles.map((art, ai) => (
                      <div key={ai} className={`py-2.5 ${ai > 0 ? 'border-t border-border-light' : ''}`}>
                        <div className="text-sm font-semibold text-secondary mb-1">
                          {art.num}（{art.name}）
                        </div>
                        <div className="text-base text-primary leading-relaxed whitespace-pre-wrap">
                          {art.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
