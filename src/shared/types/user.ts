/**
 * 🏷️ 사용자 유형 (B2B)
 * - ORG_MEMBER: 조직에 소속된 유저 (companyId 존재)
 * - EXTERNAL_USER: 조직 미소속 외부 유저 (companyId === null)
 */
export const USER_TYPE = {
  ORG_MEMBER: 'ORG_MEMBER',
  EXTERNAL_USER: 'EXTERNAL_USER',
} as const;

export type UserType = (typeof USER_TYPE)[keyof typeof USER_TYPE];

/**
 * 🔑 서버 역할 (3계층)
 * - GUEST: 회사 미소속 유저 (companyId === null)
 * - MEMBER: 회사 소속 유저
 * - ADMIN: 회사 소속 + 해당 회사 관리자
 */
export const USER_ROLE = {
  GUEST: 'GUEST',
  MEMBER: 'MEMBER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export interface OrganizationInfo {
  organizationId: string;
  organizationName: string;
  departmentName?: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface MemberItem {
  companyId: number;
  code: string;
  brn: string;
  companyName: string;
  ceoName: string;
  openingAt: Date;
  userId: string;
  email: string;
  name: string;
  department: string;
  job: string;
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
  lastLoginAt: Date;
  loginAttemptCount: number;
  role: string;
  profileUrl: string | null;
  profileImageUrl?: string | null;
  profilePresignedUrl?: string | null;
  thumbnailProfileUrl?: string | null;
  /** 협력멤버(외부) 여부 — /app/users가 isExternal로 사내/협력을 함께 구분해 응답 (RN 패리티) */
  isExternal?: boolean;
}
