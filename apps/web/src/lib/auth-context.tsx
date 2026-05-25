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
 * - JWTはHttpOnly cookieで保持し、JSから直接読めないようにする
 * - ログアウト時にcookieを破棄する
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
import { apiClient, setToken, removeToken } from '@/lib/api-client';

interface AuthContextType {
  /** 現在のユーザー情報（未ログイン時はnull） */
  user: AuthUser | null;
  /** ログイン中フラグ（初期ロード中はtrue） */
  isLoading: boolean;
  /** ログイン処理 */
  login: (email: string, password: string, subdomain?: string) => Promise<AuthUser>;
  /** ログアウト処理 */
  logout: () => Promise<void>;
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

  // 初回マウント: HttpOnly cookie があればユーザー情報を復元
  useEffect(() => {
    // cookie の有無はJSから読めないため、まず軽量APIで確認する
    apiClient<AuthUser>('/auth/me')
      .then((authUser) => {
        setUser(authUser);
      })
      .catch((error: { statusCode?: number }) => {
        // 401 のときだけトークン無効として扱う。
        // 一時的な 500 で強制ログアウトすると復旧しづらいため。
        if (error?.statusCode === 401) {
          removeToken();
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  /**
   * ログイン
   *
   * 1. APIにメール+パスワード(+サブドメイン)を送信
   * 2. JWTを受け取ってlocalStorageに保存
   * 3. ユーザー情報をContextに設定
   */
  const login = useCallback(async (email: string, password: string, subdomain?: string) => {
    const response = await apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, subdomain }),
    });

    setToken(response.accessToken);
    setUser(response.user);
    return response.user;
  }, []);

  /**
   * ログアウト
   *
   * トークン削除 + ユーザー情報クリア + ログイン画面にリダイレクト
   */
  const logout = useCallback(async () => {
    const subdomain = user?.subdomain;
    try {
      await apiClient('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // 認証切れでもクライアント側の状態破棄は続行する
    }
    removeToken();
    setUser(null);
    if (subdomain) {
      window.location.href = `/t/${subdomain}/login`;
    } else {
      window.location.href = '/login';
    }
  }, [user]);

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
