/**
 * Skillsheets Service
 *
 * SES事業部の社員スキルシートCRUD。
 * 管理部社員は対象外。
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SkillsheetsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * SES事業部の社員一覧（スキルシート有無を含む）
   * 管理部を除外
   */
  async findAllWithEmployees(search?: string) {
    // まず管理部のIDを取得して除外
    const adminDepts = await this.db.department.findMany({
      where: { name: { contains: '管理' } },
      select: { id: true },
    });
    const excludeIds = adminDepts.map(d => d.id);

    const where: any = {
      deletedAt: null,
      status: 'active',
    };
    if (excludeIds.length > 0) {
      where.departmentId = { notIn: excludeIds };
    }
    if (search) {
      where.OR = [
        { lastName: { contains: search } },
        { firstName: { contains: search } },
      ];
    }

    const employees = await this.db.employee.findMany({
      where,
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
        skillsheet: true,
      },
      orderBy: { employeeCode: 'asc' },
    });

    return employees.map(emp => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.lastName} ${emp.firstName}`,
      nameKana: `${emp.lastNameKana || ''} ${emp.firstNameKana || ''}`.trim(),
      departmentName: emp.department?.name || '',
      positionName: emp.position?.name || null,
      education: emp.education || '',
      schoolName: emp.schoolName || '',
      gender: emp.gender || '',
      station: emp.station || '',
      qualifications: emp.qualifications || [],
      birthDate: emp.birthDate,
      hasSkillsheet: !!emp.skillsheet,
      skillsheet: emp.skillsheet ? {
        id: emp.skillsheet.id,
        experience: emp.skillsheet.experience,
        selfPr: emp.skillsheet.selfPr,
        skills: emp.skillsheet.skills,
        projects: emp.skillsheet.projects,
        summaryAffiliation: emp.skillsheet.summaryAffiliation,
        summaryMonth: emp.skillsheet.summaryMonth,
        summaryRate: emp.skillsheet.summaryRate,
        updatedAt: emp.skillsheet.updatedAt,
      } : null,
    }));
  }

  /**
   * 特定社員のスキルシートを取得（社員情報含む）
   */
  async findByEmployeeId(employeeId: string) {
    const emp = await this.db.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
        skillsheet: true,
      },
    });
    if (!emp) return null;

    return {
      employee: {
        id: emp.id,
        name: `${emp.lastName} ${emp.firstName}`,
        nameKana: `${emp.lastNameKana} ${emp.firstNameKana}`,
        birthDate: emp.birthDate,
        gender: emp.gender || '',
        education: emp.education || '',
        schoolName: emp.schoolName || '',
        departmentName: emp.department?.name || '',
        positionName: emp.position?.name || null,
        station: emp.station || '',
        qualifications: emp.qualifications || [],
      },
      skillsheet: emp.skillsheet ? {
        id: emp.skillsheet.id,
        experience: emp.skillsheet.experience,
        selfPr: emp.skillsheet.selfPr,
        skills: emp.skillsheet.skills,
        projects: emp.skillsheet.projects,
      } : null,
    };
  }

  /**
   * スキルシートを作成or更新（upsert）
   */
  async upsert(employeeId: string, data: {
    experience?: string;
    selfPr?: string;
    projects?: any;
  }) {
    return this.db.skillsheet.upsert({
      where: { employeeId },
      create: {
        employeeId,
        experience: data.experience || null,
        selfPr: data.selfPr || null,
        projects: data.projects || [],
      },
      update: {
        experience: data.experience || null,
        selfPr: data.selfPr || null,
        projects: data.projects || [],
      },
    });
  }

  /**
   * サマリ情報を保存
   */
  async saveSummary(employeeId: string, data: {
    summaryAffiliation?: string;
    summaryMonth?: string;
    summaryRate?: string;
  }) {
    return this.db.skillsheet.upsert({
      where: { employeeId },
      create: {
        employeeId,
        summaryAffiliation: data.summaryAffiliation || null,
        summaryMonth: data.summaryMonth || null,
        summaryRate: data.summaryRate || null,
      },
      update: {
        summaryAffiliation: data.summaryAffiliation || null,
        summaryMonth: data.summaryMonth || null,
        summaryRate: data.summaryRate || null,
      },
    });
  }
}
