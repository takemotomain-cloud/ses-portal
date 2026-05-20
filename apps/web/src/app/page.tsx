import { redirect } from 'next/navigation';

export default function Home() {
  // 共通の企業コード入力画面へリダイレクト
  redirect('/login');
}
