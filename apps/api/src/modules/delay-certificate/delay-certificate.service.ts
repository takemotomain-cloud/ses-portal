/**
 * Delay Certificate Service — 遅延証明書サービス
 *
 * 社員が遅延証明書（画像/PDF）を提出し、管理者が確認する。
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DelayCertificateService {
  private readonly logger = new Logger(DelayCertificateService.name);

  constructor(private readonly db: DatabaseService) {}

  /** 遅延証明書を提出 */
  async submit(
    employeeId: string,
    data: {
      targetDate: string;
      route?: string;
      reason?: string;
      filePath?: string;
      fileName?: string;
    },
  ) {
    const cert = await this.db.delayCertificate.create({
      data: {
        employeeId,
        targetDate: new Date(data.targetDate),
        route: data.route || null,
        reason: data.reason || null,
        filePath: data.filePath || null,
        fileName: data.fileName || null,
        status: 'submitted',
      },
    });

    this.logger.log(`遅延証明書提出: employee=${employeeId}, date=${data.targetDate}`);
    return cert;
  }

  /** 自分の提出一覧 */
  async getMyList(employeeId: string) {
    return this.db.delayCertificate.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** 管理者: 未確認一覧 */
  async getPending() {
    return this.db.delayCertificate.findMany({
      where: { status: 'submitted' },
      include: {
        employee: {
          select: { lastName: true, firstName: true, employeeCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 管理者: 全件一覧 */
  async getAll() {
    return this.db.delayCertificate.findMany({
      include: {
        employee: {
          select: { lastName: true, firstName: true, employeeCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** 管理者: 確認済みにする */
  async confirm(id: string, confirmerId: string) {
    const cert = await this.db.delayCertificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('遅延証明書が見つかりません');
    if (cert.status === 'confirmed') throw new BadRequestException('既に確認済みです');

    const updated = await this.db.delayCertificate.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedBy: confirmerId,
        confirmedAt: new Date(),
      },
    });

    this.logger.log(`遅延証明書確認: id=${id}, confirmedBy=${confirmerId}`);
    return updated;
  }
}
