/**
 * ナビゲーションガード
 *
 * 編集中のページから離れる際に未保存の確認ダイアログを表示する。
 * - setGuard(true) で有効化、setGuard(false) で無効化
 * - サイドバーの Link や router.push で遷移する前にチェック
 */

'use client';

import { createContext, useContext, useCallback, useRef } from 'react';

interface NavigationGuardContextType {
  /** ガードを有効/無効にする */
  setGuard: (active: boolean) => void;
  /** ガードが有効かチェックし、有効なら確認ダイアログを出す。trueなら遷移OK */
  confirmNavigation: () => boolean;
}

const NavigationGuardContext = createContext<NavigationGuardContextType>({
  setGuard: () => {},
  confirmNavigation: () => true,
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef(false);

  const setGuard = useCallback((active: boolean) => {
    guardRef.current = active;
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!guardRef.current) return true;
    return window.confirm('変更が保存されていません。このまま移動しますか？');
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ setGuard, confirmNavigation }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
