/**
 * 管理側 今月のアラート
 *
 * UIモックのpage-alert-monthを再現。
 * 打刻漏れTOP10 + 稼働時間ワーストTOP10 + 欠勤TOP10。
 */

export default function AlertsMonthPage() {
  const missedTop: { name: string; count: number }[] = [];

  const workHoursWorst: { name: string; actual: number; target: number; diff: number }[] = [];

  const absenceTop: { name: string; days: number; reason: string }[] = [];

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">今月のアラート</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 打刻漏れTOP */}
        <div>
          <h2 className="text-md font-medium mb-3">打刻漏れTOP</h2>
          <div className="card p-0">
            {missedTop.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
            )}
            {missedTop.map((item, idx) => (
              <div key={idx} className={`flex items-center justify-between px-4 py-3 ${idx < missedTop.length - 1 ? 'border-b border-border/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-status-red-bg text-status-red-text text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                  <span className="text-base font-medium">{item.name}</span>
                </div>
                <span className="text-base text-status-red-text font-medium">{item.count}件</span>
              </div>
            ))}
          </div>
        </div>

        {/* 稼働時間ワースト */}
        <div>
          <h2 className="text-md font-medium mb-3">稼働時間ワーストTOP</h2>
          <div className="card p-0">
            {workHoursWorst.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
            )}
            {workHoursWorst.map((item, idx) => (
              <div key={idx} className={`flex items-center justify-between px-4 py-3 ${idx < workHoursWorst.length - 1 ? 'border-b border-border/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-status-amber-bg text-status-amber-text text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                  <span className="text-base font-medium">{item.name}</span>
                </div>
                <span className={`text-base font-medium ${item.diff < 0 ? 'text-status-red-text' : 'text-secondary'}`}>{item.actual}h</span>
              </div>
            ))}
          </div>
        </div>

        {/* 欠勤TOP */}
        <div>
          <h2 className="text-md font-medium mb-3">欠勤TOP</h2>
          <div className="card p-0">
            {absenceTop.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
            )}
            {absenceTop.map((item, idx) => (
              <div key={idx} className={`flex items-center justify-between px-4 py-3 ${idx < absenceTop.length - 1 ? 'border-b border-border/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-status-amber-bg text-status-amber-text text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                  <div>
                    <span className="text-base font-medium">{item.name}</span>
                    <span className="text-sm text-secondary ml-2">{item.reason}</span>
                  </div>
                </div>
                <span className="text-base font-medium">{item.days}日</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
