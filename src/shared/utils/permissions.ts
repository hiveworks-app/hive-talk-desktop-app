import { USER_ROLE, USER_TYPE, type UserRole, type UserType } from '@/shared/types/user';

// ─── companyId 기반 userType 파생 ────────────────────────────────

/** companyId 존재 여부로 앱 내 사용자 유형을 결정 (RN deriveUserType 패리티) */
export const deriveUserType = (companyId: string | null): UserType =>
  companyId != null ? USER_TYPE.ORG_MEMBER : USER_TYPE.EXTERNAL_USER;

// ─── userType 기반 권한 ──────────────────────────────────────────

/** 외부 채팅방 생성 가능 여부 (소속/외부소속 유저만) */
export const canCreateExternalRoom = (userType: UserType): boolean =>
  userType !== USER_TYPE.EXTERNAL_USER;

/** 외부 채팅방 멤버 초대 가능 여부 (소속/외부소속 유저만) */
export const canInviteToExternalRoom = (userType: UserType): boolean =>
  userType !== USER_TYPE.EXTERNAL_USER;

/** DM/GM 사용 가능 여부 (소속/외부소속 유저만) */
export const canUseDMGM = (userType: UserType): boolean => userType !== USER_TYPE.EXTERNAL_USER;

/** 새 외부 사람 초대 가능 여부 (소속/외부소속 유저만) */
export const canInviteExternalUser = (userType: UserType): boolean =>
  userType !== USER_TYPE.EXTERNAL_USER;

// ─── role 기반 권한 (GUEST 정책 반영) ────────────────────────────

/** GUEST 여부 확인 */
export const isGuest = (role: UserRole): boolean => role === USER_ROLE.GUEST;

/** ADMIN 여부 확인 */
export const isAdmin = (role: UserRole): boolean => role === USER_ROLE.ADMIN;

/** 소속 사용자 여부 (MEMBER 또는 ADMIN) */
export const isOrgRole = (role: UserRole): boolean => role !== USER_ROLE.GUEST;

/** 채팅방 제목 수정 가능 여부 (GUEST 불가) */
export const canEditRoomTitle = (role: UserRole): boolean => role !== USER_ROLE.GUEST;

/** Contact(협력멤버) 요청 발신 가능 여부 (GUEST 불가) */
export const canSendContactRequest = (role: UserRole): boolean => role !== USER_ROLE.GUEST;

/** 협력멤버 검색 가능 여부 (GUEST 불가) */
export const canSearchExternalMember = (role: UserRole): boolean => role !== USER_ROLE.GUEST;

/** EM 채팅방 내 추가 초대 가능 여부 (GUEST 불가) */
export const canInviteInExternalRoom = (role: UserRole): boolean => role !== USER_ROLE.GUEST;

/** 채팅방 생성 가능 여부 (DM/GM/EM 모두 GUEST 불가) */
export const canCreateChatRoom = (role: UserRole): boolean => role !== USER_ROLE.GUEST;

/** WEB 플랫폼 접근 가능 여부 (ADMIN만) */
export const canAccessWeb = (role: UserRole): boolean => role === USER_ROLE.ADMIN;
