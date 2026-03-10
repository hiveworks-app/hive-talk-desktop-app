import { useEffect } from 'react';
import { useUIStore } from '@/store';

/**
 * Dialog/Overlay가 열릴 때 dimmed 상태를 관리하는 훅
 * Windows 타이틀바 색상을 자동으로 동기화
 */
export function useDimmed(isOpen: boolean) {
  useEffect(() => {
    if (isOpen) {
      useUIStore.getState().setDimmed(true);
      return () => useUIStore.getState().setDimmed(false);
    }
  }, [isOpen]);
}
