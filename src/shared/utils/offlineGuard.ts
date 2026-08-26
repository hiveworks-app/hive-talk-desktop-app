import { isEffectivelyOffline } from '@/store/networkStatusStore';
import { useUIStore } from '@/store/uiStore';

/**
 * 오프라인 상태인지 확인하고, 오프라인이면 토스트를 띄운다.
 * @returns true면 오프라인 → early return 필요
 */
export function isOffline(message = '오프라인 상태에서는 사용할 수 없습니다.'): boolean {
  // 확정 오프라인만 차단 — navigator.onLine 직결은 어댑터 전환 오탐으로 즉시 차단됐다 (RN 패리티)
  if (isEffectivelyOffline()) {
    useUIStore.getState().showSnackbar({ message });
    return true;
  }
  return false;
}
