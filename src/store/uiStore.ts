'use client';

import { create } from 'zustand';
import type { UIState } from './uiStore.type';

export type { ToastItem, LoadingOverlayState, UIState } from './uiStore.type';

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
