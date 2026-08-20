import type { MemberItem } from '@/shared/types/user';
import type { FetchUserRawModel } from '@/shared/types/websocket';

/**
 * WS 차단 동기화 raw 모델 → MemberItem 정규화 (RN features/block/normalize.ts 패리티).
 * 서버 직렬화에 따라 userId가 number/string으로 섞여 오고 필드가 누락될 수 있어 전부 방어.
 * userId가 무효('', 'undefined', 'null')면 null 반환 — 호출부에서 필터.
 */
export function normalizeBlockedItem(raw: FetchUserRawModel): MemberItem | null {
  const userId = String(raw.userId ?? '');
  if (!userId || userId === 'undefined' || userId === 'null') return null;

  const companyIdNum = Number(raw.companyId);

  return {
    companyId: Number.isFinite(companyIdNum) ? companyIdNum : 0,
    code: raw.code ?? '',
    brn: raw.brn ?? '',
    companyName: raw.companyName ?? '',
    ceoName: raw.ceoName ?? '',
    openingAt: new Date(0),
    userId,
    email: raw.email ?? '',
    name: raw.name ?? '',
    department: raw.department ?? '',
    job: raw.job ?? '',
    phoneHead: raw.phoneHead ?? '',
    phoneMid: raw.phoneMid ?? '',
    phoneTail: raw.phoneTail ?? '',
    lastLoginAt: new Date(0),
    loginAttemptCount: 0,
    role: raw.role ?? '',
    profileUrl: raw.profileUrl ?? null,
    profileImageUrl: raw.profileImageUrl ?? null,
    profilePresignedUrl: raw.profilePresignedUrl ?? null,
    thumbnailProfileUrl: raw.thumbnailProfileUrl ?? null,
    isExternal: raw.isExternal ?? false,
  };
}
