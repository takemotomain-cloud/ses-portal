/**
 * NoticesService — 通知書 (内定通知書 / 労働条件通知書 有期・無期) の発行
 *
 * 各 issue メソッドは PDF 生成 → Drive 保存 → DocumentIssuance 履歴記録 をまとめて行う。
 * Drive 未連携時は PDF生成 + DB履歴のみ（drive_file_id は null）。
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { NoticePdfService, OfferData, LaborFixedData, LaborOpenData } from './notice-pdf.service';

type DocType = 'offer' | 'notice_fixed' | 'notice_open';
type WorkflowStatus = 'issued' | 'sent' | 'waiting_ack' | 'completed';
const CATEGORY_FOLDER: Record<DocType, string> = {
  offer: '内定通知書',
  notice_fixed: '労働条件通知書（有期）',
  notice_open: '労働条件通知書（無期）',
};

const allowedWorkflowStatuses: WorkflowStatus[] = ['issued', 'sent', 'waiting_ack', 'completed'];
const allowedDeliveryMethods = ['drive', 'email', 'paper', 'post', 'other'] as const;

export interface NoticeWorkflowUpdateInput {
  workflowStatus: WorkflowStatus;
  deliveryMethod?: string | null;
  deliveredAt?: string | null;
  acknowledgedAt?: string | null;
  workflowNote?: string | null;
}

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly drive: GoogleDriveService,
    private readonly noticePdf: NoticePdfService,
  ) {}

  async issueOffer(employeeId: string, data: OfferData, issuedByUserId?: string, tenantId = '') {
    const pdf = await this.noticePdf.buildOfferPdf(data);
    return this.persistAndUpload({
      employeeId,
      docType: 'offer',
      pdf,
      issuedByUserId,
      metadata: data as any,
      tenantId,
    });
  }

  async issueLaborFixed(employeeId: string, data: LaborFixedData, issuedByUserId?: string, tenantId = '') {
    const pdf = await this.noticePdf.buildLaborFixedPdf(data);
    return this.persistAndUpload({
      employeeId,
      docType: 'notice_fixed',
      pdf,
      issuedByUserId,
      metadata: data as any,
      tenantId,
    });
  }

  async issueLaborOpen(employeeId: string, data: LaborOpenData, issuedByUserId?: string, tenantId = '') {
    const pdf = await this.noticePdf.buildLaborOpenPdf(data);
    return this.persistAndUpload({
      employeeId,
      docType: 'notice_open',
      pdf,
      issuedByUserId,
      metadata: data as any,
      tenantId,
    });
  }

  /**
   * 共通: PDF を Drive に保存し、DocumentIssuance 履歴を残す
   */
  private async persistAndUpload(args: {
    employeeId: string;
    docType: DocType;
    pdf: Buffer;
    issuedByUserId?: string;
    metadata: Record<string, unknown>;
    tenantId: string;
  }) {
    const emp = await this.db.employee.findUnique({
      where: { id: args.employeeId, tenantId: args.tenantId },
      select: { id: true, employeeCode: true, lastName: true, firstName: true },
    });
    if (!emp) throw new NotFoundException('社員が見つかりません');

    const now = new Date();
    const fullName = `${emp.lastName}${emp.firstName}`;
    const ymStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fileName = `${emp.employeeCode}_${fullName}_${ymStr}.pdf`;
    const categoryFolder = CATEGORY_FOLDER[args.docType];

    let driveFileId: string | null = null;
    let driveViewLink: string | null = null;
    if (await this.drive.isEnabled(args.tenantId)) {
      try {
        const res = await this.drive.saveDocumentPdf(args.tenantId, {
          categoryFolder,
          fiscalYearDate: now,  // 発行日基準（給与明細以外は発行月）
          monthDate: now,
          fileName,
          pdf: args.pdf,
        });
        driveFileId = res.fileId;
        driveViewLink = res.webViewLink;
      } catch (e) {
        this.logger.warn(`Drive 保存失敗: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn(`Drive 未連携のため ${categoryFolder} は保存されません`);
    }

    const issuance = await this.db.documentIssuance.create({
      data: {
        tenantId: args.tenantId,
        employeeId: emp.id,
        documentType: args.docType,
        targetDate: now,
        workflowStatus: 'issued',
        fileName,
        driveFileId,
        driveViewLink,
        issuedBy: args.issuedByUserId || null,
        metadata: args.metadata as any,
      },
    });

    this.logger.log(`${categoryFolder} 発行: ${fileName} (drive=${driveFileId || 'none'})`);
    return {
      id: issuance.id,
      fileName,
      driveViewLink,
    };
  }

  /**
   * 社員別の発行履歴を取得（直近順）
   */
  async listByEmployee(employeeId: string, tenantId: string) {
    return this.db.documentIssuance.findMany({
      where: { employeeId, tenantId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async updateWorkflow(issuanceId: string, input: NoticeWorkflowUpdateInput) {
    const issuance = await this.db.documentIssuance.findUnique({
      where: { id: issuanceId },
      select: { id: true },
    });
    if (!issuance) throw new NotFoundException('通知書履歴が見つかりません');

    if (!allowedWorkflowStatuses.includes(input.workflowStatus)) {
      throw new BadRequestException('不正な進捗ステータスです');
    }
    if (
      input.deliveryMethod &&
      !allowedDeliveryMethods.includes(input.deliveryMethod as (typeof allowedDeliveryMethods)[number])
    ) {
      throw new BadRequestException('不正な送付方法です');
    }

    const deliveredAt =
      input.deliveredAt
        ? new Date(input.deliveredAt)
        : input.workflowStatus === 'sent' ||
            input.workflowStatus === 'waiting_ack' ||
            input.workflowStatus === 'completed'
          ? new Date()
          : null;
    const acknowledgedAt =
      input.acknowledgedAt
        ? new Date(input.acknowledgedAt)
        : input.workflowStatus === 'completed'
          ? new Date()
          : null;

    return this.db.documentIssuance.update({
      where: { id: issuanceId },
      data: {
        workflowStatus: input.workflowStatus,
        deliveryMethod: input.deliveryMethod || null,
        deliveredAt,
        acknowledgedAt,
        workflowNote: input.workflowNote?.trim() || null,
      },
    });
  }
}
