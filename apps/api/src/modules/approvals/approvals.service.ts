import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface DoneItem {
  id: string;
  type: 'leave' | 'expense' | 'change' | 'attendance' | 'delay' | 'loa' | 'yearend';
  name: string;
  detail: string;
  approved: boolean;
  processedDate: string;
}

function fmtDate(date: Date | string | null | undefined) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtTime(date: Date | string | null | undefined) {
  if (!date) return '--:--';
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtMonth(yearMonth: string) {
  const [y, m] = yearMonth.split('-');
  return `${y}年${Number(m)}月分`;
}

function fmtAmount(n: number | null | undefined) {
  return (n ?? 0).toLocaleString();
}

const leaveTypeLabel: Record<string, string> = {
  full_day: '全休',
  am_half: '午前半休',
  pm_half: '午後半休',
  special: '特別休暇',
};

const absenceTypeLabel: Record<string, string> = {
  injury: '傷病休職',
  childcare: '育児休業',
  nursing: '介護休業',
  other: 'その他',
};

const changeTypeLabel: Record<string, string> = {
  address: '住所変更',
  bank: '口座変更',
  dependent: '扶養変更',
  emergency: '緊急連絡先変更',
  name: '氏名変更',
};

@Injectable()
export class ApprovalsService {
  constructor(private readonly db: DatabaseService) {}

  async getSidebarSummary(employeeId: string, tenantId: string) {
    const [
      leaveCount,
      expenseCount,
      changeRequestCount,
      delayCertificateCount,
      unreadCount,
    ] = await Promise.all([
      this.db.leaveRequest.count({ where: { tenantId, status: 'pending' } }),
      this.db.expenseRequest.count({ where: { tenantId, status: 'pending' } }),
      this.db.changeRequest.count({ where: { tenantId, status: 'pending' } }),
      this.db.delayCertificate.count({ where: { tenantId, status: 'submitted' } }),
      this.db.notification.count({
        where: { tenantId, employeeId, isRead: false, category: 'system' },
      }),
    ]);

    return {
      approvalCount: leaveCount + expenseCount + changeRequestCount + delayCertificateCount,
      unreadCount,
    };
  }

  async getProcessedHistory(limit = 100): Promise<DoneItem[]> {
    const [
      leaves,
      expenses,
      changes,
      corrections,
      delays,
      loas,
      yearends,
    ] = await Promise.all([
      this.db.leaveRequest.findMany({
        where: { status: { in: ['approved', 'rejected'] } },
        take: limit,
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          days: true,
          status: true,
          approvedAt: true,
          updatedAt: true,
          employee: { select: { lastName: true, firstName: true } },
        },
      }),
      this.db.expenseRequest.findMany({
        where: { status: { in: ['approved', 'rejected'] } },
        take: limit,
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          targetMonth: true,
          totalAmount: true,
          status: true,
          approvedAt: true,
          updatedAt: true,
          employee: { select: { lastName: true, firstName: true } },
        },
      }),
      this.db.changeRequest.findMany({
        where: { status: { in: ['approved', 'rejected'] } },
        take: limit,
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          changeType: true,
          oldValue: true,
          newValue: true,
          status: true,
          approvedAt: true,
          updatedAt: true,
          employee: { select: { lastName: true, firstName: true } },
        },
      }),
      this.db.attendanceCorrection.findMany({
        where: { status: { in: ['approved', 'rejected'] } },
        take: limit,
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          attendance: { select: { workDate: true } },
          originalClockIn: true,
          originalClockOut: true,
          originalBreakMinutes: true,
          newClockIn: true,
          newClockOut: true,
          newBreakMinutes: true,
          status: true,
          approvedAt: true,
          updatedAt: true,
          employee: { select: { lastName: true, firstName: true } },
        },
      }),
      this.db.delayCertificate.findMany({
        where: { status: 'confirmed' },
        take: limit,
        orderBy: [{ confirmedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          targetDate: true,
          route: true,
          confirmedAt: true,
          updatedAt: true,
          employee: { select: { lastName: true, firstName: true } },
        },
      }),
      this.db.leaveOfAbsence.findMany({
        where: { status: { in: ['on_leave', 'rejected', 'returned'] } },
        take: limit,
        orderBy: [{ returnApprovedAt: 'desc' }, { approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          absenceType: true,
          startDate: true,
          expectedReturnDate: true,
          actualReturnDate: true,
          status: true,
          approvedAt: true,
          returnApprovedAt: true,
          updatedAt: true,
          employee: { select: { lastName: true, firstName: true } },
        },
      }),
      this.db.yearendAdjustment.findMany({
        where: { status: { in: ['approved', 'rejected'] } },
        take: limit,
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          fiscalYear: true,
          status: true,
          approvedAt: true,
          updatedAt: true,
          employee: { select: { lastName: true, firstName: true } },
        },
      }),
    ]);

    const items: Array<DoneItem & { sortAt: number }> = [];

    for (const item of leaves) {
      items.push({
        id: item.id,
        type: 'leave',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${fmtDate(item.startDate)}〜${fmtDate(item.endDate)}（${leaveTypeLabel[item.leaveType] || item.leaveType}・${item.days}日間）`,
        approved: item.status === 'approved',
        processedDate: fmtDate(item.approvedAt || item.updatedAt),
        sortAt: new Date(item.approvedAt || item.updatedAt).getTime(),
      });
    }

    for (const item of expenses) {
      items.push({
        id: item.id,
        type: 'expense',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${fmtMonth(item.targetMonth)} 交通費 ${fmtAmount(item.totalAmount)}円`,
        approved: item.status === 'approved',
        processedDate: fmtDate(item.approvedAt || item.updatedAt),
        sortAt: new Date(item.approvedAt || item.updatedAt).getTime(),
      });
    }

    for (const item of changes) {
      const oldVal = item.oldValue as Record<string, unknown>;
      const newVal = item.newValue as Record<string, unknown>;
      let detail = changeTypeLabel[item.changeType] || item.changeType;
      if (item.changeType === 'address') {
        detail = `住所変更：${String(oldVal?.address || '—')} → ${String(newVal?.address || '—')}`;
      } else if (item.changeType === 'bank') {
        detail = `口座変更：${String(oldVal?.bankName || '—')} → ${String(newVal?.bankName || '—')}`;
      }
      items.push({
        id: item.id,
        type: 'change',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail,
        approved: item.status === 'approved',
        processedDate: fmtDate(item.approvedAt || item.updatedAt),
        sortAt: new Date(item.approvedAt || item.updatedAt).getTime(),
      });
    }

    for (const item of corrections) {
      const changes: string[] = [];
      if (item.newClockIn) changes.push(`出勤: ${fmtTime(item.originalClockIn)}→${fmtTime(item.newClockIn)}`);
      if (item.newClockOut) changes.push(`退勤: ${fmtTime(item.originalClockOut)}→${fmtTime(item.newClockOut)}`);
      if (item.newBreakMinutes !== null) changes.push(`休憩: ${item.originalBreakMinutes}分→${item.newBreakMinutes}分`);
      items.push({
        id: item.id,
        type: 'attendance',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${fmtDate(item.attendance.workDate)} ${changes.join(' / ')}`,
        approved: item.status === 'approved',
        processedDate: fmtDate(item.approvedAt || item.updatedAt),
        sortAt: new Date(item.approvedAt || item.updatedAt).getTime(),
      });
    }

    for (const item of delays) {
      items.push({
        id: item.id,
        type: 'delay',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `遅延証明書 ${fmtDate(item.targetDate)}${item.route ? ` (${item.route})` : ''}`,
        approved: true,
        processedDate: fmtDate(item.confirmedAt || item.updatedAt),
        sortAt: new Date(item.confirmedAt || item.updatedAt).getTime(),
      });
    }

    for (const item of loas) {
      const detail =
        item.status === 'returned'
          ? `復職承認（${absenceTypeLabel[item.absenceType] || item.absenceType}）`
          : item.status === 'rejected'
            ? `休職却下（${absenceTypeLabel[item.absenceType] || item.absenceType}）`
            : `休職承認（${absenceTypeLabel[item.absenceType] || item.absenceType}・${fmtDate(item.startDate)}〜${fmtDate(item.expectedReturnDate)}）`;
      const processedAt = item.returnApprovedAt || item.approvedAt || item.updatedAt;
      items.push({
        id: item.id,
        type: 'loa',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail,
        approved: item.status !== 'rejected',
        processedDate: fmtDate(processedAt),
        sortAt: new Date(processedAt).getTime(),
      });
    }

    for (const item of yearends) {
      items.push({
        id: item.id,
        type: 'yearend',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${item.fiscalYear}年 年末調整${item.status === 'rejected' ? '（差し戻し）' : ''}`,
        approved: item.status === 'approved',
        processedDate: fmtDate(item.approvedAt || item.updatedAt),
        sortAt: new Date(item.approvedAt || item.updatedAt).getTime(),
      });
    }

    return items
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, limit)
      .map(({ sortAt, ...item }) => item);
  }
}
