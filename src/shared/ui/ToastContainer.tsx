'use client';

import { useUIStore } from '@/store/uiStore';
import CircleApproveCheckIcon from '@assets/icons/static/circle-approve-check.svg';
import CircleErrorCloseIcon from '@assets/icons/static/circle-error-close.svg';

/**
 * 스낵바 — RN SnackbarItem(common pill) 패리티.
 * 하단 중앙 pill(rounded-3xl, gray-700 다크 배경) + text-body(16) medium 흰 글자.
 * 상태 아이콘 24px: success=체크(브랜드 그린) / error=엑스(레드), info·warning은 아이콘 없음.
 */
export function ToastContainer() {
  const toasts = useUIStore(s => s.toasts);
  const removeToast = useUIStore(s => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-10 z-[9999] flex flex-col items-center gap-2 px-4">
      {toasts.map(toast => (
        <button
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className="animate-toast-in pointer-events-auto max-w-[90vw] rounded-3xl bg-gray-700 px-4 py-3 shadow-[0px_4px_14px_rgba(0,0,0,0.2)]"
        >
          <span className="flex items-start justify-center gap-1 text-left">
            {toast.state === 'success' && (
              <span className="h-6 w-6 shrink-0"><CircleApproveCheckIcon width={24} height={24} /></span>
            )}
            {toast.state === 'error' && (
              <span className="h-6 w-6 shrink-0"><CircleErrorCloseIcon width={24} height={24} /></span>
            )}
            <span className="min-w-0 shrink text-body font-medium text-white">{toast.message}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
