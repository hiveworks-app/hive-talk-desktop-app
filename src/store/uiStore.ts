'use client';

import { create } from 'zustand';

interface ToastItem {
  id: string;
  message: string;
  state?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface UIState {
  toasts: ToastItem[];
  isLoadingOverlay: boolean;
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  showSnackbar: (params: { message: string; state?: ToastItem['state'] }) => void;
  showLoadingOverlay: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  isLoadingOverlay: false,
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
  showLoadingOverlay: show => set({ isLoadingOverlay: show }),
}));
