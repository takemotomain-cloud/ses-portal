/**
 * Certificates Service
 *
 * 証明書（在籍証明書・収入証明書）の発行管理。
 * 社員が申請 → 管理者がPDFアップロード → 発行済み → 社員がダウンロード。
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(private readonly db: DatabaseService) {}

  /** 社員の証明書一覧 */
  async getMyCertificates(employeeId: string) {
    return this.db.certificate.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 証明書発行申請 */
  async requestCertificate(employeeId: string, certType: string) {
    const cert = await this.db.certificate.create({
      data: { employeeId, certType, status: 'pending' },
    });
    this.logger.log(`Certificate requested: ${certType} for employee ${employeeId}`);
    return cert;
  }

  /** 証明書発行（管理者がPDFパスを設定） */
  async issueCertificate(certId: string, filePath: string, issuedBy: string) {
    const cert = await this.db.certificate.findUnique({ where: { id: certId } });
    if (!cert) throw new NotFoundException('証明書が見つかりません');

    await this.db.certificate.update({
      where: { id: certId },
      data: { status: 'issued', filePath, issuedAt: new Date(), issuedBy },
    });
    this.logger.log(`Certificate issued: ${certId}`);
  }

  /** 全申請一覧（管理者用） */
  async getAllPending() {
    return this.db.certificate.findMany({
      where: { status: 'pending' },
      include: { employee: { select: { lastName: true, firstName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
