/**
 * NoticesService — 通知書 (内定通知書 / 労働条件通知書 有期・無期) の発行
 *
 * 各 issue メソッドは PDF 生成 → Drive 保存 → DocumentIssuance 履歴記録 をまとめて行う。
 * Drive 未連携時は PDF生成 + DB履歴のみ（drive_file_id は null）。
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { NoticePdfService, OfferData, LaborFixedData, LaborOpenData } from './notice-pdf.service';

type DocType = 'offer' | 'notice_fixed' | 'notice_open';
const CATEGORY_FOLDER: Record<DocType, string> = {
  offer: '内定通知書',
  notice_fixed: '労働条件通知書（有期）',
  notice_open: '労働条件通知書（無期）',
};

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly drive: GoogleDriveService,
    private readonly noticePdf: NoticePdfService,
  ) {}

  async issueOffer(employeeId: string, data: OfferData, issuedByUserId?: string) {
    const pdf = await this.noticePdf.buildOfferPdf(data);
    return this.persistAndUpload({
      employeeId,
      docType: 'offer',
      pdf,
      issuedByUserId,
      metadata: data as any,
    });
  }

  async issueLaborFixed(employeeId: string, data: LaborFixedData, issuedByUserId?: string) {
    const pdf = await this.noticePdf.buildLaborFixedPdf(data);
    return this.persistAndUpload({
      employeeId,
      docType: 'notice_fixed',
      pdf,
      issuedByUserId,
      metadata: data as any,
    });
  }

  async issueLaborOpen(employeeId: string, data: LaborOpenData, issuedByUserId?: string) {
    const pdf = await this.noticePdf.buildLaborOpenPdf(data);
    return this.persistAndUpload({
      employeeId,
      docType: 'notice_open',
      pdf,
      issuedByUserId,
      metadata: data as any,
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
  }) {
    const emp = await this.db.employee.findUnique({
      where: { id: args.employeeId },
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
    if (this.drive.isEnabled()) {
      try {
        const res = await this.drive.saveDocumentPdf({
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
        employeeId: emp.id,
        documentType: args.docType,
        targetDate: now,
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
  async listByEmployee(employeeId: string) {
    return this.db.documentIssuance.findMany({
      where: { employeeId },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
