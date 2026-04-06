/**
 * 管理側 freee連携
 *
 * 接続状態 + 未送信仕訳 + 送信履歴 + エラーログ。
 * freeeに送るのは仕訳だけ。請求書はSES特有明細のため自社生成。
 */

export default function AdminFreeePage() {
  const handleTokenRefresh = () => alert('トークン更新機能は今後実装予定です');
  const handleSync = () => alert('手動同期機能は今後実装予定です');
  const handleSettings = () => alert('接続設定機能は今後実装予定です');

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">freee連携</h1>
        <div className="flex gap-2">
          <button onClick={handleTokenRefresh} className="btn-outline text-sm py-2">トークン更新</button>
          <button onClick={handleSync} className="btn-primary text-sm py-2">手動同期</button>
        </div>
      </div>

      {/* 接続状態 */}
      <div className="card p-5 flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="text-lg font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-green-text" />
            freee会計と接続中
          </div>
          <div className="text-sm text-secondary">事業所: 株式会社サンプルSES　最終同期: 2026年3月31日 9時15分</div>
        </div>
        <button onClick={handleSettings} className="btn-outline text-sm py-2">接続設定</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4"><div className="text-xs text-secondary">今月の送信仕訳</div><div className="text-3xl font-medium">24<span className="text-base font-normal text-secondary ml-1">件</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">成功</div><div className="text-3xl font-medium text-status-green-text">23<span className="text-base font-normal ml-1">件</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">エラー</div><div className="text-3xl font-medium text-status-red-text">1<span className="text-base font-normal ml-1">件</span></div></div>
      </div>

      {/* 未送信の仕訳 */}
      <div className="mb-4">
        <h2 className="text-md font-medium mb-3">未送信の仕訳</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[550px]">
            <thead><tr className="border-b border-border">
              {['日付', '摘要', '借方', '貸方', '金額', ''].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              <tr className="border-b border-border/20"><td className="px-4 py-2.5 text-base">2026年3月31日</td><td className="px-4 py-2.5 text-base">3月分 給与</td><td className="px-4 py-2.5 text-base">給料手当</td><td className="px-4 py-2.5 text-base">未払金</td><td className="px-4 py-2.5 text-base text-right tabular-nums">34,280,000円</td><td className="px-4 py-2.5"><span className="badge badge-warn">未送信</span></td></tr>
              <tr><td className="px-4 py-2.5 text-base">2026年3月31日</td><td className="px-4 py-2.5 text-base">3月分 社会保険料</td><td className="px-4 py-2.5 text-base">法定福利費</td><td className="px-4 py-2.5 text-base">未払金</td><td className="px-4 py-2.5 text-base text-right tabular-nums">4,820,000円</td><td className="px-4 py-2.5"><span className="badge badge-warn">未送信</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 送信履歴 */}
      <div>
        <h2 className="text-md font-medium mb-3">送信履歴</h2>
        <div className="card p-0">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border/20">
            <span className="text-sm text-secondary min-w-[160px]">2026年3月31日 9時15分</span>
            <span className="text-base flex-1">2月分 売上仕訳 12件を送信</span>
            <span className="badge badge-ok">成功</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-3">
            <span className="text-sm text-secondary min-w-[160px]">2026年3月28日 10時02分</span>
            <span className="text-base flex-1 text-secondary">勘定科目「通信費」がfreee側に存在しません</span>
            <span className="badge badge-danger">エラー</span>
          </div>
        </div>
      </div>
    </div>
  );
}
