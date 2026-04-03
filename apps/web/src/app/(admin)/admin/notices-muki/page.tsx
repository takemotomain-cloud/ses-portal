/**
 * 管理側 通知書（無期転換）
 *
 * 無期転換対象者一覧 + 発行・送付フロー。
 * 送付済で社員一覧の雇用区分が自動で無期雇用に切替。
 */

'use client';

const mukiTargets: { name: string; code: string; type: string; hire: string; convertDate: string; status: string }[] = [];

const statusBadge: Record<string, { label: string; cls: string }> = {
  none: { label: '未発行', cls: 'badge-wait' },
  draft: { label: '下書き', cls: 'badge-wait' },
  sent: { label: '送付済', cls: 'badge-info' },
};

export default function AdminNoticesMukiPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">通知書（無期転換）</h1>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr className="border-b border-border">
            {['氏名', '社員番号', '雇用形態', '入社日', '転換日', 'ステータス', ''].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {mukiTargets.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : mukiTargets.map(t => {
              const st = statusBadge[t.status];
              return (
                <tr key={t.code} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-base">{t.code}</td>
                  <td className="px-4 py-2.5 text-base">{t.type}</td>
                  <td className="px-4 py-2.5 text-base">{t.hire}</td>
                  <td className="px-4 py-2.5 text-base">{t.convertDate}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5">
                    {t.status === 'draft' && <button className="btn-outline text-xs py-1 px-2.5">送付する</button>}
                    {t.status === 'sent' && <button className="btn-outline text-xs py-1 px-2.5">PDF</button>}
                    {t.status === 'none' && <button className="btn-primary text-xs py-1 px-2.5">発行する</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-status-blue-bg rounded-lg text-sm text-status-blue-text">
        送付済の通知書があると、社員一覧の雇用区分が自動的に「有期」→「無期」に切り替わります。
      </div>
    </div>
  );
}
