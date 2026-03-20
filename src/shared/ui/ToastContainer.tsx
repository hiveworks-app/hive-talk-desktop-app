'use client';

import { useUIStore } from '@/store/uiStore';
import { cn } from '@/shared/lib/cn';

const STATE_STYLES = {
  info: 'bg-gray-800',
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
} as const;

export function ToastContainer() {
  const toasts = useUIStore(s => s.toasts);
  const removeToast = useUIStore(s => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col gap-2">
      {toasts.map(toast => (
        <button
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={cn(
            'animate-toast-in w-max max-w-[90vw] rounded-lg px-4 py-2.5 text-sub font-medium text-white shadow-lg',
            STATE_STYLES[toast.state ?? 'info'],
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
