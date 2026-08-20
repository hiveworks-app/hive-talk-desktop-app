/** 초대한 회사 정보 (RN MemberInviteCompanyModel 패리티) */
export interface MemberInviteCompanyModel {
  id: string;
  code: string;
  brn: string;
  companyName: string;
  ceoName: string;
  openingAt: string;
}

export type MemberInviteResult = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

/** 초대를 보낸 관리자 정보 */
export interface MemberInviteAdminUser {
  userId: string;
  email: string;
  name: string;
  department?: string;
  job?: string;
}

/** 소속(사내) 초대 payload — WS BROADCAST/INIT 공통 (RN 패리티) */
export interface MemberInvitePayload {
  inviteId: string;
  result: MemberInviteResult;
  receivedAt: string;
  companyModel: MemberInviteCompanyModel;
  adminUser?: MemberInviteAdminUser;
}
