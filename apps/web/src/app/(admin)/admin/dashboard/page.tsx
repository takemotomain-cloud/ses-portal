'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiClient } from '@/lib/api-client';

/**
 * 管理画面 ダッシュボード
 *
 * AI エージェント・チャット UI（ミニマル）。
 * - 上部: エージェント切替 + リセット
 * - 中央: スレッド表示（ストリーミング対応）
 * - 下部: 入力欄
 *
 * バックエンドは POST /api/agents/:id/execute/stream (SSE) を使用。
 * Anthropic SDK の tool use と会話履歴に対応。
 */

const AGENT_ID = 'general';
const AGENT_NAME = '業務アシスタント';
const STORAGE_KEY = 'ses_portal_agent_thread_v1';

interface AgentToolCall {
  name: string;
  input: unknown;
  resultPreview: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  agentRole?: string;
  toolCalls?: AgentToolCall[];
  usage?: { input_tokens: number; output_tokens: number };
  model?: string;
}

type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; resultPreview: string }
  | {
      type: 'done';
      agent: { id: string; name: string; role: string };
      usage: { input_tokens: number; output_tokens: number };
      model: string;
      toolCalls: AgentToolCall[];
    }
  | { type: 'error'; message: string };

export default function AdminDashboard() {
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);

  // 初回マウント時に localStorage から復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) {
          setThread(parsed);
        }
      }
    } catch {
      /* ignore corrupt */
    }
    hydratedRef.current = true;
  }, []);

  // thread が変わるたびに保存（ハイドレーション後のみ。初回上書きを防ぐ）
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (typeof window === 'undefined') return;
    try {
      if (thread.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(thread));
      }
    } catch {
      /* quota etc */
    }
  }, [thread]);

  // 新メッセージで一番下へ
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread]);

  // textarea の自動高さ調整
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [prompt]);

  function resetThread() {
    if (running) return;
    setThread([]);
    setErrorMsg(null);
  }

  async function runAgent() {
    if (!prompt.trim() || running) return;
    const userMsg: ChatMessage = { role: 'user', content: prompt };
    const placeholder: ChatMessage = { role: 'assistant', content: '' };
    setRunning(true);
    setErrorMsg(null);
    setThread([...thread, userMsg, placeholder]);
    const sentPrompt = prompt;
    const sentHistory = thread.map((m) => ({ role: m.role, content: m.content }));
    setPrompt('');

    try {
      const response = await fetch(`/api/agents/${AGENT_ID}/execute/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: sentPrompt, history: sentHistory }),
      });
      if (!response.ok || !response.body) {
        if (response.status === 401 && typeof window !== 'undefined') {
          window.location.href = '/login';
          return;
        }
        const j = await response.json().catch(() => null);
        throw new Error(j?.message || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const updateLastAssistant = (mut: (msg: ChatMessage) => ChatMessage) => {
        setThread((cur) => {
          if (cur.length === 0) return cur;
          const last = cur[cur.length - 1];
          if (last.role !== 'assistant') return cur;
          return [...cur.slice(0, -1), mut(last)];
        });
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          let event: StreamEvent | null = null;
          try {
            event = JSON.parse(dataLine.slice(6)) as StreamEvent;
          } catch {
            continue;
          }
          const e = event;
          if (!e) continue;

          if (e.type === 'delta') {
            updateLastAssistant((m) => ({ ...m, content: m.content + e.text }));
          } else if (e.type === 'tool_use') {
            updateLastAssistant((m) => ({
              ...m,
              toolCalls: [
                ...(m.toolCalls ?? []),
                { name: e.name, input: e.input, resultPreview: '...' },
              ],
            }));
          } else if (e.type === 'tool_result') {
            updateLastAssistant((m) => {
              const calls = [...(m.toolCalls ?? [])];
              for (let i = calls.length - 1; i >= 0; i--) {
                if (calls[i].name === e.name && calls[i].resultPreview === '...') {
                  calls[i] = { ...calls[i], resultPreview: e.resultPreview };
                  break;
                }
              }
              return { ...m, toolCalls: calls };
            });
          } else if (e.type === 'done') {
            updateLastAssistant((m) => ({
              ...m,
              agentName: e.agent.name,
              agentRole: e.agent.role,
              usage: e.usage,
              model: e.model,
            }));
          } else if (e.type === 'error') {
            setErrorMsg(e.message);
            setThread((cur) =>
              cur.length > 0 &&
              cur[cur.length - 1].role === 'assistant' &&
              cur[cur.length - 1].content === ''
                ? cur.slice(0, -1)
                : cur,
            );
            setPrompt(sentPrompt);
          }
        }
      }
    } catch (e) {
      const err = e as { message?: string };
      setErrorMsg(err.message || '実行に失敗しました');
      setThread((cur) =>
        cur.length > 0 &&
        cur[cur.length - 1].role === 'assistant' &&
        cur[cur.length - 1].content === ''
          ? cur.slice(0, -1)
          : cur,
      );
      setPrompt(sentPrompt);
    } finally {
      setRunning(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enter で送信、Enter は通常の改行
    if (e.key === 'Enter' && e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      runAgent();
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col">
      {/* ヘッダー: タイトル + リセット */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="text-sm text-secondary">{AGENT_NAME}</div>
        {thread.length > 0 && (
          <button
            onClick={resetThread}
            disabled={running}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-secondary hover:bg-page disabled:opacity-50"
          >
            リセット
          </button>
        )}
      </div>

      {/* スレッド */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        {thread.length === 0 && !running && !errorMsg && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-sm text-secondary">
              <div className="mb-2 text-base text-primary">{AGENT_NAME} に話しかけてみてください</div>
              <div>例: 「未承認の申請を整理して」「2026年4月の勤怠を確定して」「今月の請求書を発行して」</div>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-5">
          {thread.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[82%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-primary px-4 py-3 text-sm leading-7 text-white">
                    {m.content}
                  </div>
                </div>
              );
            }
            const isStreamingEmpty =
              running && i === thread.length - 1 && !m.content && !(m.toolCalls && m.toolCalls.length);
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[88%] text-sm leading-7 text-primary">
                  {isStreamingEmpty ? (
                    <span className="text-secondary">考え中…</span>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {errorMsg && !running && (
            <div className="rounded-[16px] border border-status-red-text/40 bg-status-red-bg px-4 py-3 text-sm text-status-red-text">
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* 入力欄 */}
      <div className="border-t border-border pt-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-[20px] border border-border bg-card px-3 py-2 focus-within:border-primary">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={`${AGENT_NAME} にメッセージを送る…  (Shift+Enter で送信 / Enter で改行)`}
              disabled={running}
              className="min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-6 outline-none disabled:opacity-50"
            />
            <button
              onClick={runAgent}
              disabled={running || !prompt.trim()}
              className="rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {running ? '…' : '送信'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
