export interface ToastItem {
  id: string;
  message: string;
  state?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface LoadingOverlayState {
  visible: boolean;
  message?: string;
  progress?: number; // 0~1: determinate, undefined: indeterminate
}

export interface UIState {
  toasts: ToastItem[];
  loadingOverlay: LoadingOverlayState;
  isLocked: boolean;
  isDimmed: boolean;
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  showSnackbar: (params: { message: string; state?: ToastItem['state'] }) => void;
  showLoadingOverlay: (options?: { message?: string; progress?: number }) => void;
  setLoadingProgress: (progress: number) => void;
  hideLoadingOverlay: () => void;
  lock: () => void;
  unlock: () => void;
  setDimmed: (isDimmed: boolean) => void;
}
