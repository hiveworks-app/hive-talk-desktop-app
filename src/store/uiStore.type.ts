export interface ToastItem {
  id: string;
  message: string;
  state?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  /** true면 단일 표시 정책(새 스낵바가 기존을 걷어내는 규칙)에서 제외 */
  sticky?: boolean;
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
