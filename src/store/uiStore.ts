'use client';

import { create } from 'zustand';

interface ToastItem {
  id: string;
  message: string;
  state?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface LoadingOverlayState {
  visible: boolean;
  message?: string;
  progress?: number; // 0~1: determinate, undefined: indeterminate
}

interface UIState {
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

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  loadingOverlay: { visible: false },
  isLocked: false,
  isDimmed: false,
  showToast: toast => {
    const id = crypto.randomUUID();
    set(state => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, toast.duration ?? 3000);
  },
  removeToast: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  showSnackbar: ({ message, state: toastState }) => {
    const id = crypto.randomUUID();
    set(s => ({ toasts: [...s.toasts, { id, message, state: toastState ?? 'info' }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },
  showLoadingOverlay: options =>
    set({ loadingOverlay: { visible: true, message: options?.message, progress: options?.progress } }),
  setLoadingProgress: progress =>
    set(s => ({ loadingOverlay: { ...s.loadingOverlay, progress } })),
  hideLoadingOverlay: () =>
    set({ loadingOverlay: { visible: false } }),
  lock: () => set({ isLocked: true }),
  unlock: () => set({ isLocked: false }),
  setDimmed: (isDimmed: boolean) => set({ isDimmed }),
}));
