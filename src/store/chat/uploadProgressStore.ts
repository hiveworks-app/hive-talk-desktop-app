'use client';

import { create } from 'zustand';
import type { UploadProgressState } from './uploadProgressStore.type';

export type { UploadProgressEntry, UploadProgressState } from './uploadProgressStore.type';

export const useUploadProgressStore = create<UploadProgressState>(set => ({
  byFileId: {},
  setTransmissionProgress: (fileId, next) =>
    set(state => ({ byFileId: { ...state.byFileId, [fileId]: next } })),
  clearProgress: fileId =>
    set(state => {
      const next = { ...state.byFileId };
      delete next[fileId];
      return { byFileId: next };
    }),
  clearAll: () => set({ byFileId: {} }),
}));
