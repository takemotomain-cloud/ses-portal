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

type CheckState = 'done' | 'pending' | 'na';

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
    tenantId: string,
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
      where: { id: employeeId, tenantId },
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
    if (await this.drive.isEnabled(tenantId)) {
      try {
        const folderId = await this.drive.ensureFolderPath(tenantId, [
          fiscalFolder,
          monthFolder,
          folderKey,
          categoryFolder,
        ]);
        const buffer = fs.readFileSync(file.path);
        const mime = file.mimetype || 'application/octet-stream';
        const res = await this.drive.uploadBuffer(tenantId, {
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
        tenantId,
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

  async listByEmployee(tenantId: string, employeeId: string) {
    return this.db.onboardingDocument.findMany({
      where: { employeeId, tenantId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getRecentOnboardingSummary(tenantId: string) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);

    const employees = await this.db.employee.findMany({
      where: {
        tenantId,
        status: 'active',
        hireDate: { gte: cutoff },
      },
      orderBy: { hireDate: 'asc' },
      take: 100,
      select: {
        id: true,
        employeeCode: true,
        lastName: true,
        firstName: true,
        hireDate: true,
        bankName: true,
        bankBranch: true,
        bankAccountType: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
        qualifications: true,
        emergencyContacts: {
          select: { id: true, name: true, phone: true },
        },
        dependents: {
          where: { deletedAt: null, isActive: true },
          select: { id: true, name: true },
        },
      },
    });

    const employeeIds = employees.map((employee) => employee.id);
    if (employeeIds.length === 0) return [];

    const [documents, issuances, manualStatuses] = await Promise.all([
      this.db.onboardingDocument.findMany({
        where: { tenantId, employeeId: { in: employeeIds } },
        select: { employeeId: true, documentType: true },
      }),
      this.db.documentIssuance.findMany({
        where: { tenantId, employeeId: { in: employeeIds } },
        select: { employeeId: true, documentType: true },
      }),
      this.db.onboardingCheckStatus.findMany({
        where: { employeeId: { in: employeeIds } },
      }),
    ]);

    const documentsByEmployee = new Map<string, Set<string>>();
    for (const doc of documents) {
      if (!documentsByEmployee.has(doc.employeeId)) {
        documentsByEmployee.set(doc.employeeId, new Set());
      }
      documentsByEmployee.get(doc.employeeId)!.add(doc.documentType);
    }

    const issuancesByEmployee = new Map<string, Set<string>>();
    for (const issuance of issuances) {
      if (!issuancesByEmployee.has(issuance.employeeId)) {
        issuancesByEmployee.set(issuance.employeeId, new Set());
      }
      issuancesByEmployee.get(issuance.employeeId)!.add(issuance.documentType);
    }

    const manualStatusesByEmployee = new Map<string, typeof manualStatuses>();
    for (const status of manualStatuses) {
      if (!manualStatusesByEmployee.has(status.employeeId)) {
        manualStatusesByEmployee.set(status.employeeId, []);
      }
      manualStatusesByEmployee.get(status.employeeId)!.push(status);
    }

    return employees.map((employee) => {
      const docTypes = documentsByEmployee.get(employee.id) || new Set<string>();
      const noticeTypes = issuancesByEmployee.get(employee.id) || new Set<string>();
      const employeeManualStatuses = manualStatusesByEmployee.get(employee.id) || [];
      const manualStatusMap = new Map(employeeManualStatuses.map((status) => [status.itemKey, status]));

      const autoStatuses: Record<string, CheckState> = {
        offer: noticeTypes.has('offer') ? 'done' : 'pending',
        labor: noticeTypes.has('notice_fixed') || noticeTypes.has('notice_open') ? 'done' : 'pending',
        identity: docTypes.has('license_front') && docTypes.has('license_back') ? 'done' : 'pending',
        mynumber: docTypes.has('mynumber_front') && docTypes.has('mynumber_back') ? 'done' : 'pending',
        pension: docTypes.has('pension_book') ? 'done' : 'pending',
        resident: docTypes.has('resident_record') ? 'done' : 'pending',
        employmentInsurance: docTypes.has('employment_insurance_certificate') ? 'done' : 'pending',
        bank:
          employee.bankName &&
          employee.bankBranch &&
          employee.bankAccountType &&
          employee.bankAccountNumber &&
          employee.bankAccountHolder
            ? 'done'
            : 'pending',
        emergency: employee.emergencyContacts.some((item) => item.name && item.phone) ? 'done' : 'pending',
        dependents: employee.dependents.length > 0 ? 'done' : 'na',
        qualifications: this.hasAnyQualification(employee.qualifications) ? 'done' : 'na',
      };

      const statuses = Object.fromEntries(
        Object.entries(autoStatuses).map(([key, value]) => [
          key,
          manualStatusMap.has(key) ? 'done' : value,
        ]),
      ) as Record<string, CheckState>;

      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: `${employee.lastName} ${employee.firstName}`,
        hireDateLabel: employee.hireDate.toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
        }),
        statuses,
        formStatus: Object.values(statuses).every((status) => status !== 'pending') ? 'done' : 'pending',
        manualStatuses: Object.fromEntries(
          employeeManualStatuses.map((status) => [status.itemKey, status]),
        ),
      };
    });
  }

  private hasAnyQualification(value: unknown) {
    if (!Array.isArray(value)) return false;
    return value.some((item) => {
      if (typeof item === 'string') return item.trim().length > 0;
      if (item && typeof item === 'object' && 'name' in item) {
        return typeof item.name === 'string' && item.name.trim().length > 0;
      }
      return false;
    });
  }
}
