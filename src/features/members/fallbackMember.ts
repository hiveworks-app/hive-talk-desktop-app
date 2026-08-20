import type { MemberItem } from '@/shared/types/user';

/**
 * 멤버목록에 없는 사용자(미등록/방을 나간 참여자)의 프로필 표시용 최소 MemberItem 구성.
 * 채팅 참여자·발신자 정보만으로 프로필 다이얼로그를 열 때 사용 (RN sender 스냅샷 폴백의 데스크톱 대응).
 */
export function buildFallbackMember(params: {
  userId: string;
  name: string;
  thumbnailProfileUrl?: string | null;
  isExternal?: boolean;
}): MemberItem {
  return {
    companyId: 0,
    code: '',
    brn: '',
    companyName: '',
    ceoName: '',
    openingAt: new Date(0),
    userId: params.userId,
    email: '',
    name: params.name,
    department: '',
    job: '',
    phoneHead: '',
    phoneMid: '',
    phoneTail: '',
    lastLoginAt: new Date(0),
    loginAttemptCount: 0,
    role: '',
    profileUrl: params.thumbnailProfileUrl ?? null,
    thumbnailProfileUrl: params.thumbnailProfileUrl ?? null,
    isExternal: params.isExternal ?? false,
  };
}
