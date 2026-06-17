export type ExternalInviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';

export interface ExternalMemberItem {
  userId: number;
  name: string;
  email: string;
  thumbnailProfileUrl?: string;
  inviteStatus: ExternalInviteStatus;
  invitedBy: number;
  invitedAt: string;
  joinedRoomCount: number;
}

export interface ExternalMembersGetPayload {
  items: ExternalMemberItem[];
}

export interface InviteExternalUserRequest {
  email: string;
  name?: string;
}

export interface InviteExternalUserResponse {
  userId: number;
  inviteStatus: ExternalInviteStatus;
}

/** 받은 초대 수락/거절 결과 */
export type InviteResultType = 'ACCEPT' | 'REJECTED';

export interface RespondInvitePayload {
  result: string;
}

/** 보낸 초대 API 원본 아이템 */
export interface SentInviteRawItem {
  inviteId: string;
  result: string;
  receivedAt: string;
  userModel: {
    userId: string;
    name: string;
    email?: string;
    companyName?: string;
    profileUrl?: string;
    profilePresignedUrl?: string;
  };
}

export interface SentInvitesPayload {
  items: SentInviteRawItem[];
}

/** 보낸 초대 정규화 아이템 (UI용) */
export interface SentInviteItem {
  inviteId: string;
  userId: string;
  name: string;
  profileUrl?: string;
  sentAt: string;
  status: string;
}

/** 받은 초대 API 원본 아이템 */
export interface ReceivedInviteRawItem {
  inviteId: string;
  result: string;
  receivedAt: string;
  userModel: {
    userId: string;
    name: string;
    email?: string;
    companyName?: string;
    profileUrl?: string;
    profilePresignedUrl?: string;
    department?: string;
    job?: string;
  };
}

export interface ReceivedInvitesPayload {
  items: ReceivedInviteRawItem[];
}

/** 받은 초대 정규화 아이템 (UI용) */
export interface ReceivedInviteItem {
  inviteId: string;
  userId: string;
  name: string;
  companyName?: string;
  profileUrl?: string;
  result: string;
}

/** 이메일로 외부 사람 검색 응답 */
export interface SearchExternalByEmailPayload {
  userId: number;
  name: string;
  email: string;
  thumbnailProfileUrl?: string;
  company?: string;
  department?: string;
  job?: string;
}

/** 연락처(전화번호)로 외부 사람 검색 응답 */
export interface SearchExternalByPhonePayload {
  userId: number;
  name: string;
  phone: string;
  thumbnailProfileUrl?: string;
  company?: string;
  department?: string;
  job?: string;
}

/** 이메일로 외부 사람 초대 요청/응답 */
export interface InviteExternalByEmailRequest {
  email: string;
}
export interface InviteExternalByEmailPayload {
  userId: number;
  inviteStatus: ExternalInviteStatus;
}

/** 연락처(전화번호)로 외부 사람 초대 요청/응답 */
export interface InviteExternalByPhoneRequest {
  phoneFull: string;
}
export interface InviteExternalByPhonePayload {
  userId: number;
  inviteStatus: ExternalInviteStatus;
}
