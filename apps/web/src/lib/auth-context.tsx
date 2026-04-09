/**
 * 認証コンテキスト
 *
 * ログイン状態・ユーザー情報をReactコンテキストで管理。
 * 全コンポーネントから useAuth() でアクセス可能。
 *
 * なぜContextAPI: 認証状態はアプリ全体で参照するため、
 * propsバケツリレーを避ける。外部ライブラリ（zustand等）は
 * 必要になるまで導入しない（依存最小限の原則）。
 *
 * セキュリティ:
 * - JWTはlocalStorageに保存（HttpOnly cookieは次フェーズで検討）
 * - ログアウト時にトークンを確実に削除
 * - 画面遷移時にトークン有効性をチェック
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginResponse } from '@ses-portal/shared';
import { apiClient, setToken, removeToken, getToken } from '@/lib/api-client';

interface AuthContextType {
  /** 現在のユーザー情報（未ログイン時はnull） */
  user: AuthUser | null;
  /** ログイン中フラグ（初期ロード中はtrue） */
  isLoading: boolean;
  /** ログイン処理 */
  login: (email: string, password: string) => Promise<void>;
  /** ログアウト処理 */
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 認証プロバイダー
 *
 * ルートレイアウトの直下に配置して全画面に認証状態を提供する。
 * 初回マウント時にlocalStorageのトークンを検証し、
 * 有効ならユーザー情報を復元する。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初回マウント: トークンがあればユーザー情報を復元
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    // トークンが有効かAPIで確認（GET /employees/me）
    apiClient<any>('/employees/me')
      .then((employee) => {
        setUser({
          id: '',
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          name: `${employee.lastName} ${employee.firstName}`,
          email: employee.email,
          role: '' as any,
          employeeStatus: employee.status,
          resignDate: employee.resignDate
            ? String(employee.resignDate).slice(0, 10)
            : null,
          department: employee.department?.name || '',
          hasBonus: employee.hasBonus ?? false,
        } as any);
      })
      .catch(() => {
        // トークン無効 → クリア
        removeToken();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  /**
   * ログイン
   *
   * 1. APIにメール+パスワードを送信
   * 2. JWTを受け取ってlocalStorageに保存
   * 3. ユーザー情報をContextに設定
   */
  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setToken(response.accessToken);
    setUser(response.user);
  }, []);

  /**
   * ログアウト
   *
   * トークン削除 + ユーザー情報クリア + ログイン画面にリダイレクト
   */
  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 認証フック
 *
 * コンポーネントから認証状態にアクセスする。
 * AuthProviderの外で使うとエラーを投げる（バグ検知）。
 *
 * 使い方:
 *   const { user, login, logout } = useAuth();
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
