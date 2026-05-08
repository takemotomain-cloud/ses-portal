/**
 * OnboardingDocumentsService — 入社情報フォームでアップロードされた本人確認書類を
 * 社員単位で Drive に格納し、DB (onboarding_documents) に履歴を残す。
 *
 * Drive 階層:
 *   SES Portal/本人書類/{社員コード or ID先頭8桁}_{氏名}/{categoryFolder}/
 *
 * 対象 documentType:
 *   license_front / license_back / mynumber_front / mynumber_back /
 *   pension_book / resident_record / employment_insurance_certificate
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { DatabaseService } from '../../database/database.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';

export const ONBOARDING_DOCUMENT_TYPES = [
  'license_front',
  'license_back',
  'mynumber_front',
  'mynumber_back',
  'pension_book',
  'resident_record',
  'employment_insurance_certificate',
] as const;
export type OnboardingDocumentType = (typeof ONBOARDING_DOCUMENT_TYPES)[number];

const CATEGORY_FOLDER: Record<OnboardingDocumentType, string> = {
  license_front: '本人確認書類',
  license_back: '本人確認書類',
  mynumber_front: 'マイナンバーカード',
  mynumber_back: 'マイナンバーカード',
  pension_book: '年金手帳',
  resident_record: '住民票',
  employment_insurance_certificate: '雇用保険被保険者証',
};

@Injectable()
export class OnboardingDocumentsService {
  private readonly logger = new Logger(OnboardingDocumentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly drive: GoogleDriveService,
  ) {}

  /**
   * 単一ファイルをアップロード
   * file: multer が diskStorage で保存した一時ファイル
   */
  async uploadOne(
    employeeId: string,
    documentType: string,
    file: Express.Multer.File,
    uploadedByUserId?: string,
  ) {
    if (!ONBOARDING_DOCUMENT_TYPES.includes(documentType as OnboardingDocumentType)) {
      throw new BadRequestException(`未対応の documentType: ${documentType}`);
    }
    if (!file) throw new BadRequestException('ファイルがありません');

    const emp = await this.db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true, lastName: true, firstName: true, hireDate: true },
    });
    if (!emp) throw new NotFoundException('社員が見つかりません');

    // multer が latin1 でファイル名を保持するので UTF-8 デコード
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const fullName = `${emp.lastName || ''}${emp.firstName || ''}`.trim() || 'unknown';
    const folderKey = `${emp.employeeCode || emp.id.slice(0, 8)}_${fullName}`;
    const categoryFolder = CATEGORY_FOLDER[documentType as OnboardingDocumentType];

    // ファイル名: {documentType}_{YYYYMMDDHHmm}.{ext}
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes());
    const ext = (originalName.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
    const fileName = `${documentType}_${stamp}${ext}`;

    // 入社日基準で「年度入社社員 / 入社月」フォルダに振り分け
    // 年度は 5月始まり（例: 2026/4 入社 → 2025年度入社社員, 2026/5 入社 → 2026年度入社社員）
    const hireDate = emp.hireDate ? new Date(emp.hireDate) : now;
    const hy = hireDate.getFullYear();
    const hm = hireDate.getMonth() + 1;
    const fiscalYear = hm >= 5 ? hy : hy - 1;
    const fiscalFolder = `${fiscalYear}年度入社社員`;
    const monthFolder = `${hy}年${hm}月`;

    let driveFileId: string | null = null;
    let driveViewLink: string | null = null;
    if (this.drive.isEnabled()) {
      try {
        const folderId = await this.drive.ensureFolderPath([
          fiscalFolder,
          monthFolder,
          folderKey,
          categoryFolder,
        ]);
        const buffer = fs.readFileSync(file.path);
        const mime = file.mimetype || 'application/octet-stream';
        const res = await this.drive.uploadBuffer({
          folderId,
          fileName,
          buffer,
          mimeType: mime,
        });
        driveFileId = res.fileId;
        driveViewLink = res.webViewLink;
      } catch (e) {
        this.logger.warn(`Drive 保存失敗: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('Drive 未連携 — ローカル保存のみ');
    }

    const record = await this.db.onboardingDocument.create({
      data: {
        employeeId: emp.id,
        documentType,
        fileName,
        mimeType: file.mimetype || null,
        fileSize: file.size || null,
        localPath: `/uploads/onboarding-documents/${file.filename}`,
        driveFileId,
        driveViewLink,
        uploadedBy: uploadedByUserId || null,
      },
    });

    this.logger.log(
      `本人確認書類アップロード: emp=${emp.id} type=${documentType} drive=${driveFileId || 'none'}`,
    );

    return {
      id: record.id,
      fileName,
      driveViewLink,
      documentType,
    };
  }

  async listByEmployee(employeeId: string) {
    return this.db.onboardingDocument.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}
