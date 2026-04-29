/**
 * シンプルなトーストフック
 *
 * 使い方:
 *   const { toast, ToastUI } = useToast();
 *   toast('保存しました');
 *   return <><ToastUI />{...}</>
 */

'use client';

import { useState, useCallback } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const toast = useCallback((msg: string, duration = 2500) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), duration);
  }, []);

  function ToastUI() {
    if (!message) return null;
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="bg-primary text-white text-sm px-5 py-2.5 rounded-full shadow-lg whitespace-nowrap">
          {message}
        </div>
      </div>
    );
  }

  return { toast, ToastUI };
}
