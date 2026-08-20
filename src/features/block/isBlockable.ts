import { USER_ROLE } from '@/shared/types/user';

/**
 * 차단 가능 여부 판정 (정책 U020 — 내 회사 ADMIN은 차단 불가, RN useBlockListController.isBlockable 패리티).
 * - ADMIN이 아니면 항상 차단 가능
 * - ADMIN이어도 타 회사면 차단 가능
 * - companyId를 알 수 없으면 fail-open으로 허용 (서버 U020 거절이 최종 방어선)
 */
export function isBlockableMember(
  target: { role?: string; companyId?: number | string | null },
  viewerCompanyId: string | null | undefined,
): boolean {
  if ((target.role ?? '') !== USER_ROLE.ADMIN) return true;
  const targetCompany = target.companyId;
  if (targetCompany == null || targetCompany === 0 || targetCompany === '') return true;
  if (viewerCompanyId == null) return true;
  return String(targetCompany) !== String(viewerCompanyId);
}
