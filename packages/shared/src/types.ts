/**
 * SES Portal — 共有型定義
 *
 * フロントエンド(Next.js)とバックエンド(NestJS)の両方で使う型。
 * DBスキーマ（マイグレーションファイル）と1:1で対応する。
 *
 * 注意: ここに定義する型はAPIレスポンスの形であり、
 *       DB内部の暗号化カラム等はアプリ層で復号後にこの型に変換する
 */

// ============================================================
// Enums & Constants
// ============================================================

/** ユーザーロール。users.roleのCHECK制約と一致させること */
export const UserRole = {
  ADMIN: 'admin',
  SALES: 'sales',
  ACCOUNTING: 'accounting',
  EMPLOYEE: 'employee',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** 社員の在籍状態 */
export const EmployeeStatus = {
  ACTIVE: 'active',
  LEAVE: 'leave',
  RESIGNED: 'resigned',
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

/** 雇用形態 */
export const EmploymentType = {
  REGULAR: 'regular',
  CONTRACT: 'contract',
  PART_TIME: 'part_time',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

/** 雇用区分（有期/無期） */
export const ContractType = {
  FIXED_TERM: 'fixed_term',
  INDEFINITE: 'indefinite',
} as const;
export type ContractType = (typeof ContractType)[keyof typeof ContractType];

/** アサイン状態 */
export const AssignmentStatus = {
  ACTIVE: 'active',
  NEXT_CONFIRMED: 'next_confirmed',
  ENDED: 'ended',
  STANDBY: 'standby',
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

/** エリア */
export const Area = {
  TOKYO: 'tokyo',
  OSAKA: 'osaka',
  NAGOYA: 'nagoya',
} as const;
export type Area = (typeof Area)[keyof typeof Area];

/** 申請ステータス（有給・経費・情報変更共通） */
export const RequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

/** 有給種別 */
export const LeaveType = {
  FULL_DAY: 'full_day',
  AM_HALF: 'am_half',
  PM_HALF: 'pm_half',
  SPECIAL: 'special',
} as const;
export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType];

/** 勤怠ステータス */
export const AttendanceStatus = {
  NORMAL: 'normal',
  ABSENT: 'absent',
  PAID_LEAVE: 'paid_leave',
  SPECIAL_LEAVE: 'special_leave',
  MISSED: 'missed',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

/** 給与ステータス */
export const PayrollStatus = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
} as const;
export type PayrollStatus = (typeof PayrollStatus)[keyof typeof PayrollStatus];

/** 情報変更種別 */
export const ChangeType = {
  ADDRESS: 'address',
  BANK: 'bank',
  DEPENDENT: 'dependent',
  EMERGENCY: 'emergency',
} as const;
export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

// ============================================================
// Entity Types (APIレスポンス用)
// ============================================================

export interface Employee {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthDate: string;
  gender: string;
  hireDate: string;
  resignDate: string | null;
  employmentType: EmploymentType;
  contractType: ContractType;
  status: EmployeeStatus;
  departmentId: string;
  positionId: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  education: string | null;
  schoolName: string | null;
  baseSalary: number | null;
  rewardRate: number | null;
  hasBonus: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 社員一覧用の軽量版（個人情報を含まない） */
export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  contractType: ContractType;
  departmentName: string;
  positionName: string | null;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Assignment {
  id: string;
  employeeId: string;
  clientId: string;
  projectName: string;
  contractPrice: number;
  settlementLower: number;
  settlementUpper: number;
  workLocation: string | null;
  area: Area | null;
  startDate: string;
  endDate: string | null;
  status: AssignmentStatus;
  endReason: string | null;
}

export interface Attendance {
  id: string;
  employeeId: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number | null;
  overtimeMinutes: number | null;
  status: AttendanceStatus;
  isMissedClock: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: RequestStatus;
  approverId: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  grantedDate: string;
  expiryDate: string;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface Notification {
  id: string;
  employeeId: string;
  title: string;
  body: string;
  category: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

// ============================================================
// Auth Types
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  role: UserRole;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
